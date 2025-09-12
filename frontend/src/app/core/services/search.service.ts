import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, of, throwError } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { voiceRecognition } from '../utils/voice-recognition';
import {
  SearchRequest,
  SearchResponse,
  AutocompleteRequest,
  AutocompleteResponse,
  AutocompleteSuggestion,
  GlobalSearchRequest,
  GlobalSearchResponse,
  SearchHistoryItem,
  RecentSearch,
  SearchAnalytics,
  CustomerSearchResult,
  OrderSearchResult,
  ShipmentSearchResult
} from '../models/search.model';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = environment.apiUrl;
  private searchSubject = new Subject<string>();
  private autocompleteSubject = new Subject<string>();
  private globalSearchSubject = new Subject<GlobalSearchRequest>();
  
  public searchResults$ = this.searchSubject.asObservable();
  public autocompleteSuggestions$ = this.autocompleteSubject.asObservable();
  public globalSearchResults$ = this.globalSearchSubject.asObservable();

  private recentSearchesSubject = new BehaviorSubject<RecentSearch[]>(this.loadRecentSearches());
  public recentSearches$ = this.recentSearchesSubject.asObservable();

  private searchHistorySubject = new BehaviorSubject<SearchHistoryItem[]>(this.loadSearchHistory());
  public searchHistory$ = this.searchHistorySubject.asObservable();

  private isListeningSubject = new BehaviorSubject<boolean>(false);
  public isListening$ = this.isListeningSubject.asObservable();

  private isSearchingSubject = new BehaviorSubject<boolean>(false);
  public isSearching$ = this.isSearchingSubject.asObservable();

  private lastSearchResultsSubject = new BehaviorSubject<any>(null);
  public lastSearchResults$ = this.lastSearchResultsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    this.setupReactiveSearches();
  }

  /**
   * Setup reactive search streams with debouncing
   */
  private setupReactiveSearches(): void {
    // Regular search with 500ms debouncing
    this.searchResults$ = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => this.isSearchingSubject.next(true)),
      switchMap(query => this.performSearch(query)),
      tap(() => this.isSearchingSubject.next(false))
    );

    // Autocomplete with 300ms debouncing for super-fast response
    this.autocompleteSuggestions$ = this.autocompleteSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.performAutocomplete(query)),
      catchError(() => of({ suggestions: [] }))
    );

    // Global search with 400ms debouncing
    this.globalSearchResults$ = this.globalSearchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      tap(() => this.isSearchingSubject.next(true)),
      switchMap(request => this.performGlobalSearch(request)),
      tap(() => this.isSearchingSubject.next(false))
    );
  }

  /**
   * Perform customer search
   */
  private performSearch(query: string): Observable<any> {
    if (!query || query.length < 2) {
      return of({ customers: [], metadata: { total_results: 0, search_time_ms: 0 } });
    }

    const params = new HttpParams().set('q', query).set('limit', '50');

    return this.http.get<SearchResponse<CustomerSearchResult>>(`${this.apiUrl}/customers/search`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        this.lastSearchResultsSubject.next(data);
        this.addToSearchHistory(query, data.customers.length);
      }),
      catchError(this.handleSearchError)
    );
  }

  /**
   * Perform autocomplete search
   */
  private performAutocomplete(query: string): Observable<any> {
    if (!query || query.length < 1) {
      return of({ suggestions: [], metadata: { total_suggestions: 0, search_time_ms: 0 } });
    }

    const params = new HttpParams().set('q', query);

    return this.http.get<AutocompleteResponse>(`${this.apiUrl}/customers/autocomplete`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        console.log(`Autocomplete returned ${data.suggestions.length} suggestions in ${data.metadata.search_time_ms}ms`);
      }),
      catchError(error => of({ suggestions: [], metadata: { total_suggestions: 0, search_time_ms: 0 } }))
    );
  }

  /**
   * Perform global search across multiple entities
   */
  private performGlobalSearch(request: GlobalSearchRequest): Observable<any> {
    if (!request.q || request.q.length < 2) {
      return of({ customers: [], orders: [], shipments: [], metadata: {} });
    }

    let params = new HttpParams().set('q', request.q);
    if (request.limit) params = params.set('limit', request.limit.toString());
    if (request.type) params = params.set('type', request.type);

    return this.http.get<GlobalSearchResponse>(`${this.apiUrl}/search`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleSearchError)
    );
  }

  /**
   * Trigger customer search
   */
  searchCustomers(query: string): void {
    this.saveRecentSearch(query);
    this.searchSubject.next(query);
  }

  /**
   * Trigger autocomplete search
   */
  getAutocompleteSuggestions(query: string): void {
    this.autocompleteSubject.next(query);
  }

  /**
   * Trigger global search
   */
  globalSearch(request: GlobalSearchRequest): void {
    this.globalSearchSubject.next(request);
  }

  /**
   * Voice search functionality
   */
  startVoiceSearch(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isListeningSubject.next(true);
      
      voiceRecognition.start({
        language: 'en-US',
        timeout: 10000,
        continuous: false,
        onResult: (result: string) => {
          this.ngZone.run(() => {
            this.isListeningSubject.next(false);
            resolve(result);
            
            // Automatically trigger autocomplete with voice result
            this.getAutocompleteSuggestions(result);
          });
        },
        onError: (error: string) => {
          this.ngZone.run(() => {
            this.isListeningSubject.next(false);
            reject(error);
          });
        },
        onTimeout: () => {
          this.ngZone.run(() => {
            this.isListeningSubject.next(false);
            reject('Voice recognition timeout');
          });
        }
      });
    });
  }

  /**
   * Stop voice search
   */
  stopVoiceSearch(): void {
    voiceRecognition.stop();
    this.isListeningSubject.next(false);
  }

  /**
   * Save search to recent searches
   */
  private saveRecentSearch(query: string): void {
    if (!query || query.length < 2) return;

    const recent = this.recentSearchesSubject.value;
    const existingIndex = recent.findIndex(rs => rs.query.toLowerCase() === query.toLowerCase());
    
    if (existingIndex !== -1) {
      // Update existing search frequency
      recent[existingIndex].frequency++;
      recent[existingIndex].timestamp = new Date().toISOString();
    } else {
      // Add new search
      recent.unshift({
        query,
        timestamp: new Date().toISOString(),
        frequency: 1
      });
    }

    // Keep only top 10 recent searches
    const updatedRecent = recent.slice(0, 10);
    this.recentSearchesSubject.next(updatedRecent);
    this.saveRecentSearches(updatedRecent);
  }

  /**
   * Add to search history
   */
  private addToSearchHistory(query: string, resultCount: number): void {
    const history = this.searchHistorySubject.value;
    const historyItem: SearchHistoryItem = {
      id: this.generateId(),
      query,
      timestamp: new Date().toISOString(),
      result_count: resultCount
    };

    history.unshift(historyItem);
    
    // Keep only last 50 searches
    const updatedHistory = history.slice(0, 50);
    this.searchHistorySubject.next(updatedHistory);
    this.saveSearchHistory(updatedHistory);
  }

  /**
   * Get recent searches
   */
  getRecentSearches(): RecentSearch[] {
    return this.recentSearchesSubject.value;
  }

  /**
   * Get search history
   */
  getSearchHistory(): SearchHistoryItem[] {
    return this.searchHistorySubject.value;
  }

  /**
   * Clear recent searches
   */
  clearRecentSearches(): void {
    this.recentSearchesSubject.next([]);
    this.saveRecentSearches([]);
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistorySubject.next([]);
    this.saveSearchHistory([]);
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics(): Observable<SearchAnalytics> {
    const history = this.searchHistorySubject.value;
    
    return of({
      total_searches: history.length,
      average_response_time: this.calculateAverageResponseTime(history),
      most_searched_terms: this.getMostSearchedTerms(history),
      search_success_rate: this.calculateSuccessRate(history),
      popular_customers: this.getPopularCustomers(history)
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Load recent searches from localStorage
   */
  private loadRecentSearches(): RecentSearch[] {
    try {
      const stored = localStorage.getItem('customer_recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
      return [];
    }
  }

  /**
   * Load search history from localStorage
   */
  private loadSearchHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem('customer_search_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }

  /**
   * Save recent searches to localStorage
   */
  private saveRecentSearches(recent: RecentSearch[]): void {
    try {
      localStorage.setItem('customer_recent_searches', JSON.stringify(recent));
    } catch (error) {
      console.warn('Failed to save recent searches:', error);
    }
  }

  /**
   * Save search history to localStorage
   */
  private saveSearchHistory(history: SearchHistoryItem[]): void {
    try {
      localStorage.setItem('customer_search_history', JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(history: SearchHistoryItem[]): number {
    if (history.length === 0) return 0;
    // This would be calculated from actual performance metrics
    return 150; // milliseconds
  }

  /**
   * Get most searched terms
   */
  private getMostSearchedTerms(history: SearchHistoryItem[]): string[] {
    const termCounts: { [key: string]: number } = {};
    history.forEach(item => {
      termCounts[item.query] = (termCounts[item.query] || 0) + 1;
    });
    
    return Object.entries(termCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([term]) => term);
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(history: SearchHistoryItem[]): number {
    if (history.length === 0) return 0;
    
    const successful = history.filter(item => item.result_count > 0).length;
    return (successful / history.length) * 100;
  }

  /**
   * Get popular customers
   */
  private getPopularCustomers(history: SearchHistoryItem[]): number[] {
    // This would track which customers are clicked/selected most
    return [];
  }

  /**
   * Handle search errors
   */
  private handleSearchError = (error: any): Observable<any> => {
    console.error('Search error:', error);
    return throwError(() => error);
  };
}