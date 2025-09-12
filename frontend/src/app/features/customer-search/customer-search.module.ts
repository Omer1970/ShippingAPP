import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

// Components
import { CustomerSearchComponent } from './components/customer-search/customer-search.component';
import { CustomerProfileComponent } from './components/customer-profile/customer-profile.component';

// Services
import { CustomerSearchService } from './services/customer-search.service';

// Guards
import { AuthGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: CustomerSearchComponent,
    canActivate: [AuthGuard],
    data: { title: 'Customer Search' }
  },
  {
    path: 'profile/:id',
    component: CustomerProfileComponent,
    canActivate: [AuthGuard],
    data: { title: 'Customer Profile' }
  }
];

@NgModule({
  declarations: [
    CustomerSearchComponent,
    CustomerProfileComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    
    // Angular Material modules
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  providers: [
    CustomerSearchService
  ]
})
export class CustomerSearchModule { }