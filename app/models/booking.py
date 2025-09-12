from sqlalchemy import Column, Integer, ForeignKey, DateTime, Date, Boolean, CheckConstraint, Time
from datetime import datetime
from app.db.database import Base

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subscription_start_date = Column(Date, nullable=False)  # When the subscription starts
    daily_start_time = Column(Time, nullable=True)         # Daily start time (optional for 24h)
    daily_end_time = Column(Time, nullable=True)           # Daily end time (optional for 24h)
    is_active = Column(Boolean, default=True)               # Whether subscription is active
    is_24_hour_reservation = Column(Boolean, default=False) # Whether this is a 24-hour reservation
    created_at = Column(DateTime, default=lambda: datetime.now())
    
    __table_args__ = (
        CheckConstraint(
            "subscription_start_date >= DATE(created_at)",
            name="check_booking_start_date"
        ),
        CheckConstraint(
            "(is_24_hour_reservation = true AND daily_start_time IS NULL AND daily_end_time IS NULL) OR "
            "(is_24_hour_reservation = false AND daily_start_time IS NOT NULL AND daily_end_time IS NOT NULL)",
            name="check_24h_booking_consistency"
        ),
    )
