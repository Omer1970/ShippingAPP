<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryConfirmation;
use App\Services\DeliveryNoteService;
use App\Http\Resources\DeliveryNoteResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class DeliveryNoteController extends Controller
{
    private DeliveryNoteService $deliveryNoteService;

    public function __construct(DeliveryNoteService $deliveryNoteService)
    {
        $this->deliveryNoteService = $deliveryNoteService;
    }

    /**
     * Generate delivery note PDF
     */
    public function generate(Request $request, int $deliveryId): JsonResponse
    {
        try {
            // Find delivery confirmation
            $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
                ->find($deliveryId);

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
                    'message' => 'Unauthorized to generate delivery note for this delivery'
                ], 403);
            }

            // Generate delivery note PDF
            $pdfData = $this->deliveryNoteService->generateDeliveryNote($delivery);

            if (!$pdfData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unable to generate delivery note'
                ], 500);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_note' => [
                        'id' => $delivery->id,
                        'delivery_id' => $deliveryId,
                        'pdf_url' => $pdfData['url'],
                        'pdf_path' => $pdfData['path'],
                        'file_size' => $pdfData['size'],
                        'generated_at' => now()->toISOString(),
                        'checksum' => $pdfData['checksum'],
                        'expires_at' => $pdfData['expires_at']->toISOString()
                    ]
                ],
                'message' => 'Delivery note generated successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error generating delivery note: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to generate delivery note',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get delivery note details
     */
    public function show(Request $request, int $deliveryId): JsonResponse
    {
        try {
            // Find delivery confirmation
            $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
                ->find($deliveryId);

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
                    'message' => 'Unauthorized to access delivery note for this delivery'
                ], 403);
            }

            // Check if delivery note exists
            $deliveryNoteData = $this->deliveryNoteService->getDeliveryNoteData($delivery);

            if (!$deliveryNoteData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery note not found. Generate one first.'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_note' => $deliveryNoteData
                ],
                'message' => 'Delivery note retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching delivery note: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch delivery note',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Preview delivery note (HTML format)
     */
    public function preview(Request $request, int $deliveryId): JsonResponse
    {
        try {
            // Find delivery confirmation
            $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
                ->find($deliveryId);

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
                    'message' => 'Unauthorized to preview delivery note for this delivery'
                ], 403);
            }

            // Generate HTML preview
            $previewData = $this->deliveryNoteService->generatePreview($delivery);

            return response()->json([
                'success' => true,
                'data' => [
                    'preview' => [
                        'html_content' => $previewData['html'],
                        'delivery_data' => $previewData['data'],
                        'generated_at' => now()->toISOString()
                    ]
                ],
                'message' => 'Delivery note preview generated successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error generating delivery note preview: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to generate delivery note preview',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Regenerate delivery note PDF
     */
    public function regenerate(Request $request, int $deliveryId): JsonResponse
    {
        try {
            // Find delivery confirmation
            $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
                ->find($deliveryId);

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
                    'message' => 'Unauthorized to regenerate delivery note for this delivery'
                ], 403);
            }

            // Delete existing delivery note
            $this->deliveryNoteService->deleteExistingDeliveryNote($delivery);

            // Generate new delivery note PDF
            $pdfData = $this->deliveryNoteService->generateDeliveryNote($delivery);

            if (!$pdfData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unable to regenerate delivery note'
                ], 500);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'delivery_note' => [
                        'id' => $delivery->id,
                        'delivery_id' => $deliveryId,
                        'pdf_url' => $pdfData['url'],
                        'pdf_path' => $pdfData['path'],
                        'file_size' => $pdfData['size'],
                        'generated_at' => now()->toISOString(),
                        'checksum' => $pdfData['checksum'],
                        'expires_at' => $pdfData['expires_at']->toISOString()
                    ]
                ],
                'message' => 'Delivery note regenerated successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error regenerating delivery note: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to regenerate delivery note',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Download delivery note PDF
     */
    public function download(Request $request, int $deliveryId)
    {
        try {
            // Find delivery confirmation
            $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
                ->find($deliveryId);

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
                    'message' => 'Unauthorized to download delivery note for this delivery'
                ], 403);
            }

            // Get delivery note PDF file
            $pdfFile = $this->deliveryNoteService->getDeliveryNoteFile($delivery);

            if (!$pdfFile || !file_exists($pdfFile)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Delivery note PDF not found. Generate one first.'
                ], 404);
            }

            // Generate filename
            $filename = sprintf(
                'delivery_note_%d_%s.pdf',
                $delivery->id,
                now()->format('Y_m_d')
            );

            // Return file download response
            return response()->download($pdfFile, $filename, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"'
            ]);

        } catch (\Exception $e) {
            Log::error('Error downloading delivery note: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to download delivery note',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get delivery note statistics
     */
    public function stats(Request $request): JsonResponse
    {
        try {
            $userId = $request->input('user_id');
            $dateFrom = $request->input('date_from');
            $dateTo = $request->input('date_to');

            // Filter by user if provided
            if ($userId) {
                if (auth()->id() != $userId && !auth()->user()->isAdmin()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized to view other user statistics'
                    ], 403);
                }
            }

            // Get delivery note statistics
            $stats = $this->deliveryNoteService->getDeliveryNoteStats([
                'user_id' => $userId,
                'date_from' => $dateFrom,
                'date_to' => $dateTo
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'statistics' => $stats
                ],
                'message' => 'Delivery note statistics retrieved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching delivery note statistics: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch delivery note statistics',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check if user can access delivery confirmation
     */
    private function canAccessDelivery($delivery): bool
    {
        return auth()->id() === $delivery->user_id || auth()->user()->isAdmin();
    }
}