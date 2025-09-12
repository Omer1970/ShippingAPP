import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';

import { CustomerListItem, CustomerSearchResult } from '../../../../core/models/customer.model';
import { SearchState, FilterState, CustomerSearchService } from '../../services/customer-search.service';
import { SearchService } from '../../../../core/services/search.service';

@Component({
  selector: 'app-customer-search',
  templateUrl: './customer-search.component.html',
  styleUrls: ['./customer-search.component.scss']
})
export class CustomerSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  // Form control for search input
  searchControl = new FormControl('');
  
  // Observable streams
  searchState$: Observable<SearchState>;
  filterState$: Observable<FilterState>;
  
  // Component state
  isVoiceSearchActive = false;
  showAdvancedFilters = false;
  selectedCustomerId: number | null = null;
  
  // Filter options
  customerTypes = [
    { value: 'Individual', label: 'Individual' },
    { value: 'Corporate', label: 'Corporate' },
    { value: 'Small_Business', label: 'Small Business' },
    { value: 'Government', label: 'Government' }
  ];
  
  creditStatuses = [
    { value: 'Active', label: 'Active' },
    { value: 'On_Hold', label: 'On Hold' },
    { value: 'Suspended', label: 'Suspended' },
    { value: 'Closed', label: 'Closed' }
  ];
  
  // Private subjects for cleanup
  private destroy$ = new Subject<void>();
  private searchDebounce$ = new Subject<string>();
  
  constructor(
    private customerSearchService: CustomerSearchService,
    private searchService: SearchService,
    private router: Router
  ) {
    this.searchState$ = this.customerSearchService.searchState$;
    this.filterState$ = this.customerSearchService.filterState$;
  }
  
  ngOnInit(): void {
    this.setupSearchSubscription();
    this.setupReactiveSearch();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchDebounce$.complete();
  }
  
  private setupSearchSubscription(): void {
    // Subscribe to search control changes
    this.searchControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged() // Only emit if value changed
      )
      .subscribe(query => {
        this.onSearchChange(query || '');
      });
  }
  
  private setupReactiveSearch(): void {
    // Setup debounced search stream
    this.searchDebounce$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(query => {
        if (query.trim().length >= 2) {
          this.customerSearchService.searchCustomers(query);
        } else if (query.trim().length === 0) {
          this.customerSearchService.clearSearch();
        }
      });
  }
  
  // Event handlers
  onSearchChange(query: string): void {
    this.searchDebounce$.next(query);
    
    // Trigger autocomplete for queries >= 1 character
    if (query.trim().length >= 1) {
      this.customerSearchService.getAutocompleteSuggestions(query);
    }
  }
  
  onSearchSubmit(): void {
    const query = this.searchControl.value?.trim() || '';
    if (query.length >= 2) {
      this.customerSearchService.searchCustomers(query);
    }
  }
  
  onCustomerSelect(customer: CustomerListItem): void {
    this.selectedCustomerId = customer.id;
    this.router.navigate(['/customers', 'profile', customer.id]);
  }
  
  onClearSearch(): void {
    this.searchControl.setValue('');
    this.customerSearchService.clearSearch();
    this.searchInput?.nativeElement.focus();
  }
  
  // Voice search functionality
  async startVoiceSearch(): Promise<void> {
    if (this.isVoiceSearchActive) {
      this.stopVoiceSearch();
      return;
    }
    
    try {
      this.isVoiceSearchActive = true;
      const result = await this.searchService.startVoiceSearch();
      
      // Update search input with voice result
      this.searchControl.setValue(result);
      this.onSearchChange(result);
      
    } catch (error) {
      console.warn('Voice search failed:', error);
      // Could show user notification here
    } finally {
      this.isVoiceSearchActive = false;
    }
  }
  
  stopVoiceSearch(): void {
    this.searchService.stopVoiceSearch();
    this.isVoiceSearchActive = false;
  }
  
  // Filter methods
  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }
  
  onFilterChange(filterKey: string, value: any): void {
    this.customerSearchService.setFilter(filterKey as any, value);
  }
  
  onClearAllFilters(): void {
    this.customerSearchService.clearAllFilters();
  }
  
  onResetFilters(): void {
    this.customerSearchService.resetFilters();
  }
  
  // Utility methods
  getCreditStatusColor(status: string): string {
    const colors = {
      'Active': 'primary',
      'On_Hold': 'warn',
      'Suspended': 'accent',
      'Closed': 'disabled'
    };
    return colors[status as keyof typeof colors] || 'default';
  }
  
  getCustomerTypeIcon(type: string): string {
    const icons = {
      'Individual': 'person',
      'Corporate': 'business',
      'Small_Business': 'store',
      'Government': 'account_balance'
    };
    return icons[type as keyof typeof icons] || 'person_outline';
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  formatSearchTime(timeMs: number): string {
    if (timeMs < 1000) {
      return `${timeMs}ms`;
    }
    return `${(timeMs / 1000).toFixed(1)}s`;
  }
  
  getSuggestionDisplay(suggestion: string, query: string): string {
    if (!query) return suggestion;
    
    const index = suggestion.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return suggestion;
    
    const before = suggestion.substring(0, index);
    const match = suggestion.substring(index, index + query.length);
    const after = suggestion.substring(index + query.length);
    
    return `${before}<strong>${match}</strong>${after}`;
  }
  
  // Recent searches
  useRecentSearch(query: string): void {
    this.searchControl.setValue(query);
    this.onSearchChange(query);
  }
  
  // Results summary
  getResultsSummary(state: SearchState): string {
    if (!state.hasResults) {
      return state.error ? 'Search failed' : 'No results found';
    }
    
    if (state.totalResults === 0) {
      return 'No customers found';
    }
    
    if (state.query) {
      return `Found ${state.totalResults} customer${state.totalResults !== 1 ? 's' : ''} for "${state.query}" (${this.formatSearchTime(state.searchTime)})`;
    }
    
    return `${state.totalResults} customer${state.totalResults !== 1 ? 's' : ''} found`;
  }
}