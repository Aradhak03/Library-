import { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Calendar,
  Armchair,
  Clock,
  ArrowRightLeft,
  XCircle,
  IndianRupee,
  Receipt,
  Plus,
  RefreshCw,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { studentsApi, bookingsApi, getErrorMessage } from '../../api/client.ts';
import type { StudentDetail } from '../../types/index.ts';
import { formatTime12Hour } from '../../utils/time.ts';
import { useModals } from '../../context/ModalContext.tsx';

interface StudentDrawerProps {
  studentId: number | null;
  onClose: () => void;
}

export const StudentDrawer = ({ studentId, onClose }: StudentDrawerProps) => {
  const { openBookingModal, openChangeSlotModal, openPaymentModal, triggerRefresh } = useModals();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!studentId) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await studentsApi.getById(studentId);
        setStudent(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [studentId]);

  if (!studentId) return null;

  const handleCancelBooking = async (bookingId: number) => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this seat booking? The seat will immediately become free for other students.'
    );
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      await bookingsApi.cancel(bookingId);
      triggerRefresh();
      // Re-fetch student details
      const updated = await studentsApi.getById(studentId);
      setStudent(updated);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
                {student ? student.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {student?.name || 'Student Profile'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span className="font-mono text-slate-300">{student?.mobile_number}</span>
                  <span>•</span>
                  <span>ID #{studentId}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading student details & ledger...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            ) : student ? (
              <>
                {/* 1. Active Booking Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Current Seat Allocation
                    </h3>
                  </div>

                  {student.active_booking ? (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-850 border border-slate-700/80 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Armchair className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-white">
                              Seat #{student.active_booking.seat_number}
                            </h4>
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active Subscription
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {student.active_booking.is_24_hour_reservation ? '24 Hours' : 'Daily Slot'}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="pt-2 grid grid-cols-2 gap-2 text-xs border-t border-slate-700/50">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Daily Hours</span>
                          <span className="font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {student.active_booking.is_24_hour_reservation
                              ? 'Full 24-Hour Pass'
                              : `${formatTime12Hour(student.active_booking.daily_start_time)} – ${formatTime12Hour(student.active_booking.daily_end_time)}`}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[11px]">Subscribed Since</span>
                          <span className="font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {student.active_booking.subscription_start_date}
                          </span>
                        </div>
                      </div>

                      {student.active_booking.notes && (
                        <div className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <strong>Note:</strong> {student.active_booking.notes}
                        </div>
                      )}

                      {/* Action Buttons on Booking */}
                      <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
                        <button
                          onClick={() => {
                            if (!student.active_booking) return;
                            openChangeSlotModal({
                              bookingId: student.active_booking.booking_id,
                              studentName: student.name,
                              currentSeatId: student.active_booking.seat_id,
                              currentSeatNumber: student.active_booking.seat_number,
                              currentStartTime: student.active_booking.daily_start_time,
                              currentEndTime: student.active_booking.daily_end_time,
                              currentIs24h: student.active_booking.is_24_hour_reservation,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Change Timing / Seat</span>
                        </button>

                        <button
                          onClick={() => student.active_booking && handleCancelBooking(student.active_booking.booking_id)}
                          disabled={cancelling}
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{cancelling ? 'Cancelling...' : 'Cancel Subscription'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-800 text-center space-y-3">
                      <Armchair className="w-8 h-8 text-slate-600 mx-auto" />
                      <div>
                        <p className="text-sm font-semibold text-white">No Active Seat</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          This student is registered but not currently allocated to any seat.
                        </p>
                      </div>
                      <button
                        onClick={() => openBookingModal({ preselectedStudentId: student.id })}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Allocate Seat for {student.name}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Payment History Ledger */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-slate-400" />
                      <span>Payment History Ledger ({student.payment_history.length})</span>
                    </h3>
                  </div>

                  {student.payment_history.length === 0 ? (
                    <div className="p-6 rounded-xl bg-slate-800/20 border border-slate-800 text-center">
                      <p className="text-xs text-slate-400">
                        No payments logged for this student yet. Click "Record Fee Payment" below to log a transaction.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {student.payment_history.map((pay) => (
                        <div
                          key={pay.id}
                          className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">
                                  {formatCurrency(Number(pay.amount))}
                                </span>
                                {pay.is_adjustment ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Upgrade Top-up
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Regular Month
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                {pay.payment_type === 'cash' ? (
                                  <Wallet className="w-3 h-3 text-slate-400" />
                                ) : (
                                  <CreditCard className="w-3 h-3 text-slate-400" />
                                )}
                                <span className="capitalize">{pay.payment_type}</span> • {pay.payment_date}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400 font-mono">
                              Receipt #{pay.id}
                            </span>
                          </div>

                          {/* Billing Period or Note */}
                          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                            {pay.is_adjustment ? (
                              <div className="text-amber-300/90 font-medium">
                                <strong>Reason:</strong> {pay.note || 'Mid-month adjustment'}
                              </div>
                            ) : (
                              <div>
                                <span className="text-slate-400">Covers Cycle:</span>{' '}
                                <strong className="text-white font-mono">
                                  {pay.period_start} → {pay.period_end}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Drawer Footer Action */}
          {student && student.active_booking && (
            <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex gap-2">
              <button
                onClick={() => {
                  if (!student.active_booking) return;
                  openPaymentModal({
                    bookingId: student.active_booking.booking_id,
                    studentId: student.id,
                    studentName: student.name,
                    defaultMode: 'regular',
                  });
                }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <IndianRupee className="w-4 h-4" />
                <span>Collect Subscription Fee</span>
              </button>

              <button
                onClick={() => {
                  if (!student.active_booking) return;
                  openPaymentModal({
                    bookingId: student.active_booking.booking_id,
                    studentId: student.id,
                    studentName: student.name,
                    defaultMode: 'adjustment',
                  });
                }}
                className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium text-xs transition border border-slate-700"
                title="Collect upgrade or top-up charge"
              >
                + Upgrade Fee
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
