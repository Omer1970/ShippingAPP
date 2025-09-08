# 4. ERP Integration Strategy

## 4.1 Integration Architecture

### 4.1.1 Connection Strategy
- **Database Connection:** Direct MySQL connection to Dolibarr database
- **Read-Only Access:** Prevent accidental data modification
- **Connection Pooling:** Optimize database connections
- **Fallback Strategy:** Graceful handling of ERP downtime

### 4.1.2 Data Synchronization

**Real-Time Sync (Critical Data):**
- Order status changes
- Customer information updates
- Shipment status updates

**Batch Sync (Non-Critical Data):**
- Product catalog updates
- Historical data
- Reporting data

**Event-Driven Sync:**
- Delivery confirmations
- Signature uploads
- Status updates

## 4.2 Dolibarr Integration Points

### 4.2.1 Data Reading (FROM Dolibarr)
```php
// Laravel Service Class Example
class DolibarrService
{
    public function getOrders($filters = [])
    {
        $query = DB::connection('dolibarr')
            ->table('llx_commande as c')
            ->join('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
            ->select([
                'c.rowid as id',
                'c.ref as reference',
                'c.date_commande as order_date',
                'c.total_ttc as total_amount',
                'c.fk_statut as status',
                's.nom as customer_name',
                's.phone as customer_phone',
                's.email as customer_email'
            ]);

        // Apply filters
        if (isset($filters['customer_id'])) {
            $query->where('c.fk_soc', $filters['customer_id']);
        }

        if (isset($filters['status'])) {
            $query->where('c.fk_statut', $filters['status']);
        }

        return $query->paginate(20);
    }

    public function getShipments($filters = [])
    {
        return DB::connection('dolibarr')
            ->table('llx_expedition as e')
            ->join('llx_commande as c', 'e.fk_commande', '=', 'c.rowid')
            ->join('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
            ->select([
                'e.rowid as id',
                'e.ref as reference',
                'e.date_expedition as shipment_date',
                'e.fk_statut as status',
                'c.ref as order_reference',
                's.nom as customer_name'
            ])
            ->where('e.fk_statut', '!=', 3) // Not cancelled
            ->paginate(20);
    }
}
```

### 4.2.2 Data Writing (TO Dolibarr)
```php
// Delivery Confirmation Sync
class DeliveryConfirmationSync
{
    public function syncToDolibarr($confirmationId)
    {
        $confirmation = DeliveryConfirmation::find($confirmationId);

        try {
            // Update shipment status in Dolibarr
            DB::connection('dolibarr')
                ->table('llx_expedition')
                ->where('rowid', $confirmation->dolibarr_shipment_id)
                ->update([
                    'fk_statut' => 2, // Delivered status
                    'date_delivery' => $confirmation->delivered_at,
                    'note_private' => $confirmation->delivery_notes
                ]);

            // Upload signature file
            $this->uploadSignatureFile($confirmation);

            // Mark as synced
            $confirmation->update([
                'synced_to_erp' => true,
                'last_sync_attempt' => now()
            ]);

        } catch (Exception $e) {
            // Log error and retry later
            $confirmation->update([
                'sync_attempts' => $confirmation->sync_attempts + 1,
                'sync_error_message' => $e->getMessage(),
                'last_sync_attempt' => now()
            ]);

            throw $e;
        }
    }
}
```

## 4.3 Error Handling & Retry Strategy

### 4.3.1 Connection Failures
- **Retry Logic:** Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Circuit Breaker:** Stop attempts after 5 consecutive failures
- **Fallback:** Use cached data when ERP is unavailable
- **Monitoring:** Alert administrators of prolonged outages

### 4.3.2 Data Consistency
- **Transaction Management:** Use database transactions for critical operations
- **Conflict Resolution:** Last-write-wins for most data, manual resolution for conflicts
- **Audit Trail:** Log all sync operations for troubleshooting

---
