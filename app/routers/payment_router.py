from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional, Literal
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from app.db.database import get_db
from app.db.crud import CRUD
from app.managers.payment_manager import PaymentManager
from pydantic import BaseModel, Field
from app.models.payment import Payment

router = APIRouter(prefix="/payments", tags=["Payments"])


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class PaymentCreate(BaseModel):
    """
    Used for regular monthly / multi-month subscription payments.
    period_duration and period_unit are required — the backend auto-calculates
    period_start and period_end from the booking's payment history.
    """
    booking_id: int
    amount: float = Field(gt=0, description="Payment amount must be positive")
    payment_date: date
    payment_type: Literal["cash", "online"] = Field(default="cash", description="Payment method: cash or online")
    period_duration: int = Field(gt=0, description="Duration of the billing period")
    period_unit: Literal["months", "days"] = Field(description="Unit for period duration: months or days")


class AdjustmentPaymentCreate(BaseModel):
    """
    Used for mid-cycle extra charges (e.g. upgrading from 4hrs to 6hrs mid-month).
    No period dates — is_adjustment is always True.
    note is required to describe the reason.
    """
    booking_id: int
    amount: float = Field(gt=0, description="Extra charge amount must be positive")
    payment_date: date
    payment_type: Literal["cash", "online"] = Field(default="cash", description="Payment method: cash or online")
    note: str = Field(min_length=1, description="Reason for this adjustment (e.g. 'Upgrade to 6hrs for remaining 15 days')")


class PaymentRead(BaseModel):
    id: int
    booking_id: int
    student_id: int
    amount: float
    payment_date: date
    payment_type: str
    period_start: Optional[date]   # NULL for adjustment payments
    period_end: Optional[date]     # NULL for adjustment payments
    is_adjustment: bool
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RevenueResponse(BaseModel):
    month: str
    total_revenue: float
    transaction_count: int


class PendingStudentResponse(BaseModel):
    student_id: int
    student_name: str
    seat_number: Optional[int]
    booking_id: int
    last_paid_until: str
    days_overdue: int


# ──────────────────────────────────────────────
# Payment Endpoints
# ──────────────────────────────────────────────

@router.post("/", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(payment: PaymentCreate, db: AsyncSession = Depends(get_db)):
    """Create a regular subscription payment for a booking.
    period_start is automatically calculated from the booking's last payment.
    period_end is calculated from period_start + period_duration."""
    # Validate that booking exists and is active
    booking = await PaymentManager.validate_booking_for_payment(db, payment.booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or not active"
        )

    try:
        # Always calculate period_start to ensure no gaps in payment coverage
        period_start = await PaymentManager.get_next_period_start(db, payment.booking_id)

        # Calculate period_end based on period_duration and period_unit
        if payment.period_unit == "months":
            period_end = period_start + relativedelta(months=payment.period_duration)
        else:  # days
            period_end = period_start + timedelta(days=payment.period_duration)

        # Validate period_start is not before booking start date
        if period_start < booking.subscription_start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Period start date ({period_start}) cannot be before booking start date ({booking.subscription_start_date})"
            )

        payment_data = {
            'booking_id': payment.booking_id,
            'amount': Decimal(str(payment.amount)),
            'payment_date': payment.payment_date,
            'payment_type': payment.payment_type,
            'period_start': period_start,
            'period_end': period_end,
            'student_id': booking.student_id,
            'is_adjustment': False,
            'note': None,
        }

        new_payment = await PaymentManager.create_payment(db, payment_data)
        return new_payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create payment: {str(e)}"
        )


@router.post("/adjustment", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_adjustment_payment(payment: AdjustmentPaymentCreate, db: AsyncSession = Depends(get_db)):
    """Create a mid-cycle adjustment / extra charge for a booking.
    Does NOT affect the student's billing cycle or paid-until date.
    Counts toward dashboard revenue for the month.
    Used for: timing upgrades, locker fees, or any one-off charge."""
    # Validate that booking exists and is active
    booking = await PaymentManager.validate_booking_for_payment(db, payment.booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or not active"
        )

    try:
        payment_data = {
            'booking_id': payment.booking_id,
            'amount': Decimal(str(payment.amount)),
            'payment_date': payment.payment_date,
            'payment_type': payment.payment_type,
            'period_start': None,   # Adjustment payments have no period dates
            'period_end': None,
            'student_id': booking.student_id,
            'is_adjustment': True,
            'note': payment.note,
        }

        new_payment = await PaymentManager.create_payment(db, payment_data)
        return new_payment
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create adjustment payment: {str(e)}"
        )


@router.get("/", response_model=List[PaymentRead])
async def list_payments(
    booking_id: Optional[int] = Query(None, description="Filter by booking ID"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get all payments, optionally filtered by booking or student."""
    if booking_id:
        payments = await PaymentManager.get_booking_payments(db, booking_id)
    elif student_id:
        payments = await PaymentManager.get_student_payments(db, student_id)
    else:
        payments = await CRUD.get_all(db, Payment)
    return payments


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(payment_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a payment record. For admin mistake correction only.
    Use with care — deleting a regular payment will shift the student's
    next period_start back to the previous payment's period_end."""
    payment = await CRUD.get_by_id(db, Payment, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    await CRUD.delete(db, Payment, payment_id)


# ──────────────────────────────────────────────
# Dashboard Endpoints
# ──────────────────────────────────────────────

router_dashboard = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router_dashboard.get("/revenue", response_model=RevenueResponse)
async def get_monthly_revenue(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db)
):
    """Get total revenue (regular + adjustments) for a specific month."""
    try:
        target_month = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month format. Use YYYY-MM"
        )

    total_revenue = await PaymentManager.get_revenue_for_month(db, target_month)

    result = await db.execute(
        select(func.count(Payment.id))
        .filter(
            func.extract('year', Payment.payment_date) == target_month.year,
            func.extract('month', Payment.payment_date) == target_month.month
        )
    )
    transaction_count = result.scalar() or 0

    return RevenueResponse(
        month=month,
        total_revenue=float(total_revenue),
        transaction_count=transaction_count
    )


@router_dashboard.get("/pending", response_model=List[PendingStudentResponse])
async def get_pending_students(db: AsyncSession = Depends(get_db)):
    """Get list of students with pending payments (active bookings only).
    Returns seat number alongside student details for the dashboard overdue table."""
    pending_students = await PaymentManager.get_pending_students(db)
    return pending_students


@router_dashboard.get("/revenue-summary")
async def get_revenue_summary(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Get revenue summary for a date range."""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date cannot be after end date"
        )

    summary = await PaymentManager.get_revenue_summary(db, start, end)
    return summary
