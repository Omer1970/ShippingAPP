# 7. Backend Architecture

## 7.1 Laravel Application Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Api/
│   │   │   ├── AuthController.php
│   │   │   ├── ShipmentController.php
│   │   │   ├── OrderController.php
│   │   │   └── CustomerController.php
│   │   └── Middleware/
│   ├── Requests/
│   └── Resources/
├── Models/
│   ├── User.php
│   ├── DeliveryConfirmation.php
│   └── ErpSyncLog.php
├── Services/
│   ├── DolibarrService.php
│   ├── DeliveryService.php
│   └── SyncService.php
├── Jobs/
│   ├── SyncDeliveryToErp.php
│   └── ProcessSignatureUpload.php
└── Console/
    └── Commands/
```

## 7.2 Service Layer Architecture

### 7.2.1 Service Classes
```php
// Delivery Service Example
class DeliveryService
{
    public function __construct(
        private DolibarrService $dolibarrService,
        private SignatureService $signatureService
    ) {}

    public function confirmDelivery(int $shipmentId, array $data): DeliveryConfirmation
    {
        DB::beginTransaction();

        try {
            // Create delivery confirmation
            $confirmation = DeliveryConfirmation::create([
                'dolibarr_shipment_id' => $shipmentId,
                'user_id' => auth()->id(),
                'signature_data' => $data['signature_data'],
                'delivery_notes' => $data['delivery_notes'],
                'delivered_at' => $data['delivered_at']
            ]);

            // Process signature
            $this->signatureService->processSignature($confirmation);

            // Queue ERP sync
            SyncDeliveryToErp::dispatch($confirmation->id);

            DB::commit();
            return $confirmation;

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

## 7.3 Queue System

### 7.3.1 Job Classes
```php
// ERP Sync Job
class SyncDeliveryToErp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 5;
    public $backoff = [60, 120, 300, 600, 1200]; // Exponential backoff

    public function __construct(private int $confirmationId) {}

    public function handle(DeliveryConfirmationSync $syncService)
    {
        $syncService->syncToDolibarr($this->confirmationId);
    }

    public function failed(Throwable $exception)
    {
        // Handle permanent failure
        Log::error('ERP sync failed permanently', [
            'confirmation_id' => $this->confirmationId,
            'error' => $exception->getMessage()
        ]);
    }
}
```

---
