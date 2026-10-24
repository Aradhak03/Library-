import { UserPlus, CalendarPlus, IndianRupee, Sparkles } from 'lucide-react';
import { useModals } from '../../context/ModalContext.tsx';

export const TopBar = () => {
  const { openStudentModal, openBookingModal, openPaymentModal } = useModals();

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Date & Status */}
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{todayStr}</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Continuous Subscription Billing</span>
        </div>
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Register Student */}
        <button
          onClick={openStudentModal}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-400" />
          <span>Register Student</span>
        </button>

        {/* New Booking */}
        <button
          onClick={() => openBookingModal()}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm shadow-blue-600/30"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>New Booking</span>
        </button>

        {/* Record Payment */}
        <button
          onClick={() => openPaymentModal()}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm shadow-emerald-600/30"
        >
          <IndianRupee className="w-3.5 h-3.5" />
          <span>Record Payment</span>
        </button>
      </div>
    </header>
  );
};
