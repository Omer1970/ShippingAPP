import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { 
  CustomerListItem, 
  CustomerWithHistory,
  CustomerSearchResult 
} from '../../../core/models/customer.model';

import { 
  SearchService 
} from '../../../core/services/search.service';

import { 
  CustomerService 
} from '../../../core/services/customer.service';

export interface SearchState {
  query: string;
  results: CustomerListItem[];
  isLoading: boolean;
  hasResults: boolean;
  totalResults: number;
  searchTime: number;
  suggestions: string[];
  error: string | null;
}

export interface FilterState {
  customerType: string[];
  creditStatus: string[];
  dateRange: { start?: Date; end?: Date };
  location: {
    city?: string;
    state?: string;
    postalCode?: string;
  };
  orderValueRange: { min?: number; max?: number };
  activeFilters: number;
}

@Injectable()
export class CustomerSearchService {
  private searchStateSubject = new BehaviorSubject<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    hasResults: false,
    totalResults: 0,
    searchTime: 0,
    suggestions: [],
    error: null
  });

  private filterStateSubject = new BehaviorSubject<FilterState>({
    customerType: [],
    creditStatus: [],
    dateRange: {},
    location: {},
    orderValueRange: {},
    activeFilters: 0
  });

  public searchState$ = this.searchStateSubject.asObservable();
  public filterState$ = this.filterStateSubject.asObservable();

  constructor(
    private searchService: SearchService,
    private customerService: CustomerService
  ) {
    this.setupSearchSubscriptions();
  }

  private setupSearchSubscriptions(): void {
    // Subscribe to search results
    this.searchService.searchResults$.subscribe({
      next: (results: any) => {
        if (results && results.customers) {
          this.updateSearchState({
            results: results.customers,
            hasResults: results.customers.length > 0,
            totalResults: results.metadata?.total_results || 0,
            searchTime: results.metadata?.search_time_ms || 0,
            suggestions: results.metadata?.suggestions || [],
            error: null
          });
        }
      },
      error: (error) => {
        this.updateSearchState({
          error: error.message || 'Search failed. Please try again.',
          hasResults: false
        });
      }
    });

    // Subscribe to autcomplete suggestions
    this.searchService.autocompleteSuggestions$.subscribe({
      next: (result) => {
        if (result && result.suggestions) {
          this.updateSearchState({
            suggestions: result.suggestions.map((s: any) => s.name || s.text)
          });
        }
      },
      error: (error) => {
        console.warn('Autocomplete failed:', error);
      }
    });

    // Subscribe to loading state
    this.searchService.isSearching$.subscribe(isSearching => {
      this.updateSearchState({ isLoading: isSearching });
    });
  }

  // Search methods
  searchCustomers(query: string): void {
    if (!query || query.trim().length < 2) {
      this.clearSearch();
      return;
    }

    this.updateSearchState({ 
      query: query.trim(),
      isLoading: true, 
      error: null 
    });

    // Apply current filters to search if any are active
    const filterState = this.filterStateSubject.value;
    if (filterState.activeFilters > 0) {
      // Perform filtered search
      const filters = this.buildFilterRequest(filterState);
      this.searchService.globalSearch({
        q: query,
        type: 'customer',
        limit: 50,
        filters: { customers: filters }
      });
    } else {
      // Perform normal search
      this.searchService.searchCustomers(query);
    }
  }

  getAutocompleteSuggestions(query: string): void {
    if (!query || query.trim().length < 1) {
      this.updateSearchState({ suggestions: [] });
      return;
    }

    this.searchService.getAutocompleteSuggestions(query.trim());
  }

  clearSearch(): void {
    this.searchStateSubject.next({
      query: '',
      results: [],
      isLoading: false,
      hasResults: false,
      totalResults: 0,
      searchTime: 0,
      suggestions: [],
      error: null
    });
  }

  // Filter methods
  setFilter(key: keyof FilterState, value: any): void {
    const currentState = this.filterStateSubject.value;
    const newState = { ...currentState, [key]: value };
    newState.activeFilters = this.countActiveFilters(newState);
    this.filterStateSubject.next(newState);
    
    // Re-search if there's a current query
    if (currentState.activeFilters > 0 || newState.activeFilters > 0) {
      const currentQuery = this.searchStateSubject.value.query;
      if (currentQuery) {
        this.searchCustomers(currentQuery);
      }
    }
  }

  clearAllFilters(): void {
    this.filterStateSubject.next({
      customerType: [],
      creditStatus: [],
      dateRange: {},
      location: {},
      orderValueRange: {},
      activeFilters: 0
    });

    // Re-search with current query
    const currentQuery = this.searchStateSubject.value.query;
    if (currentQuery) {
      this.searchCustomers(currentQuery);
    }
  }

  resetFilters(): void {
    this.clearAllFilters();
  }

  // Private helper methods
  private updateSearchState(updates: Partial<SearchState>): void {
    const currentState = this.searchStateSubject.value;
    this.searchStateSubject.next({ ...currentState, ...updates });
  }

  private buildFilterRequest(filterState: FilterState): any {
    const filters: any = {};

    if (filterState.customerType.length > 0) {
      filters.customer_type = filterState.customerType;
    }

    if (filterState.creditStatus.length > 0) {
      filters.credit_status = filterState.creditStatus;
    }

    if (filterState.dateRange.start || filterState.dateRange.end) {
      filters.date_range = {
        start_date: filterState.dateRange.start?.toISOString(),
        end_date: filterState.dateRange.end?.toISOString()
      };
    }

    if (Object.keys(filterState.location).length > 0) {
      filters.location = filterState.location;
    }

    if (filterState.orderValueRange.min || filterState.orderValueRange.max) {
      filters.min_order_value = filterState.orderValueRange.min;
      filters.max_order_value = filterState.orderValueRange.max;
    }

    return filters;
  }

  private countActiveFilters(filterState: FilterState): number {
    let count = 0;

    if (filterState.customerType.length > 0) count++;
    if (filterState.creditStatus.length > 0) count++;
    if (Object.keys(filterState.dateRange).length > 0) count++;
    if (Object.keys(filterState.location).length > 0) count++;
    if (Object.keys(filterState.orderValueRange).length > 0) count++;

    return count;
  }

  // Getter methods
  get currentSearchState(): SearchState {
    return this.searchStateSubject.value;
  }

  get currentFilterState(): FilterState {
    return this.filterStateSubject.value;
  }

  // Utility methods
  getCustomerById(customerId: number): Observable<CustomerWithHistory | null> {
    return this.customerService.getCustomerProfile(customerId, true, true)
      .pipe(
        map(details => details.customer)
      );
  }

  refreshCustomerData(customerId: number): Observable<any> {
    return this.customerService.refreshCustomerData(customerId);
  }
}