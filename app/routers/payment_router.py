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

class PaymentCreate(BaseModel):
    booking_id: int  # Payment is for a specific booking
    amount: float = Field(gt=0, description="Payment amount must be positive")
    payment_date: date
    payment_type: Literal["cash", "online"] = Field(default="cash", description="Payment method: cash or online")
    period_duration: int = Field(gt=0, description="Duration of the billing period")
    period_unit: Literal["months", "days"] = Field(description="Unit for period duration: months or days")

class PaymentRead(BaseModel):
    id: int
    booking_id: int
    student_id: int  # Denormalized for easier queries
    amount: float
    payment_date: date
    payment_type: str
    period_start: date
    period_end: date
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
    last_paid_until: str
    days_overdue: int

class PaymentCoverageResponse(BaseModel):
    booking_id: int
    student_id: int
    subscription_start_date: str
    billing_cycles: List[dict]
    total_payments: int
    total_amount: float

@router.post("/", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(payment: PaymentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new payment record for a booking"""
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
        
        # Convert amount to Decimal for database storage
        payment_data = {
            'booking_id': payment.booking_id,
            'amount': Decimal(str(payment.amount)),
            'payment_date': payment.payment_date,
            'payment_type': payment.payment_type,
            'period_start': period_start,
            'period_end': period_end,
            'student_id': booking.student_id
        }
        
        new_payment = await PaymentManager.create_payment(db, payment_data)
        return new_payment 
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create payment: {str(e)}"
        )

@router.get("/", response_model=List[PaymentRead])
async def list_payments(
    booking_id: Optional[int] = Query(None, description="Filter by booking ID"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get all payments, optionally filtered by booking or student"""
    if booking_id:
        payments = await PaymentManager.get_booking_payments(db, booking_id)
    elif student_id:
        payments = await PaymentManager.get_student_payments(db, student_id)
    else:
        # Get all payments
        payments = await CRUD.get_all(db, Payment)
    return payments

# @router.get("/{payment_id}", response_model=PaymentRead)
# async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db)):
#     """Get a specific payment by ID"""
#     payment = await PaymentManager.get_payment_by_id(db, payment_id)
#     if not payment:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Payment not found"
#         )
#     return payment

# @router.get("/booking/{booking_id}/coverage", response_model=PaymentCoverageResponse)
# async def get_booking_coverage(booking_id: int, db: AsyncSession = Depends(get_db)):
#     """Get payment coverage details for a specific booking"""
#     coverage = await PaymentManager.get_payment_coverage_for_booking(db, booking_id)
#     if "error" in coverage:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=coverage["error"]
#         )
    
#     return coverage

# @router.get("/student/{student_id}/coverage", response_model=PaymentCoverageResponse)
# async def get_student_coverage(student_id: int, db: AsyncSession = Depends(get_db)):
#     """Get payment coverage details for a student's active booking"""
#     # Validate student exists
#     student = await CRUD.get_by_id(db, Student, student_id)
#     if not student:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Student not found"
#         )
    
#     coverage = await PaymentManager.get_payment_coverage_for_student(db, student_id)
#     if "error" in coverage:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=coverage["error"]
#         )
    
#     return coverage

# Dashboard endpoints
router_dashboard = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router_dashboard.get("/revenue", response_model=RevenueResponse)
async def get_monthly_revenue(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db)
):
    """Get total revenue for a specific month"""
    try:
        # Parse month string to date
        target_month = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month format. Use YYYY-MM"
        )
    
    # Get revenue for the month
    total_revenue = await PaymentManager.get_revenue_for_month(db, target_month)
    
    # Get transaction count for the month
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
    """Get list of students with pending payments (only for active bookings)"""
    pending_students = await PaymentManager.get_pending_students(db)
    return pending_students

@router_dashboard.get("/revenue-summary")
async def get_revenue_summary(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Get revenue summary for a date range"""
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


