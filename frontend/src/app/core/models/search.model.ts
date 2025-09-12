export interface SearchRequest {
  q: string;
  limit?: number;
  include_synonyms?: boolean;
  filters?: SearchFilters;
}

export interface SearchFilters {
  customer_type?: CustomerType[];
  credit_status?: CreditStatus[];
  date_range?: DateRange;
  location?: LocationFilter;
  min_order_value?: number;
  max_order_value?: number;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface LocationFilter {
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  radius_km?: number;
  center_coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface SearchResponse<T> {
  success: boolean;
  data: {
    customers: T[];
    metadata: SearchMetadata;
  };
}

export interface SearchMetadata {
  total_results: number;
  search_time_ms: number;
  query: string;
  limit: number;
  cache_hit: boolean;
  suggestions?: string[];
}

export interface AutocompleteRequest {
  q: string;
}

export interface AutocompleteResponse {
  success: boolean;
  data: {
    suggestions: AutocompleteSuggestion[];
    metadata: AutocompleteMetadata;
  };
}

export interface AutocompleteSuggestion {
  id: number;
  name: string;
  email?: string;
  customer_type: CustomerType;
  highlight?: SearchHighlight;
}

export interface SearchHighlight {
  text: string;
  highlight_start?: number;
  highlight_end?: number;
}

export interface AutocompleteMetadata {
  total_suggestions: number;
  search_time_ms: number;
  query: string;
}

export interface CustomerSearchResult {
  id: number;
  dolibarr_customer_id: number;
  name: string;
  email?: string;
  phone?: string;
  address_preview?: string;
  customer_type: CustomerType;
  credit_status: CreditStatus;
  statistics: CustomerStatistics;
  search_score?: number;
  last_synced?: string;
}

export interface GlobalSearchRequest {
  q: string;
  type?: 'customer' | 'order' | 'shipment' | 'all';
  limit?: number;
  filters?: GlobalSearchFilters;
}

export interface GlobalSearchFilters {
  customers?: SearchFilters;
  orders?: OrderSearchFilters;
  shipments?: ShipmentSearchFilters;
}

export interface OrderSearchFilters {
  status?: OrderStatus[];
  date_range?: DateRange;
  customer_id?: number;
  min_total?: number;
  max_total?: number;
}

export interface ShipmentSearchFilters {
  status?: ShipmentStatus[];
  date_range?: DateRange;
  customer_id?: number;
  tracking_number?: string;
}

export interface GlobalSearchResponse {
  success: boolean;
  data: {
    customers?: CustomerSearchResult[];
    orders?: OrderSearchResult[];
    shipments?: ShipmentSearchResult[];
    metadata: GlobalSearchMetadata;
  };
}

export interface OrderSearchResult {
  id: number;
  ref: string;
  date_commande: string;
  total_ttc: number;
  status: OrderStatus;
  customer_name: string;
  customer_id: number;
}

export interface ShipmentSearchResult {
  id: number;
  ref: string;
  tracking_number?: string;
  status: ShipmentStatus;
  date_creation: string;
  customer_name: string;
  customer_id: number;
}

export interface GlobalSearchMetadata {
  total_results: number;
  search_time_ms: number;
  query: string;
  results_per_type: {
    customers?: number;
    orders?: number;
    shipments?: number;
  };
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  result_count: number;
  clicked_result?: number;
}

export interface RecentSearch {
  query: string;
  timestamp: string;
  frequency: number;
}

export interface SearchAnalytics {
  total_searches: number;
  average_response_time: number;
  most_searched_terms: string[];
  search_success_rate: number;
  popular_customers: number[];
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