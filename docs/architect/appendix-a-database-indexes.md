# Appendix A: Database Indexes

```sql
-- Performance Indexes
CREATE INDEX idx_delivery_confirmations_composite ON delivery_confirmations 
(dolibarr_shipment_id, synced_to_erp, delivered_at);

CREATE INDEX idx_users_active_role ON users (is_active, role);

CREATE INDEX idx_erp_sync_logs_status_created ON erp_sync_logs (status, created_at);

-- Full-text search indexes
ALTER TABLE delivery_confirmations ADD FULLTEXT(delivery_notes);
```
