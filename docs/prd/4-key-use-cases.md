# 4. Key Use Cases

## 4.1 Driver Workflows

### UC-001: View All Shipments
**Actor:** Delivery Driver  
**Goal:** Access comprehensive list of all shipments  
**Preconditions:** User authenticated and connected to system  

**Main Flow:**
1. Driver opens ShipmentApp
2. System displays dashboard with all shipments
3. Driver can filter by date, status, customer, or location
4. Driver selects shipment for detailed view

**Success Criteria:** All shipments visible within 3 seconds

### UC-002: Customer Search and History
**Actor:** Delivery Driver  
**Goal:** Find customer and view complete order/shipment history  

**Main Flow:**
1. Driver accesses search function
2. Enters customer name or ID
3. System displays customer profile with:
   - All orders (past and current)
   - All shipments (delivered and pending)
   - Contact information and delivery preferences
4. Driver selects specific order or shipment

**Success Criteria:** Search results appear within 2 seconds

### UC-003: Digital Delivery Confirmation
**Actor:** Delivery Driver, Customer  
**Goal:** Complete delivery with digital signature  

**Main Flow:**
1. Driver selects shipment for delivery
2. System generates delivery note from ERP data
3. Driver presents delivery note to customer
4. Customer reviews and signs digitally on device
5. Driver confirms delivery completion
6. System uploads signed note to Dolibarr ERP
7. Shipment status updated to "Delivered"

**Success Criteria:** Signed note synced to ERP within 60 seconds

## 4.2 Warehouse Workflows

### UC-004: Shipment Preparation
**Actor:** Warehouse Staff  
**Goal:** Prepare and mark shipments ready for delivery  

**Main Flow:**
1. Staff accesses pending shipments list
2. Selects shipment for preparation
3. Verifies goods against order details
4. Marks shipment as "Ready for Dispatch"
5. System updates ERP and notifies relevant drivers

**Success Criteria:** Status updates reflected in ERP immediately

---
