import axios from 'axios';
import type {
  Student,
  StudentDetail,
  Seat,
  SeatMatrixEntry,
  Booking,
  Payment,
  RevenueResponse,
  PendingStudent,
  RevenueSummary,
  BookingCreatePayload,
  ChangeSlotPayload,
  RegularPaymentPayload,
  AdjustmentPaymentPayload,
} from '../types/index.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Helper to extract clean error message from FastAPI responses
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data) {
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      if (Array.isArray(data.detail)) {
        return data.detail.map((d: { msg?: string; message?: string }) => d.msg || d.message).join(', ');
      }
      if (data.message) {
        return data.message;
      }
    }
    return err.message || 'Network request failed';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
}

// ──────────────────────────────────────────────
// Seats Endpoints
// ──────────────────────────────────────────────
export const seatsApi = {
  getMatrix: async (): Promise<SeatMatrixEntry[]> => {
    const res = await apiClient.get<SeatMatrixEntry[]>('/seats/matrix');
    return res.data;
  },

  getAll: async (): Promise<Seat[]> => {
    const res = await apiClient.get<Seat[]>('/seats/');
    return res.data;
  },

  create: async (number: number): Promise<Seat> => {
    const res = await apiClient.post<Seat>('/seats/', { number });
    return res.data;
  },

  seed48: async (): Promise<{ message: string; created: number[]; skipped: number[] }> => {
    const res = await apiClient.post('/seats/seed');
    return res.data;
  },
};

// ──────────────────────────────────────────────
// Students Endpoints
// ──────────────────────────────────────────────
export const studentsApi = {
  getAll: async (): Promise<Student[]> => {
    const res = await apiClient.get<Student[]>('/students/');
    return res.data;
  },

  search: async (query: string): Promise<Student[]> => {
    if (!query.trim()) return [];
    const res = await apiClient.get<Student[]>('/students/search', {
      params: { q: query },
    });
    return res.data;
  },

  getById: async (id: number): Promise<StudentDetail> => {
    const res = await apiClient.get<StudentDetail>(`/students/${id}`);
    return res.data;
  },

  create: async (name: string, mobile_number: string): Promise<Student> => {
    const res = await apiClient.post<Student>('/students/', {
      name: name.trim(),
      mobile_number: mobile_number.trim(),
    });
    return res.data;
  },
};

// ──────────────────────────────────────────────
// Bookings Endpoints
// ──────────────────────────────────────────────
export const bookingsApi = {
  getAll: async (): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>('/bookings/');
    return res.data;
  },

  create: async (payload: BookingCreatePayload): Promise<Booking> => {
    const res = await apiClient.post<Booking>('/bookings/', payload);
    return res.data;
  },

  cancel: async (bookingId: number): Promise<Booking> => {
    const res = await apiClient.put<Booking>(`/bookings/${bookingId}/cancel`);
    return res.data;
  },

  changeSlot: async (bookingId: number, payload: ChangeSlotPayload): Promise<Booking> => {
    const res = await apiClient.put<Booking>(`/bookings/${bookingId}/change-slot`, payload);
    return res.data;
  },

  getSeatSchedule: async (seatId: number): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>(`/bookings/seat/${seatId}/schedule`);
    return res.data;
  },

  getStudentHistory: async (studentId: number): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>(`/bookings/student/${studentId}/history`);
    return res.data;
  },
};

// ──────────────────────────────────────────────
// Payments Endpoints
// ──────────────────────────────────────────────
export const paymentsApi = {
  getAll: async (params?: { booking_id?: number; student_id?: number }): Promise<Payment[]> => {
    const res = await apiClient.get<Payment[]>('/payments/', { params });
    return res.data;
  },

  createRegular: async (payload: RegularPaymentPayload): Promise<Payment> => {
    const res = await apiClient.post<Payment>('/payments/', payload);
    return res.data;
  },

  createAdjustment: async (payload: AdjustmentPaymentPayload): Promise<Payment> => {
    const res = await apiClient.post<Payment>('/payments/adjustment', payload);
    return res.data;
  },

  delete: async (paymentId: number): Promise<void> => {
    await apiClient.delete(`/payments/${paymentId}`);
  },
};

// ──────────────────────────────────────────────
// Dashboard Endpoints
// ──────────────────────────────────────────────
export const dashboardApi = {
  getRevenue: async (month: string): Promise<RevenueResponse> => {
    const res = await apiClient.get<RevenueResponse>('/dashboard/revenue', {
      params: { month },
    });
    return res.data;
  },

  getPending: async (): Promise<PendingStudent[]> => {
    const res = await apiClient.get<PendingStudent[]>('/dashboard/pending');
    return res.data;
  },

  getRevenueSummary: async (startDate: string, endDate: string): Promise<RevenueSummary> => {
    const res = await apiClient.get<RevenueSummary>('/dashboard/revenue-summary', {
      params: { start_date: startDate, end_date: endDate },
    });
    return res.data;
  },
};
