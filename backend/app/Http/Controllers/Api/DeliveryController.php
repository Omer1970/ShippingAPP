<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryConfirmation;
use App\Models\DeliveryPhoto;
use App\Models\Shipment;
use App\Services\DeliveryWorkflowService;
use App\Http\Resources\DeliveryConfirmationResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class DeliveryController extends Controller
{
    private DeliveryWorkflowService $deliveryWorkflowService;

    public function __construct(DeliveryWorkflowService $deliveryWorkflowService)
    {
        $this->deliveryWorkflowService = $deliveryWorkflowService;
    }

    /**
     * Get delivery confirmation for a shipment
     */
    public function show(int $shipmentId): JsonResponse
    {
        try {
            $delivery = DeliveryConfirmation::where('shipment_id', $shipmentId)
                ->with(['signature', 'photos', 'user', 'shipment'])
                ->first();

            if (!$delivery) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery confirmation not found'
                ], 404);
            }

            // Check authorization
            if (!$this->canAccessDelivery($delivery)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to access this delivery confirmation'
                ], 403);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => new DeliveryConfirmationResource($delivery)
                ],
                'message' => 'Delivery confirmation retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching delivery confirmation: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch delivery confirmation',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Create or update delivery confirmation
     */
    public function confirm(Request $request, int $shipmentId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'delivered_at' => 'required|date',
            'recipient_name' => 'required|string|max:255',
            'delivery_notes' => 'nullable|string|max:1000',
            'gps_latitude' => 'required|numeric|between:-90,90',
            'gps_longitude' => 'required|numeric|between:-180,180',
            'gps_accuracy' => 'nullable|numeric|min:0|max:50',
            'signature_data' => 'nullable|string',
            'signature_quality' => 'nullable|numeric|between:0,1',
            'photo_ids' => 'nullable|array',
            'photo_ids.*' => 'integer|exists:delivery_photos,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Find or create delivery confirmation
            $delivery = DeliveryConfirmation::where('shipment_id', $shipmentId)
                ->first();

            if (!$delivery) {
                $delivery = new DeliveryConfirmation();
                $delivery->shipment_id = $shipmentId;
            }

            // Set delivery data
            $delivery->user_id = auth()->id();
            $delivery->delivered_at = $request->input('delivered_at');
            $delivery->recipient_name = $request->input('recipient_name');
            $delivery->delivery_notes = $request->input('delivery_notes');
            $delivery->gps_latitude = $request->input('gps_latitude');
            $delivery->gps_longitude = $request->input('gps_longitude');
            $delivery->gps_accuracy = $request->input('gps_accuracy', 0.00);
            $delivery->photo_ids = $request->input('photo_ids', []);
            $delivery->status = 'delivered';

            // Generate verification hash
            $delivery->save();
            $delivery->verification_hash = $delivery->generateVerificationHash();
            $delivery->save();

            // Process signature if provided
            if ($request->filled('signature_data')) {
                $signatureData = [
                    'signature_data' => $request->input('signature_data'),
                    'signature_quality' => $request->input('signature_quality', 0),
                    'canvas_width' => $request->input('canvas_width', 400),
                    'canvas_height' => $request->input('canvas_height', 200)
                ];
                
                $this->deliveryWorkflowService->processSignature($delivery, $signatureData);
            }

            // Queue ERP sync
            $this->deliveryWorkflowService->queueErpSync($delivery);

            DB::commit();

            // Load relationships for response
            $delivery->load(['signature', 'photos', 'user', 'shipment']);

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => new DeliveryConfirmationResource($delivery)
                ],
                'message' => 'Delivery confirmation created successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating delivery confirmation: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to create delivery confirmation',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update delivery status with GPS location
     */
    public function updateStatus(Request $request, int $deliveryId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:confirmed,delivered,failed,returned',
            'gps_latitude' => 'nullable|numeric|between:-90,90',
            'gps_longitude' => 'nullable|numeric|between:-180,180',
            'gps_accuracy' => 'nullable|numeric|min:0|max:50',
            'delivery_notes' => 'nullable|string|max:1000'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $delivery = DeliveryConfirmation::find($deliveryId);

            if (!$delivery) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery confirmation not found'
                ], 404);
            }

            // Check authorization
            if (!$this->canAccessDelivery($delivery)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to update this delivery confirmation'
                ], 403);
            }

            // Update delivery status
            $delivery->status = $request->input('status');
            $delivery->delivery_notes = $request->input('delivery_notes', $delivery->delivery_notes);
            
            // Update GPS if provided
            if ($request->filled('gps_latitude') && $request->filled('gps_longitude')) {
                $delivery->gps_latitude = $request->input('gps_latitude');
                $delivery->gps_longitude = $request->input('gps_longitude');
                $delivery->gps_accuracy = $request->input('gps_accuracy', 0.00);
            }

            $delivery->save();

            // Queue ERP sync for status updates
            $this->deliveryWorkflowService->queueErpSync($delivery);

            // Load relationships for response
            $delivery->load(['signature', 'photos', 'user', 'shipment']);

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => new DeliveryConfirmationResource($delivery)
                ],
                'message' => 'Delivery status updated successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating delivery status: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to update delivery status',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get user's delivery confirmations
     */
    public function userDeliveries(Request $request, int $userId): JsonResponse
    {
        try {
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);
            $status = $request->input('status');

            // Validate pagination parameters
            $perPage = in_array($perPage, [10, 25, 50, 100]) ? $perPage : 10;
            $page = max(1, $page);

            // Check authorization - users can only see their own deliveries unless admin
            if (auth()->id() != $userId && !auth()->user()->isAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to view other user deliveries'
                ], 403);
            }

            // Build query
            $query = DeliveryConfirmation::with(['signature', 'photos', 'user', 'shipment'])
                ->where('user_id', $userId)
                ->orderBy('delivered_at', 'desc');

            // Filter by status if provided
            if ($status) {
                $query->where('status', $status);
            }

            $deliveries = $query->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'success' => true,
                'data' => [
                    'deliveries' => DeliveryConfirmationResource::collection($deliveries),
                    'pagination' => [
                        'current_page' => $deliveries->currentPage(),
                        'last_page' => $deliveries->lastPage(),
                        'per_page' => $deliveries->perPage(),
                        'total' => $deliveries->total(),
                        'from' => $deliveries->firstItem(),
                        'to' => $deliveries->lastItem()
                    ]
                ],
                'message' => 'User deliveries retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching user deliveries: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch user deliveries',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Upload delivery confirmation photo
     */
    public function uploadPhoto(Request $request, int $deliveryId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|mimes:jpeg,png,jpg|max:5120', // 5MB max
            'photo_type' => 'required|in:delivery_proof,site_photo,issue_documentation',
            'gps_latitude' => 'nullable|numeric|between:-90,90',
            'gps_longitude' => 'nullable|numeric|between:-180,180',
            'photo_metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Find delivery confirmation
            $delivery = DeliveryConfirmation::find($deliveryId);

            if (!$delivery) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery confirmation not found'
                ], 404);
            }

            // Check authorization
            if (!$this->canAccessDelivery($delivery)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to upload photos for this delivery'
                ], 403);
            }

            // Process photo upload
            $photo = $request->file('photo');
            $photoType = $request->input('photo_type');
            
            // Store original photo
            $photoPath = $photo->store('delivery_photos/' . $deliveryId, 'public');
            
            // Create thumbnail
            $thumbnailPath = $this->createThumbnail($photoPath, $deliveryId);

            // Get image dimensions
            $imageInfo = getimagesize(storage_path('app/public/' . $photoPath));
            $imageDimensions = [
                'width' => $imageInfo[0] ?? null,
                'height' => $imageInfo[1] ?? null
            ];

            // Create delivery photo record
            $deliveryPhoto = DeliveryPhoto::create([
                'delivery_confirmation_id' => $deliveryId,
                'photo_path' => $photoPath,
                'thumbnail_path' => $thumbnailPath,
                'photo_type' => $photoType,
                'gps_latitude' => $request->input('gps_latitude'),
                'gps_longitude' => $request->input('gps_longitude'),
                'photo_metadata' => $request->input('photo_metadata', []),
                'file_size' => $photo->getSize(),
                'image_dimensions' => $imageDimensions
            ]);

            // Update delivery confirmation photo IDs
            $photoIds = $delivery->photo_ids ?? [];
            $photoIds[] = $deliveryPhoto->id;
            $delivery->photo_ids = $photoIds;
            $delivery->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'photo' => [
                        'id' => $deliveryPhoto->id,
                        'photo_url' => Storage::url($photoPath),
                        'thumbnail_url' => Storage::url($thumbnailPath),
                        'photo_type' => $photoType,
                        'file_size' => $deliveryPhoto->getFileSizeFormatted(),
                        'image_dimensions' => $imageDimensions,
                        'has_gps' => $deliveryPhoto->hasGPSData()
                    ]
                ],
                'message' => 'Photo uploaded successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error uploading delivery photo: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to upload photo',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Delete delivery photo
     */
    public function deletePhoto(int $deliveryId, int $photoId): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Find delivery confirmation and photo
            $delivery = DeliveryConfirmation::find($deliveryId);
            $photo = DeliveryPhoto::where('delivery_confirmation_id', $deliveryId)
                ->where('id', $photoId)
                ->first();

            if (!$delivery || !$photo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery confirmation or photo not found'
                ], 404);
            }

            // Check authorization
            if (!$this->canAccessDelivery($delivery)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to delete photos for this delivery'
                ], 403);
            }

            // Delete photo files
            $photo->deletePhotoFiles();

            // Remove photo ID from delivery confirmation
            $photoIds = $delivery->photo_ids ?? [];
            $photoIds = array_diff($photoIds, [$photoId]);
            $delivery->photo_ids = array_values($photoIds);
            $delivery->save();

            // Delete photo record
            $photo->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Photo deleted successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting delivery photo: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to delete photo',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Create thumbnail for uploaded photo
     */
    private function createThumbnail(string $photoPath, int $deliveryId): string
    {
        try {
            // This would typically use Intervention Image library
            // For now, return the original path as placeholder
            // In production, implement proper thumbnail generation
            $thumbnailPath = str_replace('delivery_photos/', 'delivery_photos/thumbnails/', $photoPath);
            
            // Copy original as thumbnail (placeholder implementation)
            $originalPath = storage_path('app/public/' . $photoPath);
            $thumbnailFullPath = storage_path('app/public/' . $thumbnailPath);
            
            // Create directory if it doesn't exist
            $thumbnailDir = dirname($thumbnailFullPath);
            if (!is_dir($thumbnailDir)) {
                mkdir($thumbnailDir, 0755, true);
            }
            
            // Copy file as thumbnail (placeholder - implement proper resizing)
            copy($originalPath, $thumbnailFullPath);
            
            return $thumbnailPath;
        } catch (\Exception $e) {
            Log::error('Error creating thumbnail: ' . $e->getMessage());
            return $photoPath; // Return original path if thumbnail creation fails
        }
    }

    /**
     * Get delivery statistics and metrics
     */
    public function stats(Request $request): JsonResponse
    {
        try {
            $userId = $request->input('user_id');
            $dateFrom = $request->input('date_from');
            $dateTo = $request->input('date_to');

            // Build statistics query
            $query = DeliveryConfirmation::with(['signature', 'photos']);

            // Filter by user if provided
            if ($userId) {
                if (auth()->id() != $userId && !auth()->user()->isAdmin()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized to view other user statistics'
                    ], 403);
                }
                $query->where('user_id', $userId);
            }

            // Filter by date range if provided
            if ($dateFrom) {
                $query->whereDate('delivered_at', '>=', $dateFrom);
            }
            if ($dateTo) {
                $query->whereDate('delivered_at', '<=', $dateTo);
            }

            $totalDeliveries = $query->count();
            
            $successfulDeliveries = (clone $query)
                ->where('status', 'delivered')
                ->count();

            $avgDeliveryTime = $this->calculateAvgDeliveryTime($query);
            
            $signatureStats = $this->getSignatureStats($query);
            
            $photoStats = $this->getPhotoStats($query);

            return response()->json([
                'success' => true,
                'data' => [
                    'statistics' => [
                        'total_deliveries' => $totalDeliveries,
                        'successful_deliveries' => $successfulDeliveries,
                        'success_rate' => $totalDeliveries > 0 ? round(($successfulDeliveries / $totalDeliveries) * 100, 2) : 0,
                        'avg_delivery_time_minutes' => $avgDeliveryTime,
                        'signature_statistics' => $signatureStats,
                        'photo_statistics' => $photoStats
                    ]
                ],
                'message' => 'Delivery statistics retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching delivery statistics: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch delivery statistics',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check if user can access delivery confirmation
     */
    private function canAccessDelivery(DeliveryConfirmation $delivery): bool
    {
        return auth()->id() === $delivery->user_id || auth()->user()->isAdmin();
    }

    /**
     * Calculate average delivery time in minutes
     */
    private function calculateAvgDeliveryTime($query): ?float
    {
        try {
            $deliveries = $query->where('delivered_at', '!=', null)->get();
            
            if ($deliveries->isEmpty()) {
                return null;
            }

            $totalMinutes = 0;
            $count = 0;

            foreach ($deliveries as $delivery) {
                if ($delivery->shipment && $delivery->shipment->planned_date) {
                    $planned = \Carbon\Carbon::parse($delivery->shipment->planned_date);
                    $actual = \Carbon\Carbon::parse($delivery->delivered_at);
                    $totalMinutes += $planned->diffInMinutes($actual);
                    $count++;
                }
            }

            return $count > 0 ? round($totalMinutes / $count, 2) : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Calculate signature statistics
     */
    private function getSignatureStats($query): array
    {
        $totalWithSignature = (clone $query)->whereHas('signature')->count();
        $validSignatures = (clone $query)->whereHas('signature', function ($q) {
            $q->whereRaw('signature_hash IS NOT NULL AND LENGTH(signature_data) > 100');
        })->count();

        return [
            'total_with_signature' => $totalWithSignature,
            'valid_signatures' => $validSignatures,
            'signature_usage_rate' => $totalWithSignature > 0 ? round(($validSignatures / $totalWithSignature) * 100, 2) : 0
        ];
    }

    /**
     * Calculate photo statistics
     */
    private function getPhotoStats($query): array
    {
        $totalWithPhotos = (clone $query)->whereHas('photos')->count();
        $avgPhotosPerDelivery = (clone $query)->withCount('photos')->get()->avg('photos_count') ?? 0;

        return [
            'total_with_photos' => $totalWithPhotos,
            'avg_photos_per_delivery' => round($avgPhotosPerDelivery, 2),
            'photo_usage_rate' => $query->count() > 0 ? round(($totalWithPhotos / $query->count()) * 100, 2) : 0
        ];
    }
}