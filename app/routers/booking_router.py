from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, date, time

from app.db.database import get_db
from app.db.crud import CRUD
from app.managers.booking_manager import BookingManager
from app.models.student import Student
from app.models.seat import Seat
from app.models.booking import Booking
from pydantic import BaseModel, model_validator

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class BookingCreate(BaseModel):
    seat_id: int
    student_id: int
    subscription_start_date: date  # When the subscription starts
    daily_start_time: Optional[time] = None         # Optional if 24h reservation
    daily_end_time: Optional[time] = None           # Optional if 24h reservation
    is_24_hour_reservation: bool = False  # Whether this is a 24-hour reservation
    notes: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_start_date(self):
        if self.subscription_start_date < date.today():
            raise ValueError('subscription_start_date must be today or in the future')
        return self

    @model_validator(mode='after')
    def validate_time_requirements(self):
        if self.is_24_hour_reservation:
            # Must be None when 24-hour reservation is selected
            if self.daily_start_time is not None or self.daily_end_time is not None:
                raise ValueError('For 24-hour reservations, daily_start_time and daily_end_time must be null')
        else:
            # For non 24-hour bookings, both times are required
            if self.daily_start_time is None or self.daily_end_time is None:
                raise ValueError('daily_start_time and daily_end_time are required for non 24-hour bookings')
            
            # Check that start and end times are not the same
            if self.daily_start_time == self.daily_end_time:
                raise ValueError('daily_start_time and daily_end_time cannot be the same')
        return self

class BookingRead(BookingCreate):
    id: int
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChangeSlotRequest(BaseModel):
    """Request body for changing a booking's seat or time slot.
    All fields are optional — only provide the fields you want to change.
    The backend validates conflicts against other bookings on the new seat,
    excluding the student's own current booking."""
    seat_id: Optional[int] = None
    is_24_hour_reservation: Optional[bool] = None
    daily_start_time: Optional[time] = None
    daily_end_time: Optional[time] = None
    notes: Optional[str] = None

    @model_validator(mode='after')
    def validate_time_consistency(self):
        """If timing is being changed, validate that 24h and time fields are consistent."""
        changing_to_24h = self.is_24_hour_reservation is True
        changing_to_slot = self.is_24_hour_reservation is False

        if changing_to_24h:
            if self.daily_start_time is not None or self.daily_end_time is not None:
                raise ValueError('For 24-hour reservations, daily_start_time and daily_end_time must be null')
        if changing_to_slot:
            if self.daily_start_time is None or self.daily_end_time is None:
                raise ValueError('daily_start_time and daily_end_time are both required when switching to a time-slot booking')
            if self.daily_start_time == self.daily_end_time:
                raise ValueError('daily_start_time and daily_end_time cannot be the same')
        return self

@router.post("/", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(booking: BookingCreate, db: AsyncSession = Depends(get_db)):
    """Create a continuous subscription booking"""
    # Validate that seat exists and is active
    seat = await CRUD.get_by_id(db, Seat, booking.seat_id)
    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seat not found"
        )
    if not seat.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seat is not available for booking"
        )
    
    # Validate that student exists
    student = await CRUD.get_by_id(db, Student, booking.student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Check if student already has an active booking
    existing_student_booking = await BookingManager.get_student_active_booking(db, booking.student_id)
    if existing_student_booking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student already has an active subscription"
        )
    
    # Check if seat is already booked for this time slot
    seat_conflict = await BookingManager.check_seat_time_conflict(
        db, booking.seat_id, booking.daily_start_time, booking.daily_end_time, booking.is_24_hour_reservation
    )
    if seat_conflict:
        # Get existing booking to provide specific error message
        existing_booking = await BookingManager.get_seat_active_booking(db, booking.seat_id)
        if existing_booking and existing_booking.is_24_hour_reservation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This seat is reserved for 24 hours and is not available for the requested time slot"
            )
        elif booking.is_24_hour_reservation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot make a 24-hour reservation as this seat has existing bookings"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This seat is already booked for the requested time slot"
            )
    
    try:
        new_booking = await BookingManager.create_booking(db, booking.model_dump())
        return new_booking
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create booking: {e}"
        )

@router.get("/", response_model=List[BookingRead])
async def list_bookings(db: AsyncSession = Depends(get_db)):
    """Get all active bookings"""
    bookings = await BookingManager.list_active_bookings(db)
    return bookings

# @router.get("/{booking_id}", response_model=BookingRead)
# async def get_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
#     booking = await BookingManager.get_booking_by_id(db, booking_id)
#     if not booking:
#         raise HTTPException(status_code=404, detail="Booking not found")
#     return booking

