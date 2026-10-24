import { useState } from 'react';
import { X, UserPlus, Phone, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { studentsApi, getErrorMessage } from '../../api/client.ts';
import { useModals } from '../../context/ModalContext.tsx';

interface RegisterStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (studentId: number) => void;
}

export const RegisterStudentModal = ({
  isOpen,
  onClose,
  onSuccess,
}: RegisterStudentModalProps) => {
  const { triggerRefresh, openBookingModal } = useModals();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [allocateSeatImmediately, setAllocateSeatImmediately] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateMobile = (mobile: string): boolean => {
    return /^[0-9]{10}$/.test(mobile.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedMobile = mobileNumber.trim();

    if (!trimmedName) {
      setError('Student name is required');
      return;
    }

    if (!validateMobile(trimmedMobile)) {
      setError('Mobile number must be exactly 10 digits (e.g. 9876543210)');
      return;
    }

    setLoading(true);
    try {
      const newStudent = await studentsApi.create(trimmedName, trimmedMobile);
      triggerRefresh();
      onClose();

      // Reset form
      setName('');
      setMobileNumber('');

      if (onSuccess) {
        onSuccess(newStudent.id);
      } else if (allocateSeatImmediately) {
        // Open booking modal for this student immediately
        openBookingModal({ preselectedStudentId: newStudent.id });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Register Student</h3>
            <p className="text-xs text-slate-400">Add a new library member with mobile number</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-sm"
              />
            </div>
          </div>

          {/* 10-Digit Mobile Number */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Mobile Number (10 digits) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobileNumber(val);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition shadow-sm"
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
              <span>Required by backend mobile format constraint</span>
              <span className={mobileNumber.length === 10 ? 'text-emerald-400 font-mono' : 'text-slate-400 font-mono'}>
                {mobileNumber.length}/10 digits
              </span>
            </div>
          </div>

          {/* Immediate Seat Allocation Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allocateSeatImmediately}
                onChange={(e) => setAllocateSeatImmediately(e.target.checked)}
                className="mt-0.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0"
              />
              <span className="text-xs text-slate-300">
                Immediately allocate a seat & time slot for this student after registration
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition flex items-center gap-2"
            >
              {loading ? (
                <span>Registering...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Register Student</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
