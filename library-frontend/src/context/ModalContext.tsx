import { createContext, useContext, useState, type ReactNode } from 'react';

interface BookingModalOptions {
  preselectedSeatId?: number;
  preselectedStudentId?: number;
}

interface PaymentModalOptions {
  bookingId?: number;
  studentId?: number;
  studentName?: string;
  defaultMode?: 'regular' | 'adjustment';
}

interface ChangeSlotModalOptions {
  bookingId: number;
  studentName: string;
  currentSeatId: number;
  currentSeatNumber: number;
  currentStartTime: string | null;
  currentEndTime: string | null;
  currentIs24h: boolean;
}

interface ModalContextType {
  isStudentModalOpen: boolean;
  openStudentModal: () => void;
  closeStudentModal: () => void;

  isBookingModalOpen: boolean;
  bookingModalOptions: BookingModalOptions;
  openBookingModal: (options?: BookingModalOptions) => void;
  closeBookingModal: () => void;

  isPaymentModalOpen: boolean;
  paymentModalOptions: PaymentModalOptions;
  openPaymentModal: (options?: PaymentModalOptions) => void;
  closePaymentModal: () => void;

  isChangeSlotModalOpen: boolean;
  changeSlotModalOptions: ChangeSlotModalOptions | null;
  openChangeSlotModal: (options: ChangeSlotModalOptions) => void;
  closeChangeSlotModal: () => void;

  refreshKey: number;
  triggerRefresh: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingModalOptions, setBookingModalOptions] = useState<BookingModalOptions>({});

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalOptions, setPaymentModalOptions] = useState<PaymentModalOptions>({});

  const [isChangeSlotModalOpen, setIsChangeSlotModalOpen] = useState(false);
  const [changeSlotModalOptions, setChangeSlotModalOptions] = useState<ChangeSlotModalOptions | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  const openStudentModal = () => setIsStudentModalOpen(true);
  const closeStudentModal = () => setIsStudentModalOpen(false);

  const openBookingModal = (options?: BookingModalOptions) => {
    setBookingModalOptions(options || {});
    setIsBookingModalOpen(true);
  };
  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setBookingModalOptions({});
  };

  const openPaymentModal = (options?: PaymentModalOptions) => {
    setPaymentModalOptions(options || {});
    setIsPaymentModalOpen(true);
  };
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentModalOptions({});
  };

  const openChangeSlotModal = (options: ChangeSlotModalOptions) => {
    setChangeSlotModalOptions(options);
    setIsChangeSlotModalOpen(true);
  };
  const closeChangeSlotModal = () => {
    setIsChangeSlotModalOpen(false);
    setChangeSlotModalOptions(null);
  };

  return (
    <ModalContext.Provider
      value={{
        isStudentModalOpen,
        openStudentModal,
        closeStudentModal,
        isBookingModalOpen,
        bookingModalOptions,
        openBookingModal,
        closeBookingModal,
        isPaymentModalOpen,
        paymentModalOptions,
        openPaymentModal,
        closePaymentModal,
        isChangeSlotModalOpen,
        changeSlotModalOptions,
        openChangeSlotModal,
        closeChangeSlotModal,
        refreshKey,
        triggerRefresh,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export function useModals(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
}
