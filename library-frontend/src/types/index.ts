export interface Student {
  id: number;
  name: string;
  mobile_number: string;
  registered_at: string;
}

export interface ActiveBookingInfo {
  booking_id: number;
  seat_id: number;
  seat_number: number;
  subscription_start_date: string;
  is_24_hour_reservation: boolean;
  daily_start_time: string | null;
  daily_end_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentInfo {
  id: number;
  amount: number;
  payment_date: string;
  payment_type: 'cash' | 'online';
  period_start: string | null;
  period_end: string | null;
  is_adjustment: boolean;
  note: string | null;
  created_at: string;
}

export interface StudentDetail {
  id: number;
  name: string;
  mobile_number: string;
  registered_at: string;
  active_booking: ActiveBookingInfo | null;
  payment_history: PaymentInfo[];
}

export interface Seat {
  id: number;
  number: number;
  is_active: boolean;
}

export interface BookingSlot {
  booking_id: number;
  student_id: number;
  student_name: string | null;
  is_24_hour_reservation: boolean;
  daily_start_time: string | null;
  daily_end_time: string | null;
  subscription_start_date: string;
}

export interface SeatMatrixEntry {
  id: number;
  number: number;
  is_active: boolean;
  bookings: BookingSlot[];
}

export interface Booking {
  id: number;
  seat_id: number;
  student_id: number;
  subscription_start_date: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  is_active: boolean;
  is_24_hour_reservation: boolean;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  booking_id: number;
  student_id: number;
  amount: number;
  payment_date: string;
  payment_type: 'cash' | 'online';
  period_start: string | null;
  period_end: string | null;
  is_adjustment: boolean;
  note: string | null;
  created_at: string;
}

export interface RevenueResponse {
  month: string;
  total_revenue: number;
  transaction_count: number;
}

export interface PendingStudent {
  student_id: number;
  student_name: string;
  seat_number: number | null;
  booking_id: number;
  last_paid_until: string;
  days_overdue: number;
}

export interface RevenueSummary {
  total_revenue: number;
  total_transactions: number;
  average_payment: number;
  start_date: string;
  end_date: string;
}

export interface BookingCreatePayload {
  seat_id: number;
  student_id: number;
  subscription_start_date: string;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  is_24_hour_reservation: boolean;
  notes?: string | null;
}

export interface ChangeSlotPayload {
  seat_id?: number;
  is_24_hour_reservation?: boolean;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  notes?: string | null;
}

export interface RegularPaymentPayload {
  booking_id: number;
  amount: number;
  payment_date: string;
  payment_type: 'cash' | 'online';
  period_duration: number;
  period_unit: 'months' | 'days';
}

export interface AdjustmentPaymentPayload {
  booking_id: number;
  amount: number;
  payment_date: string;
  payment_type: 'cash' | 'online';
  note: string;
}
