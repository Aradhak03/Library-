from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, date, time

from app.db.database import get_db
from app.managers.student_manager import StudentManager
from app.models.student import Student
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.seat import Seat
from app.db.crud import CRUD
from pydantic import BaseModel

router = APIRouter(prefix="/students", tags=["Students"])


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class StudentCreate(BaseModel):
    name: str
    mobile_number: str


class StudentRead(BaseModel):
    id: int
    name: str
    mobile_number: str
    registered_at: datetime

    class Config:
        from_attributes = True


class ActiveBookingInfo(BaseModel):
    """Compact booking details for the Student Detail Drawer."""
    booking_id: int
    seat_id: int
    seat_number: int
    subscription_start_date: date
    is_24_hour_reservation: bool
    daily_start_time: Optional[time]
    daily_end_time: Optional[time]
    notes: Optional[str]
    created_at: datetime


class PaymentInfo(BaseModel):
    """Payment record for the Student Detail Drawer ledger."""
    id: int
    amount: float
    payment_date: date
    payment_type: str
    period_start: Optional[date]
    period_end: Optional[date]
    is_adjustment: bool
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StudentDetail(BaseModel):
    """Full student profile with active booking and payment history."""
    id: int
    name: str
    mobile_number: str
    registered_at: datetime
    active_booking: Optional[ActiveBookingInfo]
    payment_history: List[PaymentInfo]


# ──────────────────────────────────────────────
# Student Endpoints
# ──────────────────────────────────────────────

@router.post("/", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
async def create_student(student: StudentCreate, db: AsyncSession = Depends(get_db)):
    """Register a new student."""
    try:
        existing_student = await StudentManager.get_student_by_mobile(db, student.mobile_number)
        if existing_student:
            raise HTTPException(status_code=400, detail="Student with this mobile number already exists")

        new_student = await StudentManager.create_student(db, student.dict())
        return new_student
    except HTTPException:
        raise
    except Exception as e:
        if "check_mobile_number_format" in str(e):
            raise HTTPException(status_code=400, detail="Invalid mobile number format. Must be exactly 10 digits.")
        raise HTTPException(status_code=400, detail=f"Cannot create student: {e}")


@router.get("/search", response_model=List[StudentRead])
async def search_students(
    q: str = Query(..., min_length=1, description="Search by name or mobile number (partial match)"),
    db: AsyncSession = Depends(get_db)
):
    """Search students by name or mobile number (case-insensitive partial match).
    Used in the booking modal and payment modal for quick student lookup."""
    result = await db.execute(
        select(Student).filter(
            or_(
                Student.name.ilike(f"%{q}%"),
                Student.mobile_number.ilike(f"%{q}%")
            )
        ).order_by(Student.name).limit(20)
    )
    return result.scalars().all()


@router.get("/", response_model=List[StudentRead])
async def list_students(db: AsyncSession = Depends(get_db)):
    """List all students."""
    students = await StudentManager.list_students(db)
    return students


@router.get("/{student_id}", response_model=StudentDetail)
async def get_student_detail(student_id: int, db: AsyncSession = Depends(get_db)):
    """Get full student profile: basic info + active booking (with seat number) + full payment history.
    Powers the Student Detail Drawer in the frontend."""
    # Fetch student
    student = await CRUD.get_by_id(db, Student, student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Fetch active booking + seat number via join
    active_booking_info = None
    booking_result = await db.execute(
        select(Booking, Seat)
        .join(Seat, Seat.id == Booking.seat_id)
        .filter(
            Booking.student_id == student_id,
            Booking.is_active == True  # noqa: E712
        )
        .limit(1)
    )
    row = booking_result.first()
    if row:
        booking, seat = row
        active_booking_info = ActiveBookingInfo(
            booking_id=booking.id,
            seat_id=booking.seat_id,
            seat_number=seat.number,
            subscription_start_date=booking.subscription_start_date,
            is_24_hour_reservation=booking.is_24_hour_reservation,
            daily_start_time=booking.daily_start_time,
            daily_end_time=booking.daily_end_time,
            notes=booking.notes,
            created_at=booking.created_at
        )

    # Fetch full payment history (all bookings for this student, newest first)
    payments_result = await db.execute(
        select(Payment)
        .filter(Payment.student_id == student_id)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    )
    payments = payments_result.scalars().all()
    payment_history = [
        PaymentInfo(
            id=p.id,
            amount=float(p.amount),
            payment_date=p.payment_date,
            payment_type=p.payment_type,
            period_start=p.period_start,
            period_end=p.period_end,
            is_adjustment=p.is_adjustment,
            note=p.note,
            created_at=p.created_at
        )
        for p in payments
    ]

    return StudentDetail(
        id=student.id,
        name=student.name,
        mobile_number=student.mobile_number,
        registered_at=student.registered_at,
        active_booking=active_booking_info,
        payment_history=payment_history
    )
