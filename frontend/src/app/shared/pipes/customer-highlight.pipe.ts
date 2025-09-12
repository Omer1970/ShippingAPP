import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'customerHighlight',
  standalone: false
})
export class CustomerHighlightPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Highlights search terms within customer data
   * 
   * @param value - The text to highlight within
   * @param searchTerm - The search term to highlight
   * @param options - Configuration options for highlighting
   */
  transform(
    value: string,
    searchTerm: string,
    options: HighlightOptions = {}
  ): SafeHtml {
    if (!value || !searchTerm) {
      return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(value));
    }

    const config: Required<HighlightOptions> = {
      caseSensitive: false,
      wholeWords: false,
      highlightClass: 'search-highlight',
      escapeHtml: true,
      maxLength: 0,
      ...options
    };

    let result = value;

    if (config.escapeHtml) {
      result = this.escapeHtml(value);
    }

    if (config.maxLength && result.length > config.maxLength) {
      result = this.truncateText(result, config.maxLength);
    }

    const highlighted = this.highlightMatches(result, searchTerm, config);
    
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  private highlightMatches(
    text: string,
    searchTerm: string,
    config: Required<HighlightOptions>
  ): string {
    if (!searchTerm.trim()) {
      return text;
    }

    const searchTerms = this.getSearchTerms(searchTerm);
    let result = text;

    searchTerms.forEach(term => {
      if (!term.trim()) return;

      const pattern = this.createHighlightPattern(term, config);
      const replacement = `<span class="${config.highlightClass}">$&</span>`;

      result = result.replace(pattern, replacement);
    });

    return result;
  }

  private createHighlightPattern(term: string, config: Required<HighlightOptions>): RegExp {
    let pattern = term;

    // Escape special regex characters
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Add word boundaries if whole words only
    if (config.wholeWords) {
      pattern = `\\b${pattern}\\b`;
    }

    // Add flags
    const flags = config.caseSensitive ? 'g' : 'gi';

    return new RegExp(pattern, flags);
  }

  private getSearchTerms(searchTerm: string): string[] {
    // Split on whitespace and quotes to handle phrases
    const terms = [];
    const phraseMatches = searchTerm.match(/"([^"]+)"/g);
    
    if (phraseMatches) {
      // Handle quoted phrases
      phraseMatches.forEach(match => {
        const phrase = match.slice(1, -1).trim();
        if (phrase) {
          terms.push(phrase);
          searchTerm = searchTerm.replace(match, '');
        }
      });
    }

    // Handle individual words
    const words = searchTerm.trim().split(/\s+/).filter(word => word.length > 0);
    terms.push(...words);

    return terms;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    let truncated = text.substring(0, maxLength);
    
    // Try to break at word boundary
    if (text.charAt(maxLength) !== ' ' && text.lastIndexOf(' ', maxLength) > maxLength - 10) {
      const lastSpace = text.lastIndexOf(' ', maxLength);
      if (lastSpace > maxLength - 20) {
        truncated = text.substring(0, lastSpace);
      }
    }

    return truncated + '...';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export interface HighlightOptions {
  caseSensitive?: boolean;
  wholeWords?: boolean;
  highlightClass?: string;
  escapeHtml?: boolean;
  maxLength?: number;
}