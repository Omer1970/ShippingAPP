/**
 * Schedule models and interfaces for calendar and scheduling system
 */

import { Customer } from './customer.model';
import { User } from './user.model';
import { Shipment } from './shipment.model';

/**
 * Delivery Schedule Interface for calendar integration
 */
export interface DeliverySchedule {
  id: number;
  shipment_id: number;
  driver_id: number;
  driver_name?: string;
  delivery_date: string;
  start_time: string;
  end_time: string;
  time_slot: string;
  estimated_duration: number;
  estimated_distance: number;
  route_order: number;
  sequence_current_step: number;
  sequence_total_steps: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  progress_percentage: number;
  can_be_modified: boolean;
  metadata?: any;
  notes?: string;
  shipment?: Shipment;
  driver?: User;
  created_at: string;
  updated_at: string;
  route_plan_id?: number;
}

/**
 * Delivery Time Slot Interface for time slot management
 */
export interface DeliveryTimeSlot {
  id: number;
  driver_id: number;
  driver_name?: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  slot_label: string;
  capacity: number;
  booked: number;
  availability: 'available' | 'limited' | 'full' | 'blocked';
  is_available: boolean;
  is_limited: boolean;
  is_full: boolean;
  is_blocked: boolean;
  available_capacity: number;
  utilization_percentage: number;
  is_recurring: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly';
  metadata?: any;
  display_label: string;
  time_slot: string;
  created_at: string;
  updated_at: string;
}

/**
 * Route Plan Interface for route optimization
 */
