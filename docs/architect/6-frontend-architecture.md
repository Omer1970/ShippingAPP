# 6. Frontend Architecture

## 6.1 Angular Application Structure

```
src/
├── app/
│   ├── core/                 # Singleton services, guards
│   │   ├── auth/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── services/
│   ├── shared/               # Shared components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   └── directives/
│   ├── features/             # Feature modules
│   │   ├── dashboard/
│   │   ├── shipments/
│   │   ├── orders/
│   │   ├── customers/
│   │   └── calendar/
│   ├── layout/               # Layout components
│   └── app-routing.module.ts
├── assets/                   # Static assets
├── environments/             # Environment configurations
└── styles/                   # Global styles
```

## 6.2 State Management

### 6.2.1 NgRx Store Structure
```typescript
// Application State
interface AppState {
  auth: AuthState;
  shipments: ShipmentsState;
  orders: OrdersState;
  customers: CustomersState;
  ui: UIState;
}

// Shipments State Example
interface ShipmentsState {
  shipments: Shipment[];
  selectedShipment: Shipment | null;
  loading: boolean;
  error: string | null;
  filters: ShipmentFilters;
  pagination: PaginationInfo;
}
```

## 6.3 PWA Configuration

### 6.3.1 Service Worker Strategy
```typescript
// Service Worker Registration
import { SwUpdate } from '@angular/service-worker';

@Injectable()
export class UpdateService {
  constructor(private swUpdate: SwUpdate) {
    if (swUpdate.isEnabled) {
      swUpdate.available.subscribe(() => {
        if (confirm('New version available. Load?')) {
          window.location.reload();
        }
      });
    }
  }
}
```

### 6.3.2 Caching Strategy
- **App Shell:** Cache core application files
- **API Data:** Cache frequently accessed data with TTL
- **Images:** Cache signature images and icons
- **Offline Support:** Basic functionality when offline

---
