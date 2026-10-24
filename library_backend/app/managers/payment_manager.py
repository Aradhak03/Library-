from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from app.db.crud import CRUD
from app.models.payment import Payment
from app.models.booking import Booking

class PaymentManager:

    @staticmethod
    async def create_payment(db: AsyncSession, payment_data: dict):
        """Create a new payment record"""
        return await CRUD.create(db, Payment, payment_data)

    # @staticmethod
    # async def get_payment_by_id(db: AsyncSession, payment_id: int):
    #     """Get payment by ID"""
    #     return await CRUD.get_by_id(db, Payment, payment_id)

    @staticmethod
    async def get_booking_payments(db: AsyncSession, booking_id: int) -> List[Payment]:
        """Get all payments for a specific booking"""
        result = await db.execute(
            select(Payment).filter(Payment.booking_id == booking_id)
            .order_by(Payment.payment_date.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_student_payments(db: AsyncSession, student_id: int) -> List[Payment]:
        """Get all payments for a specific student (across all their bookings)"""
        result = await db.execute(
            select(Payment).filter(Payment.student_id == student_id)
            .order_by(Payment.payment_date.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_revenue_for_month(db: AsyncSession, target_month: date) -> Decimal:
        """Get total revenue for a specific month based on payment_date"""
        # Extract year and month from target_month
        year = target_month.year
        month = target_month.month
        
        result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                func.extract('year', Payment.payment_date) == year,
                func.extract('month', Payment.payment_date) == month
            )
        )
        return result.scalar() or Decimal('0')

    @staticmethod
    async def get_pending_students(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Get students with pending payments using anniversary-based billing.
        Only looks at regular payments (is_adjustment = false) to determine last_paid_until.
        Returns seat number for the dashboard overdue table.
        """
        query = text("""
            WITH active_bookings AS (
                SELECT 
                    b.id as booking_id,
                    b.student_id,
                    b.seat_id,
                    s.name as student_name,
                    seats.number as seat_number,
                    b.subscription_start_date,
                    COALESCE(MAX(p.period_end), b.subscription_start_date) as last_paid_until
                FROM bookings b
                JOIN students s ON b.student_id = s.id
                JOIN seats ON b.seat_id = seats.id
                LEFT JOIN payments p ON b.id = p.booking_id AND p.is_adjustment = false
                WHERE b.is_active = true
                GROUP BY b.id, b.student_id, b.seat_id, s.name, seats.number, b.subscription_start_date
            )
            SELECT 
                student_id,
                student_name,
                seat_number,
                booking_id,
                last_paid_until,
                CURRENT_DATE - last_paid_until as days_overdue
            FROM active_bookings
            WHERE last_paid_until < CURRENT_DATE
            ORDER BY days_overdue DESC, student_name
        """)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        return [
            {
                "student_id": row.student_id,
                "student_name": row.student_name,
                "seat_number": row.seat_number,
                "booking_id": row.booking_id,
                "last_paid_until": row.last_paid_until.isoformat(),
                "days_overdue": row.days_overdue
            }
            for row in rows
        ]

    # @staticmethod
    # async def get_payment_coverage_for_booking(db: AsyncSession, booking_id: int) -> Dict[str, Any]:
    #     """Get payment coverage details for a specific booking"""
    #     # Get booking details
    #     booking = await CRUD.get_by_id(db, Booking, booking_id)
    #     if not booking:
    #         return {"error": "Booking not found"}
        
    #     if not booking.is_active:
    #         return {"error": "Booking is not active"}
        
    #     # Get all payments for this booking
    #     payments = await PaymentManager.get_booking_payments(db, booking_id)
        
    #     # Generate expected billing cycles
    #     current_date = date.today()
    #     billing_cycles = []
    #     current_month = booking.subscription_start_date.replace(day=1)
        
    #     while current_month <= current_date.replace(day=1):
    #         billing_cycles.append(current_month)
    #         if current_month.month == 12:
    #             current_month = current_month.replace(year=current_month.year + 1, month=1)
    #         else:
    #             current_month = current_month.replace(month=current_month.month + 1)
        
    #     # Check coverage for each cycle
    #     coverage = []
    #     for cycle in billing_cycles:
    #         is_covered = False
    #         covering_payment = None
            
    #         for payment in payments:
    #             payment_start = payment.start_month
    #             payment_end = payment_start.replace(
    #                 year=payment_start.year + (payment_start.month + payment.covers_months - 1) // 12,
    #                 month=((payment_start.month + payment.covers_months - 1) % 12) + 1
    #             )
                
    #             if payment_start <= cycle < payment_end:
    #                 is_covered = True
    #                 covering_payment = payment
    #                 break
            
    #         coverage.append({
    #             "month": cycle.isoformat(),
    #             "is_covered": is_covered,
    #             "payment_id": covering_payment.id if covering_payment else None,
    #             "payment_amount": float(covering_payment.amount) if covering_payment else None
    #         })
        
    #     return {
    #         "booking_id": booking_id,
    #         "student_id": booking.student_id,
    #         "subscription_start_date": booking.subscription_start_date.isoformat(),
    #         "billing_cycles": coverage,
    #         "total_payments": len(payments),
    #         "total_amount": sum(float(p.amount) for p in payments)
    #     }

    # @staticmethod
    # async def get_payment_coverage_for_student(db: AsyncSession, student_id: int) -> Dict[str, Any]:
    #     """Get payment coverage details for a student's active booking"""
    #     # Get student's active booking
    #     result = await db.execute(
    #         select(Booking).filter(
    #             Booking.student_id == student_id,
    #             Booking.is_active == True
    #         ).limit(1)
    #     )
    #     active_booking = result.scalars().first()
        
    #     if not active_booking:
    #         return {"error": "No active booking found for student"}
        
    #     # Get coverage for the active booking
    #     return await PaymentManager.get_payment_coverage_for_booking(db, active_booking.id)

    @staticmethod
    async def get_revenue_summary(db: AsyncSession, start_date: date, end_date: date) -> Dict[str, Any]:
        """Get revenue summary for a date range"""
        result = await db.execute(
            select(
                func.sum(Payment.amount).label('total_revenue'),
                func.count(Payment.id).label('total_transactions'),
                func.avg(Payment.amount).label('average_payment')
            )
            .filter(
                Payment.payment_date >= start_date,
                Payment.payment_date <= end_date
            )
        )
        
        row = result.first()
        return {
            "total_revenue": float(row.total_revenue or 0),
            "total_transactions": row.total_transactions or 0,
            "average_payment": float(row.average_payment or 0),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }

    @staticmethod
    async def validate_booking_for_payment(db: AsyncSession, booking_id: int) -> Optional[Booking]:
        """Validate that a booking exists and is active for payment"""
        booking = await CRUD.get_by_id(db, Booking, booking_id)
        if not booking:
            return None
        if not booking.is_active:
            return None
        return booking

    @staticmethod
    async def get_next_period_start(db: AsyncSession, booking_id: int) -> date:
        """
        Calculate the next available period_start date for a booking.
        Returns the booking's subscription_start_date if no regular payments exist,
        otherwise returns the period_end of the latest regular payment.
        Adjustment payments (is_adjustment=True) are excluded — they don't affect
        the billing cycle.
        """
        booking = await CRUD.get_by_id(db, Booking, booking_id)
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")

        # Only look at regular payments (not adjustments) to find last period_end
        result = await db.execute(
            select(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.is_adjustment == False  # noqa: E712
            )
            .order_by(Payment.period_end.desc())
            .limit(1)
        )
        latest_payment = result.scalars().first()

        if latest_payment:
            # Next period starts where the latest regular payment ends
            return latest_payment.period_end
        else:
            # No regular payments yet, start from booking's subscription start date
            return booking.subscription_start_date

