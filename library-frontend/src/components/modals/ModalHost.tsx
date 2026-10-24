import { useModals } from '../../context/ModalContext.tsx';
import { RegisterStudentModal } from './RegisterStudentModal.tsx';
import { BookingModal } from './BookingModal.tsx';
import { ChangeSlotModal } from './ChangeSlotModal.tsx';
import { PaymentModal } from './PaymentModal.tsx';

export const ModalHost = () => {
  const { isStudentModalOpen, closeStudentModal } = useModals();

  return (
    <>
      {/* 1. Register Student Modal */}
      <RegisterStudentModal
        isOpen={isStudentModalOpen}
        onClose={closeStudentModal}
      />

      {/* 2. New Booking Modal */}
      <BookingModal />

      {/* 3. Change Timing / Transfer Seat Modal */}
      <ChangeSlotModal />

      {/* 4. Record Payment Modal */}
      <PaymentModal />
    </>
  );
};
