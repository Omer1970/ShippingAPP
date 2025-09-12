export interface Customer {
  id: number;
  dolibarr_customer_id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  customer_type: CustomerType;
  credit_status: CreditStatus;
  payment_terms?: string;
  tax_number?: string;
  preferred_delivery_time?: string;
  special_instructions?: string;
  latitude?: number;
  longitude?: number;
  search_vector?: string;
  created_from_dolibarr?: string;
  last_synced?: string;
  last_search_at?: string;
  created_at: string;
  updated_at: string;
}

export type CustomerType = 
  | 'Individual' 
  | 'Corporate' 
  | 'Small_Business' 
  | 'Government';

export type CreditStatus = 
  | 'Active' 
  | 'On_Hold' 
  | 'Suspended' 
  | 'Closed';

export interface CustomerListItem extends Customer {
  statistics: CustomerStatistics;
  search_score?: number;
}

export interface CustomerStatistics {
  total_orders: number;
  total_shipments: number;
  total_value: number;
  last_order_date?: string;
  average_order_value: number;
  active_orders: number;
  completed_orders: number;
  delivered_shipments: number;
  in_transit_shipments: number;
  order_to_shipment_ratio: number;
  successful_shipment_rate: number;
  average_days_to_deliver?: string;
}

export interface CustomerWithHistory extends Customer {
  orders: {
    data: Order[];
    meta: OrderMeta;
  };
  shipments: {
    data: Shipment[];
    meta: ShipmentMeta;
  };
  statistics: CustomerStatistics;
  classification: CustomerClassification;
  search_metadata?: SearchMetadata;
}

export interface Order {
  id: number;
  ref: string;
  date_commande: string;
  total_ttc: number;
  status: OrderStatus;
  description?: string;
  link?: string;
}

export interface Shipment {
  id: number;
  ref: string;
  tracking_number?: string;
  status: ShipmentStatus;
  date_creation: string;
  date_delivery_planned?: string;
  shipping_directory?: string;
  link?: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'cancelled';

export type ShipmentStatus = 
  | 'draft' 
  | 'validated' 
  | 'in_process' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled';

export interface OrderMeta {
  total: number;
  last_order?: string;
  api_endpoint: string;
}

export interface ShipmentMeta {
  total: number;
  last_shipment?: string;
  in_transit: number;
  api_endpoint: string;
}

export interface CustomerClassification {
  level: CustomerLevel;
  description: string;
  benefits?: string[];
}

export type CustomerLevel = 
  | 'VIP' 
  | 'Premium' 
  | 'Regular' 
  | 'New' 
  | 'Prospect' 
  | 'unknown';

export interface SearchMetadata {
  search_count: number;
  popularity_weight: number;
  categories?: string[];
  address_count?: number;
  primary_contact?: string;
}

export interface CustomerDetails {
  customer: CustomerWithHistory;
  metadata: {
    last_search_at?: string;
    search_count: number;
  };
}

export interface Address {
  formatted: string;
  components: AddressComponents;
  coordinates?: Coordinates;
}

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}