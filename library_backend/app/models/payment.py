from sqlalchemy import Column, Integer, ForeignKey, DateTime, Date, Numeric, String, Enum, Index, Boolean
from datetime import datetime
import enum
from app.db.database import Base

class PaymentType(str, enum.Enum):
    CASH = "cash"
    ONLINE = "online"

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)  # Payment is for a specific booking
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)  # Denormalized for easier queries
    amount = Column(Numeric(10, 2), nullable=False)  # Total amount received in this transaction
    payment_date = Column(Date, nullable=False, index=True)  # When admin entered payment (used for dashboard totals - month filtering)
    payment_type = Column(Enum(PaymentType, native_enum=False), default=PaymentType.CASH, nullable=False)  # Payment method: cash or online
    period_start = Column(Date, nullable=True)   # Start date of the billing period. NULL for adjustment payments.
    period_end = Column(Date, nullable=True)     # End date (exclusive) of the billing period. NULL for adjustment payments.
    is_adjustment = Column(Boolean, default=False, nullable=False)  # True for mid-cycle top-ups / extra charges. Bypasses overlap constraint and period date logic.
    note = Column(String, nullable=True)         # Admin note for adjustment payments (e.g. "Upgrade to 6hrs for remaining 15 days")
    created_at = Column(DateTime, default=lambda: datetime.now())
    
    __table_args__ = (
        # Composite index for finding latest regular payment per booking (used in get_next_period_start)
        # This is the most critical index - filters by booking_id and orders by period_end DESC
        Index('idx_payments_booking_period_end', 'booking_id', Column('period_end', Date).desc()),
        # Composite index for student payment queries (filter by student_id, order by payment_date DESC)
        Index('idx_payments_student_date', 'student_id', Column('payment_date', Date).desc()),
    )
