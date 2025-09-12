from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import  update
from typing import List, Optional
from datetime import time
from app.db.crud import CRUD
from app.models.booking import Booking
# from app.models.seat import Seat

class BookingManager:

    @staticmethod
    async def create_booking(db: AsyncSession, booking_data: dict):
        return await CRUD.create(db, Booking, booking_data)

    @staticmethod
    async def list_active_bookings(db: AsyncSession) -> List[Booking]:
        """Get all active bookings"""
        result = await db.execute(
            select(Booking).filter(Booking.is_active == True)
        )
        return result.scalars().all()

    @staticmethod
    async def get_booking_by_id(db: AsyncSession, booking_id: int):
        return await CRUD.get_by_id(db, Booking, booking_id)

    @staticmethod
    async def get_student_active_booking(db: AsyncSession, student_id: int):
        """Get student's active booking"""
        result = await db.execute(
            select(Booking).filter(
                Booking.student_id == student_id,
                Booking.is_active == True
            )
        )
        return result.scalars().first()

    @staticmethod
    async def get_seat_active_booking(db: AsyncSession, seat_id: int):
        """Get active booking for a specific seat"""
        result = await db.execute(
            select(Booking).filter(
                Booking.seat_id == seat_id,
                Booking.is_active == True
            )
        )
        return result.scalars().first()

    @staticmethod
    async def check_seat_time_conflict(db: AsyncSession, seat_id: int, daily_start_time: Optional[time], daily_end_time: Optional[time], is_24_hour_reservation: bool = False) -> bool:
        """Check if there's a time conflict for the seat during the subscription period"""
        # Get all active bookings for this seat (regardless of when they started)
        result = await db.execute(
            select(Booking).filter(
                Booking.seat_id == seat_id,
                Booking.is_active == True
            )
        )
        existing_bookings = result.scalars().all()
        
        # Check if any existing booking has overlapping daily time slots
        for booking in existing_bookings:
            # If existing booking is a 24-hour reservation, it blocks all other bookings
            if booking.is_24_hour_reservation:
                return True
            
            # If new booking is a 24-hour reservation, it conflicts with any existing booking
            if is_24_hour_reservation:
                return True
            
            # Skip overlap check if any time is None (times are optional for 24h bookings)
            if booking.daily_start_time is None or booking.daily_end_time is None or daily_start_time is None or daily_end_time is None:
                continue
            
            # Check for time slot overlaps between partial day bookings
            if BookingManager._times_overlap(
                booking.daily_start_time, booking.daily_end_time,
                daily_start_time, daily_end_time
            ):
                return True
        
        return False
    
    @staticmethod
    def _times_overlap(start1: Optional[time], end1: Optional[time], start2: Optional[time], end2: Optional[time]) -> bool:
        """Check if two daily time slots overlap (handles overnight bookings)"""
        # Guard against None (should be filtered before calling)
        if start1 is None or end1 is None or start2 is None or end2 is None:
            return False
        
        def time_to_minutes(t: time) -> int:
            return t.hour * 60 + t.minute

        s1, e1 = time_to_minutes(start1), time_to_minutes(end1)
        s2, e2 = time_to_minutes(start2), time_to_minutes(end2)

        # Handle overnight bookings by creating two intervals
        def get_intervals(start, end):
            if end <= start:  # Overnight booking
                return [(start, end + 1440), (0, end)]  # (17:00-40:00) and (0:00-16:00)
            else:  # Normal booking
                return [(start, end)]  # (0:00-16:00)
        
        intervals1 = get_intervals(s1, e1)
        intervals2 = get_intervals(s2, e2)
        
        # Check if any interval from booking1 overlaps with any interval from booking2
        for (start1, end1) in intervals1:
            for (start2, end2) in intervals2:
                if start1 < end2 and start2 < end1:
                    return True
        
        return False
    @staticmethod
    async def cancel_booking(db: AsyncSession, booking_id: int):
        """Cancel a booking by setting is_active to False"""
        await db.execute(
            update(Booking).where(Booking.id == booking_id).values(is_active=False)
        )
        await db.commit()
        return await CRUD.get_by_id(db, Booking, booking_id)

    # @staticmethod
    # async def has_24_hour_reservation(db: AsyncSession, seat_id: int) -> bool:
    #     """Check if a seat has an active 24-hour reservation"""
    #     result = await db.execute(
    #         select(Booking).filter(
    #             Booking.seat_id == seat_id,
    #             Booking.is_active == True,
    #             Booking.is_24_hour_reservation == True
    #         )
    #     )
    #     return result.scalar_one_or_none() is not None

    # @staticmethod
    # async def get_available_seats(db: AsyncSession, subscription_start_date: date, daily_start_time: time, daily_end_time: time, is_24_hour_reservation: bool = False) -> List[int]:
    #     """Get list of available seat IDs for a specific subscription period and daily time slot"""
    #     # Get all active seats
    #     all_seats = await CRUD.get_all(db, Seat)
    #     all_seat_ids = [seat.id for seat in all_seats if seat.is_active]
        
    #     # Get all active bookings (regardless of when they started)
    #     result = await db.execute(
    #         select(Booking).filter(
    #             Booking.is_active == True
    #         )
    #     )
    #     existing_bookings = result.scalars().all()
        
    #     # Find seats that have conflicts
    #     conflicting_seat_ids = set()
    #     for booking in existing_bookings:
    #         # If existing booking is 24-hour, it blocks all other bookings
    #         if booking.is_24_hour_reservation:
    #             conflicting_seat_ids.add(booking.seat_id)
    #         # If new booking is 24-hour, it conflicts with any existing booking
    #         elif is_24_hour_reservation:
    #             conflicting_seat_ids.add(booking.seat_id)
    #         # Check for time slot overlaps between partial day bookings
    #         elif BookingManager._times_overlap(
    #             booking.daily_start_time, booking.daily_end_time,
    #             daily_start_time, daily_end_time
    #         ):
    #             conflicting_seat_ids.add(booking.seat_id)
        
    #     # Return available seat IDs
    #     return [seat_id for seat_id in all_seat_ids if seat_id not in conflicting_seat_ids]

    @staticmethod
    async def get_seat_schedule(db: AsyncSession, seat_id: int) -> List[Booking]:
        """Get all active bookings for a seat"""
        result = await db.execute(
            select(Booking).filter(
                Booking.seat_id == seat_id,
                Booking.is_active == True
            ).order_by(Booking.created_at)
        )
        return result.scalars().all()

    @staticmethod
    async def get_student_schedule(db: AsyncSession, student_id: int) -> List[Booking]:
        """Get all bookings for a student (active and inactive)"""
        result = await db.execute(
            select(Booking).filter(
                Booking.student_id == student_id
            ).order_by(Booking.created_at.desc())
        )
        return result.scalars().all()
