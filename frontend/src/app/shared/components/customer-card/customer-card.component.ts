import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { 
  Customer,
  CustomerListItem,
  CustomerStatistics,
  CustomerType,
  CreditStatus
} from '../../../core/models/customer.model';

@Component({
  selector: 'app-customer-card',
  templateUrl: './customer-card.component.html',
  styleUrls: ['./customer-card.component.scss'],
  imports: [CommonModule]
})
export class CustomerCardComponent implements OnInit {
  @Input() customer: CustomerListItem | Customer | null = null;
  @Input() showStatistics = true;
  @Input() showActions = true;
  @Input() isSelectable = false;
  @Input() isSelected = false;
  @Input() highlightQuery = '';
  @Input() searchScore?: number;
  
  @Output() customerSelected = new EventEmitter<Customer>();
  @Output() customerAction = new EventEmitter<{action: string, customer: Customer}>();
  @Output() customerHovered = new EventEmitter<Customer>();
  
  isHovered = false;
  showTooltipTimeout: any;

  ngOnInit(): void {
    if (!this.customer) {
      throw new Error('Customer is required for app-customer-card component');
    }
  }

  onCardClick(): void {
    if (this.isSelectable && this.customer) {
      this.customerSelected.emit(this.customer as Customer);
    }
  }

  onCardHover(): void {
    this.isHovered = true;
    if (this.customer) {
      this.customerHovered.emit(this.customer as Customer);
    }
  }

  onCardLeave(): void {
    this.isHovered = false;
  }

  onActionClick(action: string, event: Event): void {
    event.stopPropagation();
    if (this.customer) {
      this.customerAction.emit({ action, customer: this.customer as Customer });
    }
  }

  getCustomerAvatar(): string {
    const customerType = this.customer?.customer_type || 'Individual';
    const icons: { [key in CustomerType]: string } = {
      'Individual': 'person',
      'Corporate': 'business',
      'Small_Business': 'store',
      'Government': 'account_balance'
    };
    return icons[customerType] || 'person_outline';
  }

  getCreditStatusColor(): string {
    if (!this.customer) return 'basic';
    
    const statusMap: { [key in CreditStatus]: string } = {
      'Active': 'primary',
      'On_Hold': 'warn',
      'Suspended': 'accent',
      'Closed': 'disabled'
    };
    
    return statusMap[this.customer.credit_status] || 'default';
  }

  getCreditStatusIcon(): string {
    if (!this.customer) return 'help_outline';
    
    const iconMap: { [key in CreditStatus]: string } = {
      'Active': 'check_circle',
      'On_Hold': 'pause',
      'Suspended': 'block',
      'Closed': 'close'
    };
    
    return iconMap[this.customer.credit_status] || 'help_outline';
  }

  formatCurrency(amount: number | undefined): string {
    if (typeof amount !== 'number') return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  }

  getFormattedAddress(): string {
    const customer = this.customer;
    if (!customer || !customer.address) return 'No address available';
    
    // Truncate long addresses
    const maxLength = 60;
    return customer.address.length > maxLength 
      ? customer.address.substring(0, maxLength) + '...'
      : customer.address;
  }

  getSearchScoreColor(score: number | undefined): string {
    if (typeof score !== 'number') return 'default';
    
    if (score >= 0.9) return 'accent';     // Excellent match
    if (score >= 0.7) return 'primary';    // Good match
    if (score >= 0.5) return 'default';    // Fair match
    return 'warn';                         // Poor match
  }

  getSearchScoreLabel(score: number | undefined): string {
    if (typeof score !== 'number') return 'No match';
    
    const percentage = Math.round(score * 100);
    
    if (score >= 0.9) return `${percentage}% Perfect`;
    if (score >= 0.8) return `${percentage}% Excellent`;
    if (score >= 0.7) return `${percentage}% Great`;
    if (score >= 0.6) return `${percentage}% Good`;
    if (score >= 0.5) return `${percentage}% Fair`;
    return `${percentage}% Poor`;
  }

  hasStatistics(): boolean {
    return this.showStatistics && !!(
      this.customer as CustomerListItem
    )?.statistics && !!(
      (this.customer as CustomerListItem).statistics.total_orders > 0 ||
      (this.customer as CustomerListItem).statistics.total_shipments > 0
    );
  }

  getStatistics(): CustomerStatistics | null {
    return (this.customer as CustomerListItem)?.statistics || null;
  }

  getPrimaryAction(): string {
    return this.isSelectable ? 'select' : 'view';
  }

  showActionButtons(): boolean {
    return this.showActions;
  }

  getCardClasses(): string[] {
    const classes = ['customer-card'];
    
    if (this.isSelectable) classes.push('selectable');
    if (this.isSelected) classes.push('selected');
    if (this.isHovered) classes.push('hovered');
    if (this.showStatistics && this.hasStatistics()) classes.push('with-stats');
    if (this.searchScore !== undefined && this.searchScore > 0) classes.push('with-score');
    
    return classes;
  }

  getCardTitle(): string {
    if (!this.customer) return 'Customer';
    
    return [
      this.customer.name,
      this.customer.email ? `(${this.customer.email})` : null,
      this.customer.phone ? this.customer.phone : null
    ].filter(Boolean).join(' - ');
  }

  getCardSubtitle(): string {
    if (!this.customer) return '';
    return `${this.customer.customer_type} • ${this.customer.credit_status}`;
  }

  getTooltipText(): string {
    if (!this.customer) return '';
    
    return `${this.customer.name}
Type: ${this.customer.customer_type}
Status: ${this.customer.credit_status}
${this.customer.email ? '\nEmail: ' + this.customer.email : ''}
${this.customer.phone ? '\nPhone: ' + this.customer.phone : ''}
${this.customer.address ? '\nAddress: ' + this.customer.address : ''}`;
  }

  showTooltip(): void {
    clearTimeout(this.showTooltipTimeout);
    this.showTooltipTimeout = setTimeout(() => {
      this.isHovered = true;
    }, 500);
  }

  hideTooltip(): void {
    clearTimeout(this.showTooltipTimeout);
    this.showTooltipTimeout = setTimeout(() => {
      this.isHovered = false;
    }, 100);
  }

  trackBySuggestion(index: number, suggestion: AutocompleteSuggestion): string {
    return suggestion.id.toString() + index;
  }
}