import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarDeliveryComponent } from './calendar-delivery.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

import { SharedModule } from '../../shared/shared.module';
import { CoreModule } from '../../core/core.module';

const routes: Routes = [
  {
    path: '',
    component: CalendarDeliveryComponent
  }
];

@NgModule({
  declarations: [
    CalendarDeliveryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    CoreModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    RouterModule.forChild(routes)
  ]
})
export class CalendarDeliveryModule { }