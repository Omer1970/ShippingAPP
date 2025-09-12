import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Observable } from 'rxjs';

import { 
  AutocompleteSuggestion,
  AutocompleteResponse,
  SearchHighlight
} from '../../../core/models/search.model';

@Component({
  selector: 'app-search-autocomplete',
  templateUrl: './search-autocomplete.component.html',
  styleUrls: ['./search-autocomplete.component.scss']
})
export class SearchAutocompleteComponent {
  @Input() suggestions: AutocompleteSuggestion[] = [];
  @Input() isLoading = false;
  @Input() disabled = false;
  @Input() minCharacters = 2;
  @Input() showWhenEmpty = false;
  @Input() highlightMatches = true;
  @Input() position: 'below' | 'above' = 'below';
  @Input() allowVoiceInput = true;
  @Input() placeholder?: string = '';
  @Input() debounceDelay = 300;
  
  @Output() suggestionSelected = new EventEmitter<AutocompleteSuggestion>();
  @Output() textChanged = new EventEmitter<string>();
  @Output() voiceSearchStarted = new EventEmitter<void>();
  @Output() voiceSearchStopped = new EventEmitter<void>();
  
  @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;
  @ViewChild('containerElement') containerElement!: ElementRef<HTMLElement>;
  
  inputValue = '';
  showDropdown = false;
  highlightIndex = -1;
  showVoiceControls = false;
  isListening = false;
  typedQuery = '';
  
  private readonly maxVisibleSuggestions = 8;
  private debounceTimer: any;

  get visibleSuggestions(): AutocompleteSuggestion[] {
    return this.suggestions.slice(0, this.maxVisibleSuggestions);
  }

  get hasSuggestions(): boolean {
    return this.visibleSuggestions.length > 0 && 
           (this.inputValue.length >= this.minCharacters || this.showWhenEmpty);
  }

  get shouldShowDropdown(): boolean {
    return this.showDropdown && (this.hasSuggestions || this.isLoading);
  }

  get dropdownPositionClass(): string {
    return `dropdown-${this.position}`;
  }

  get voiceInputEnabled(): boolean {
    return this.allowVoiceInput && 'webkitSpeechRecognition' in window;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.containerElement?.nativeElement.contains(event.target as Node)) {
      this.hideDropdown();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.shouldShowDropdown) return;

    const visibleSuggestions = this.visibleSuggestions;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightIndex = Math.min(this.highlightIndex + 1, visibleSuggestions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightIndex = Math.max(this.highlightIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightIndex >= 0) {
          this.selectSuggestion(visibleSuggestions[this.highlightIndex]);
        }
        break;
      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  onInputFocus(): void {
    if (this.hasSuggestions || this.isLoading) {
      this.showDropdown = true;
    }
  }

  onInputChange(event: any): void {
    const value = event.target.value;
    
    // Clear timeout
    clearTimeout(this.debounceTimer);
    
    // Update typed query for highlighting
    this.typedQuery = value;
    this.inputValue = value;
    
    // Hide dropdown if input is too short
    if (value.length < this.minCharacters && !this.showWhenEmpty) {
      this.hideDropdown();
      return;
    }
    
    // Show dropdown while typing
    if (value.length > 0) {
      this.showDropdown = true;
    }
    
    // Emitted debounced text change
    this.debounceTimer = setTimeout(() => {
      this.textChanged.emit(value);
    }, this.debounceDelay);
  }

  onInputBlur(): void {
    // Small delay to allow for click events on suggestions
    setTimeout(() => {
      this.hideDropdown();
    }, 150);
  }

  async onVoiceClick(): Promise<void> {
    if (!this.voiceInputEnabled) {
      this.showVoiceControls = !this.showVoiceControls;
      return;
    }

    if (this.isListening) {
      this.stopVoiceSearch();
    } else {
      this.startVoiceSearch();
    }
  }

  private startVoiceSearch(): void {
    this.isListening = true;
    this.voiceSearchStarted.emit();
    
    // Simple speech recognition implementation
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      this.isListening = true;
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.inputValue = transcript;
      this.textChanged.emit(transcript);
      this.isListening = false;
    };
    
    recognition.onerror = (event: any) => {
      console.warn('Voice search error:', event.error);
      this.isListening = false;
    };
    
    recognition.onend = () => {
      this.isListening = false;
    };
    
    recognition.start();
  }

