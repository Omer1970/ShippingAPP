<?php

namespace App\Jobs;

use App\Models\DeliveryConfirmation;
use App\Services\DolibarrDeliverySyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncDeliveryToErp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $deliveryId;
    public int $tries = 3;
    public int $timeout = 120;
    public $backoff = [60, 300, 900]; // Retry delays: 1min, 5min, 15min

    /**
     * Create a new job instance.
     */
    public function __construct(int $deliveryId)
    {
        $this->deliveryId = $deliveryId;
    }

    /**
     * Execute the job.
     */
    public function handle(DolibarrDeliverySyncService $syncService): void
    {
        try {
            Log::info('Starting ERP sync job', [
                'delivery_id' => $this->deliveryId,
                'job_id' => $this->job->getJobId() ?? 'unknown'
            ]);

            // Find delivery confirmation
            $delivery = DeliveryConfirmation::find($this->deliveryId);
            
            if (!$delivery) {
                Log::error('Delivery confirmation not found for ERP sync', [
                    'delivery_id' => $this->deliveryId
                ]);
                $this->fail(new \Exception("Delivery confirmation {$this->deliveryId} not found"));
                return;
            }

            // Skip if already synced
            if ($delivery->synced_to_erp) {
                Log::info('Delivery already synced to ERP, skipping', [
                    'delivery_id' => $this->deliveryId
                ]);
                return;
            }

            // Perform ERP sync
            $syncService->syncToDolibarr($this->deliveryId);

            Log::info('ERP sync completed successfully', [
                'delivery_id' => $this->deliveryId,
                'shipment_id' => $delivery->shipment_id
            ]);

        } catch (\Exception $e) {
            Log::error('ERP sync job failed', [
                'delivery_id' => $this->deliveryId,
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
                'max_attempts' => $this->tries
            ]);

            // Re-throw for Laravel's automatic retry logic
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ERP sync job permanently failed', [
            'delivery_id' => $this->deliveryId,
            'error' => $exception->getMessage(),
            'max_attempts_reached' => true
        ]);

        // Mark delivery as failed to sync for manual review
        try {
            $delivery = DeliveryConfirmation::find($this->deliveryId);
            if ($delivery) {
                // Add error note to delivery
                $delivery->delivery_notes = ($delivery->delivery_notes ?? '') . 
                    "\n[ERROR: ERP sync failed - " . now()->format('Y-m-d H:i:s') . "]";
                $delivery->save();

                // Queue for manual review in Dolibarr (if configured)
                $this->queueForManualReview($delivery->id);
            }
        } catch (\Exception $e) {
            Log::error('Error handling ERP sync job failure', [
                'delivery_id' => $this->deliveryId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Queue delivery for manual review in ERP system
     */
    private function queueForManualReview(int $deliveryId): void
    {
        try {
            // This would typically create a record in Dolibarr's manual review queue
            // For now, we'll just log it for visibility
            Log::warning('Delivery marked for manual ERP review', [
                'delivery_id' => $deliveryId,
                'action_required' => 'Manual sync required'
            ]);

            // In production, this would:
            // 1. Create a manual review task in Dolibarr
            // 2. Send notification to administrators
            // 3. Set up monitoring/alerting

        } catch (\Exception $e) {
            Log::error('Error queueing delivery for manual review', [
                'delivery_id' => $deliveryId,
                'error' => $e->getMessage()
            ]);
        }
    }
}