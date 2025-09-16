<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Services\SignatureService;
use App\Http\Resources\DeliverySignatureResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class DeliverySignatureController extends Controller
{
    private SignatureService $signatureService;

    public function __construct(SignatureService $signatureService)
    {
        $this->signatureService = $signatureService;
    }

    /**
     * Capture and validate digital signature
     */
    public function capture(Request $request, int $deliveryId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'signature_data' => 'required|string',
            'signature_type' => 'nullable|in:touch,stylus',
            'signature_strokes' => 'nullable|array',
            'canvas_width' => 'required|integer|min:200|max:800',
            'canvas_height' => 'required|integer|min:100|max:400',
            'signature_quality' => 'nullable|numeric|between:0,1'
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
                    'message' => 'Unauthorized to capture signature for this delivery'
                ], 403);
            }

            // Validate signature data
            $signatureData = $request->input('signature_data');
            $validationResult = $this->signatureService->validateSignatureData($signatureData);

            if (!$validationResult['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid signature data',
                    'errors' => $validationResult['errors']
                ], 422);
            }

            // Calculate signature quality if not provided
            $quality = $request->input('signature_quality');
            if (!$quality) {
                $quality = $this->signatureService->calculateSignatureQuality(
                    $signatureData,
                    $request->input('signature_strokes', [])
                );
            }

            // Create or update signature
            $signature = $delivery->signature ?? new DeliverySignature();
            $signature->delivery_id = $delivery->id;
            $signature->signature_data = $signatureData;
            $signature->signature_type = $request->input('signature_type', 'touch');
            $signature->signature_strokes = $request->input('signature_strokes', []);
            $signature->signature_quality = $quality;
            $signature->canvas_width = $request->input('canvas_width');
            $signature->canvas_height = $request->input('canvas_height');
            $signature->device_name = $this->getDeviceName($request);
            $signature->ip_address = $request->ip();
            $signature->user_agent = $request->userAgent();

            // Generate verification hash
            $signature->save();
            $signature->signature_hash = $signature->generateVerificationHash();
            $signature->save();

            // Update delivery confirmation with signature reference
            $delivery->signature_id = $signature->id;
            $delivery->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'signature' => new DeliverySignatureResource($signature),
                    'quality_score' => $quality,
                    'is_legally_valid' => $signature->isLegallyValid()
                ],
                'message' => 'Signature captured successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error capturing signature: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to capture signature',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Validate signature data
     */
    public function validate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'signature_data' => 'required|string',
            'signature_strokes' => 'nullable|array',
            'canvas_width' => 'nullable|integer|min:200|max:800',
            'canvas_height' => 'nullable|integer|min:100|max:400'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $signatureData = $request->input('signature_data');
            $strokes = $request->input('signature_strokes', []);
            $canvasWidth = $request->input('canvas_width', 400);
            $canvasHeight = $request->input('canvas_height', 200);

            // Validate signature data
            $validationResult = $this->signatureService->validateSignatureData($signatureData);

            if (!$validationResult['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid signature data',
                    'errors' => $validationResult['errors']
                ], 422);
            }

            // Calculate quality score
            $qualityScore = $this->signatureService->calculateSignatureQuality($signatureData, $strokes);

            // Calculate metrics
            $metrics = [
                'quality_score' => $qualityScore,
                'is_valid_quality' => $qualityScore >= 0.85,
                'canvas_dimensions' => [
                    'width' => $canvasWidth,
                    'height' => $canvasHeight,
                    'aspect_ratio' => round($canvasWidth / $canvasHeight, 2)
                ],
                'data_size' => strlen($signatureData),
                'stroke_count' => count($strokes)
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'validation' => $validationResult,
                    'metrics' => $metrics,
                    'recommendations' => $this->getSignatureRecommendations($metrics)
                ],
                'message' => 'Signature validation completed'
            ]);

        } catch (\Exception $e) {
            Log::error('Error validating signature: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to validate signature',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get signature details
     */
    public function show(int $signatureId): JsonResponse
    {
        try {
            $signature = DeliverySignature::with(['deliveryConfirmation'])
                ->find($signatureId);

            if (!$signature) {
                return response()->json([
                    'success' => false,
                    'message' => 'Signature not found'
                ], 404);
            }

            // Check authorization
            if (!$this->canAccessDelivery($signature->deliveryConfirmation)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to access this signature'
                ], 403);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'signature' => new DeliverySignatureResource($signature),
                    'metrics' => $signature->getSignatureMetrics()
                ],
                'message' => 'Signature retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching signature: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch signature',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get signature template for optimization
     */
    public function template(): JsonResponse
    {
        try {
            $template = [
                'canvas' => [
                    'width' => 400,
                    'height' => 200,
                    'background_color' => '#ffffff',
                    'pen_color' => '#000000',
                    'pen_width' => 2
                ],
                'validation' => [
                    'min_strokes' => 3,
                    'min_quality_score' => 0.85,
                    'max_canvas_width' => 800,
                    'max_canvas_height' => 400,
                    'min_canvas_width' => 200,
                    'min_canvas_height' => 100
                ],
                'optimization' => [
                    'compression_level' => 6,
                    'image_format' => 'png',
                    'max_file_size' => 1048576, // 1MB
                    'enable_smoothing' => true
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'template' => $template
                ],
                'message' => 'Signature template retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching signature template: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch signature template',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Delete signature (with audit trail)
     */
    public function destroy(int $signatureId): JsonResponse
    {
        try {
            $signature = DeliverySignature::with(['deliveryConfirmation'])
                ->find($signatureId);

            if (!$signature) {
                return response()->json([
                    'success' => false,
                    'message' => 'Signature not found'
                ], 404);
            }

            // Check authorization - only admin or delivery owner can delete
            if (!$this->canDeleteSignature($signature)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to delete this signature'
                ], 403);
            }

            DB::beginTransaction();

            // Log audit trail
            Log::info('Signature deleted', [
                'signature_id' => $signatureId,
                'delivery_id' => $signature->delivery_id,
                'deleted_by' => auth()->id(),
                'deleted_at' => now(),
                'signature_metrics' => $signature->getSignatureMetrics()
            ]);

            // Delete signature
            $signature->delete();

            // Update delivery confirmation
            $delivery = $signature->deliveryConfirmation;
            if ($delivery) {
                $delivery->signature_id = null;
                $delivery->save();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Signature deleted successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting signature: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to delete signature',
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
     * Check if user can delete signature
     */
    private function canDeleteSignature(DeliverySignature $signature): bool
    {
        return auth()->user()->isAdmin() || 
               (auth()->id() === $signature->deliveryConfirmation->user_id && 
                $signature->created_at->diffInHours(now()) < 24);
    }

    /**
     * Get device name from request
     */
    private function getDeviceName(Request $request): string
    {
        $userAgent = $request->userAgent();
        
        // Simple device detection
        if (strpos($userAgent, 'Mobile') !== false) {
            return 'Mobile Device';
        } elseif (strpos($userAgent, 'Tablet') !== false) {
            return 'Tablet Device';
        } else {
            return 'Desktop Device';
        }
    }

    /**
     * Get signature recommendations based on metrics
     */
    private function getSignatureRecommendations(array $metrics): array
    {
        $recommendations = [];

        if ($metrics['quality_score'] < 0.85) {
            $recommendations[] = 'Signature quality is below recommended threshold. Consider recapturing.';
        }

        if ($metrics['canvas_dimensions']['width'] < 300) {
            $recommendations[] = 'Canvas width is small. Consider using a larger canvas for better signature quality.';
        }

        if ($metrics['stroke_count'] < 3) {
            $recommendations[] = 'Signature appears too simple. Ensure proper signature capture.';
        }

        return $recommendations;
    }
}