  private stopVoiceSearch(): void {
    this.isListening = false;
    this.voiceSearchStopped.emit();
  }

  selectSuggestion(suggestion: AutocompleteSuggestion): void {
    this.highlightIndex = this.suggestions.indexOf(suggestion);
    this.suggestionSelected.emit(suggestion);
    this.updateInputValue(suggestion);
    this.hideDropdown();
  }

  updateInputValue(suggestion: AutocompleteSuggestion): void {
    this.inputValue = suggestion.name || suggestion.text || '';
    this.typedQuery = this.inputValue;
  }

  showDropdown(): void {
    if (!this.hasSuggestions && !this.isLoading) return;
    this.showDropdown = true;
    this.highlightIndex = -1;
  }

  hideDropdown(): void {
    this.showDropdown = false;
    this.highlightIndex = -1;
  }

  clearInput(): void {
    this.inputValue = '';
    this.typedQuery = '';
    this.hideDropdown();
    this.textChanged.emit('');
  }

  focus(): void {
    setTimeout(() => {
      this.inputElement?.nativeElement.focus();
    });
  }

  getSuggestionHighlight(suggestion: AutocompleteSuggestion): SearchHighlight {
    if (!this.highlightMatches || !this.typedQuery) {
      return this.createHighlight(suggestion.name || suggestion.text || '');
    }
    
    const text = suggestion.name || suggestion.text || '';
    const query = this.typedQuery.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(query);
    
    if (index === -1) {
      return this.createHighlight(text);
    }
    
    return {
      text: text,
      highlight_start: index,
      highlight_end: index + query.length
    };
  }

  private createHighlight(text: string): SearchHighlight {
    return {
      text: text,
      highlight_start: undefined,
      highlight_end: undefined
    };
  }

  reset(): void {
    this.inputValue = '';
    this.typedQuery = '';
    this.hideDropdown();
    this.highlightIndex = -1;
    this.isListening = false;
  }

  getStyleClasses(): string[] {
    const classes = ['search-autocomplete'];
    
    if (this.disabled) classes.push('disabled');
    if (this.isListening) classes.push('voice-listening');
    if (this.hasSuggestions) classes.push('has-suggestions');
    
    return classes;
  }

  // Accessibility helpers
  getAriaLabel(): string {
    return 'Customer search with autocomplete suggestions';
  }

  getAriaDescribedBy(): string {
    return 'search-help-text';
  }

  getInputRole(): string {
    return 'searchbox';
  }

  getSuggestionsRole(): string {
    return 'listbox';
  }

  getSuggestionItemRole(): string {
    return 'option';
  }

  isSuggestionHighlighted(suggestion: AutocompleteSuggestion): boolean {
    return this.suggestions.indexOf(suggestion) === this.highlightIndex;
  }

  onEnterPress(): void {
    const visibleSuggestions = this.visibleSuggestions;
    if (this.highlightIndex >= 0 && visibleSuggestions[this.highlightIndex]) {
      this.selectSuggestion(visibleSuggestions[this.highlightIndex]);
    } else if (this.inputValue.trim().length >= this.minCharacters) {
      this.textChanged.emit(this.inputValue.trim());
    }
  }

  getVoiceTooltip(): string {
    if (this.isListening) {
      return 'Stop voice search';
    }
    if ('webkitSpeechRecognition' in window) {
      return 'Start voice search';
    }
    return 'Voice search not supported';
  }

  hasSuggestionDetails(suggestion: AutocompleteSuggestion): boolean {
    return !!(suggestion.email || suggestion.customer_type);
  }

  getHighlightedText(highlight: SearchHighlight): string {
    if (highlight.highlight_start === undefined || highlight.highlight_end === undefined) {
      return this.escapeHtml(highlight.text);
    }

    const { text, highlight_start, highlight_end } = highlight;
    const before = this.escapeHtml(text.substring(0, highlight_start));
    const match = this.escapeHtml(text.substring(highlight_start, highlight_end));
    const after = this.escapeHtml(text.substring(highlight_end));

    return `${before}<strong>${match}</strong>${after}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  padString(text: string): string {
    return text ? text : '';
  }
}