# @router.get("/student/{student_id}", response_model=BookingRead)
# async def get_student_booking(student_id: int, db: AsyncSession = Depends(get_db)):
#     """Get student's active booking"""
#     # Validate student exists
#     student = await CRUD.get_by_id(db, Student, student_id)
#     if not student:
#         raise HTTPException(status_code=404, detail="Student not found")
    
#     booking = await BookingManager.get_student_active_booking(db, student_id)
#     if not booking:
#         raise HTTPException(status_code=404, detail="No active booking found for student")
#     return booking

@router.put("/{booking_id}/cancel", response_model=BookingRead)
async def cancel_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    """Cancel a subscription (set to inactive)"""
    booking = await BookingManager.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if not booking.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is already inactive"
        )
    
    try:
        updated_booking = await BookingManager.cancel_booking(db, booking_id)
        return updated_booking
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cancel booking: {e}"
        )

# @router.get("/available-seats")
# async def get_available_seats(
#     start_time: datetime,
#     end_time: datetime,
#     db: AsyncSession = Depends(get_db)
# ):
#     """Get list of available seats for a specific time slot"""
#     available_seat_ids = await BookingManager.get_available_seats(db, start_time, end_time)
#     return {"available_seat_ids": available_seat_ids, "count": len(available_seat_ids)}

@router.get("/seat/{seat_id}/schedule", response_model=List[BookingRead])
async def get_seat_schedule(seat_id: int, db: AsyncSession = Depends(get_db)):
    """Get all active bookings for a specific seat"""
    # Validate seat exists
    seat = await CRUD.get_by_id(db, Seat, seat_id)
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
    
    bookings = await BookingManager.get_seat_schedule(db, seat_id)
    return bookings

@router.get("/student/{student_id}/history", response_model=List[BookingRead])
async def get_student_history(student_id: int, db: AsyncSession = Depends(get_db)):
    """Get all bookings for a student (active and inactive)"""
    # Validate student exists
    student = await CRUD.get_by_id(db, Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    bookings = await BookingManager.get_student_schedule(db, student_id)
    return bookings


@router.put("/{booking_id}/change-slot", response_model=BookingRead)
async def change_booking_slot(
    booking_id: int,
    request: ChangeSlotRequest,
    db: AsyncSession = Depends(get_db)
):
    """Change a student's seat and/or time slot on an existing active booking.
    Preserves all payment history and billing cycle — booking_id stays the same.
    
    Use this instead of cancel + rebook when a student wants to:
    - Shift their daily hours (e.g. 08:00-12:00 → 08:00-14:00)
    - Switch from custom hours to 24-hour reservation (or vice versa)
    - Move to a different seat number
    
    Conflict check excludes the student's own current booking so they can
    stay on the same seat and just adjust their hours."""
    # Fetch the booking
    booking = await BookingManager.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if not booking.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change slot on an inactive booking"
        )

    # Resolve final values: use new value if provided, else keep existing
    new_seat_id = request.seat_id if request.seat_id is not None else booking.seat_id
    new_is_24h = request.is_24_hour_reservation if request.is_24_hour_reservation is not None else booking.is_24_hour_reservation
    new_start_time = request.daily_start_time if request.daily_start_time is not None else (None if new_is_24h else booking.daily_start_time)
    new_end_time = request.daily_end_time if request.daily_end_time is not None else (None if new_is_24h else booking.daily_end_time)

    # Validate new seat exists and is active (if changing seat)
    if request.seat_id is not None and request.seat_id != booking.seat_id:
        new_seat = await CRUD.get_by_id(db, Seat, new_seat_id)
        if not new_seat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New seat not found")
        if not new_seat.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New seat is not available (out of service)"
            )

    # Check for conflicts on the new seat/time — excluding the current booking itself
    conflict = await BookingManager.check_seat_time_conflict(
        db,
        seat_id=new_seat_id,
        daily_start_time=new_start_time,
        daily_end_time=new_end_time,
        is_24_hour_reservation=new_is_24h,
        exclude_booking_id=booking_id  # Don't conflict with the student's own booking
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested seat and time slot conflicts with an existing booking"
        )

    # Apply updates
    update_data = {
        "seat_id": new_seat_id,
        "is_24_hour_reservation": new_is_24h,
        "daily_start_time": new_start_time,
        "daily_end_time": new_end_time,
    }
    if request.notes is not None:
        update_data["notes"] = request.notes

    updated_booking = await CRUD.update(db, Booking, booking_id, update_data)
    return updated_booking