export interface RoutePlan {
  id: number;
  driver_id: number;
  driver_name?: string;
  route_date: string;
  optimized_route: number[];
  route_status: 'planned' | 'active' | 'completed' | 'cancelled';
  total_distance?: number;
  estimated_time?: number;
  efficiency_score?: number;
  efficiency_percentage?: number;
  waypoints?: RouteWaypoint[];
  alternatives?: AlternativeRoute[];
  optimization_algorithm: string;
  is_optimized: boolean;
  can_start: boolean;
  optimized_at?: string;
  started_at?: string;
  completed_at?: string;
  traffic_model?: string;
  route_progress: number;
  delivery_schedules?: DeliverySchedule[];
  metadata?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Route Waypoint Interface
 */
export interface RouteWaypoint {
  sequence: number;
  latitude: number;
  longitude: number;
  estimated_latitude?: number;
  estimated_longitude?: number;
  address: string;
  delivery_id?: number;
}

/**
 * Alternative Route Interface
 */
export interface AlternativeRoute {
  route_id: string;
  total_distance: number;
  estimated_time: number;
  efficiency_score: number;
  description: string;
  priority: number;
}

/**
 * Calendar Data Interface for calendar view aggregation
 */
export interface CalendarData {
  date: string;
  schedules: DeliverySchedule[];
  time_slots: DeliveryTimeSlot[];
  route_plans: CalendarRoutePlan[];
  summary: CalendarSummary;
}

/**
 * Calendar Summary Interface
 */
export interface CalendarSummary {
  total_schedules: number;
  active_schedules: number;
  completed_schedules: number;
  available_time_slots: number;
  active_routes: number;
}

/**
 * Calendar Route Plan (simplified for calendar view)
 */
export interface CalendarRoutePlan {
  id: number;
  driver_id: number;
  driver_name: string;
  route_status: string;
  efficiency_score?: number;
  total_distance?: number;
  waypoints_count: number;
  can_start: boolean;
}

/**
 * Driver Availability Interface
 */
export interface DriverAvailability {
  driver_id: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
  availability: {
    time_slots: DeliveryTimeSlot[];
    occupied_slots: number;
    route_plans: CalendarRoutePlan[];
  };
}

/**
 * Schedule Conflicts Interface
 */
export interface ScheduleConflicts {
  date: string;
  conflicts_count: number;
  conflicts: ScheduleConflict[];
}

/**
 * Schedule Conflict Interface
 */
export interface ScheduleConflict {
  type: 'time_overlap' | 'overbooked_slot';
  driver_id: number;
  driver_name: string;
  time_slot?: string;
  conflicting_schedules?: DeliverySchedule[];
  capacity?: number;
  booked?: number;
  overage?: number;
}

/**
 * Route Suggestions Interface
 */
export interface RouteSuggestions {
  delivery_schedule: {
    id: number;
    address: string;
    time_slot: string;
    estimated_duration: number;
    route_order: number;
    is_planned: boolean;
  };
  current_route: CurrentRoute | null;
  suggested_routes: any[];
  alternate_deliveries: AlternateDelivery[];
  optimization_suggestions: OptimizationSuggestions;
}

/**
 * Current Route Interface
 */
export interface CurrentRoute {
  route_plan_id: number;
  route_status: string;
  efficiency_score?: number;
  total_deliveries: number;
  route_progress: number;
}

/**
 * Alternate Delivery Interface
 */
export interface AlternateDelivery {
  id: number;
  address: string;
  time_slot: string;
  route_order: number;
  distance_from_current?: number;
  optimal_position: number;
}

/**
 * Optimization Suggestions Interface
 */
export interface OptimizationSuggestions {
  optimal_time_slot: OptimalTimeSlot;
  optimal_route_order: OptimalRouteOrder;
  potential_efficiency_gain: EfficiencyGain;
}

/**
 * Optimal Time Slot Interface
 */
export interface OptimalTimeSlot {
  suggested_slot: string | null;
  current_time_slot: string;
  efficiency_benefit: number;
  reason: string;
}

/**
 * Optimal Route Order Interface
 */
export interface OptimalRouteOrder {
  current_order: number;
  suggested_order: number;
  reason: string;
  potential_efficiency_gain: number;
}

/**
 * Efficiency Gain Interface
 */
export interface EfficiencyGain {
  time_saved_potential: number;
  distance_saved_potential: number;
  fuel_efficiency_improvement: number;
  customer_satisfaction_improvement: string;
}

/**
 * Route Optimization Request Interface
 */
export interface RouteOptimizationRequest {
  route_plan_id: number;
  optimization_algorithm?: 'google_maps' | 'osrm' | 'custom';
  constraints?: RouteConstraints;
}

/**
 * Route Constraints Interface
 */
export interface RouteConstraints {
  time_window_start?: string;
  time_window_end?: string;
  max_distance?: number;
  max_duration?: number;
  traffic_model?: 'best_guess' | 'pessimistic' | 'optimistic';
}

/**
 * Route Optimization Result Interface
 */
export interface RouteOptimizationResult {
  success: boolean;
  route_plan: RoutePlan;
  optimization_summary: OptimizationSummary;
  algorithm_used: string;
}

/**
 * Optimization Summary Interface
 */
export interface OptimizationSummary {
  original_distance: number;
  optimized_distance: number;
  distance_saved: number;
  efficiency_improvement: number;
  original_time: number;
  optimized_time: number;
  time_saved: number;
}

/**
 * Daily Overview Interface
 */
export interface DailyOverview {
  date: string;
  schedules: {
    total: number;
    by_status: Record<string, number>;
    by_driver: DriverScheduleSummary[];
  };
  time_slots: {
    total: number;
    available: number;
    limited: number;
    full: number;
    blocked: number;
    total_capacity: number;
    booked_capacity: number;
    available_capacity: number;
    utilization_percentage: number;
  };
  routes: {
    total: number;
    by_status: Record<string, number>;
    ready_to_start: number;
  };
}

/**
 * Driver Schedule Summary Interface
 */
export interface DriverScheduleSummary {
  driver_id: number;
  driver_name: string;
  schedule_count: number;
  by_status: Record<string, number>;
}

/**
 * Time Slot Availability Interface
 */
export interface TimeSlotAvailability {
  date: string;
  driver_id: number;
  driver_name: string;
  total_slots: number;
  available_slots: number;
  limited_slots: number;
  full_slots: number;
  blocked_slots: number;
  time_slots: DeliveryTimeSlot[];
}

/**
 * Time Slot Configuration Interface
 */
export interface TimeSlotConfiguration {
  driver_id: number;
  default_capacity: number;
  slot_duration: number; // minutes
  working_hours_start: string;
  working_hours_end: string;
  break_times: BreakTime[];
  days_of_week: number[]; // 0 = Sunday, 6 = Saturday
}

/**
 * Break Time Interface
 */
export interface BreakTime {
  start_time: string;
  end_time: string;
}

/**
 * Route Optimization Request Interface
 */
export interface RouteOptimizationRequest {
  driver_id: number;
  delivery_ids: number[];
  optimization_criteria?: 'time' | 'distance' | 'fuel_efficiency' | 'driver_preference';
  constraints?: {
    max_distance?: number;
    max_time_hours?: number;
    avoid_tolls?: boolean;
    avoid_highways?: boolean;
  };
  algorithm?: 'google_maps' | 'osrm' | 'nearest_neighbor' | 'genetic';
  traffic_model?: 'best_guess' | 'pessimistic' | 'optimistic';
  waypoints?: RouteWaypoint[];
}

/**
 * Route Reorder Request Interface
 */
export interface RouteReorderRequest {
  delivery_order: number[];
  optimize_after_reorder?: boolean;
  reason?: string;
}

/**
 * Bulk Time Slot Update Interface
 */
export interface BulkTimeSlotUpdate {
  slot_id: number;
  availability?: 'available' | 'limited' | 'full' | 'blocked';
  capacity?: number;
  notes?: string;
}

/**
 * Recurring Time Slot Request Interface
 */
export interface RecurringTimeSlotRequest {
  driver_id: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  recurrence_pattern: 'daily' | 'weekly' | 'monthly';
  recurrence_interval?: number;
  recurrence_days?: number[]; // 0 = Sunday, 6 = Saturday
  capacity?: number;
}

/**
 * Calendar View Mode Type
 */
export type CalendarViewMode = 'day' | 'week' | 'month';

/**
 * Calendar Summary Interface
 */
export interface CalendarSummary {
  date_range: {
    start: string;
    end: string;
  };
  total_schedules: number;
  by_status: Record<string, number>;
  by_driver: DriverScheduleSummary[];
  utilization_metrics: {
    average_slot_utilization: number;
    optimized_routes: number;
    efficiency_score: number;
  };
}

/**
 * Schedule Conflicts Interface
 */
export interface ScheduleConflicts {
  conflicts: ScheduleConflict[];
  warnings: ScheduleWarning[];
  can_proceed: boolean;
}

/**
 * Schedule Conflict Interface
 */
export interface ScheduleConflict {
  conflict_type: 'time_overlap' | 'driver_unavailable' | 'route_inefficiency';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_schedules: number[];
  suggested_resolution: string;
}

/**
 * Schedule Warning Interface
 */
export interface ScheduleWarning {
  warning_type: 'high_traffic' | 'weather_condition' | 'driver_overtime';
  description: string;
  affected_schedules: number[];
  recommendation: string;
}