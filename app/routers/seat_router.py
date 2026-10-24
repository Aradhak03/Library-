from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import time, date
from pydantic import BaseModel

from app.db.database import get_db
from app.managers.seat_manager import SeatManager

router = APIRouter(prefix="/seats", tags=["Seats"])


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class SeatCreate(BaseModel):
    number: int


class SeatRead(BaseModel):
    id: int
    number: int
    is_active: bool

    class Config:
        from_attributes = True


class BookingSlot(BaseModel):
    """Represents one active booking on a seat, for the seat matrix response."""
    booking_id: int
    student_id: int
    student_name: Optional[str] = None   # Joined from students table
    is_24_hour_reservation: bool
    daily_start_time: Optional[time]
    daily_end_time: Optional[time]
    subscription_start_date: date


class SeatMatrixEntry(BaseModel):
    """Full seat info with all its active bookings — used to render the floor map."""
    id: int
    number: int
    is_active: bool
    bookings: List[BookingSlot]


# ──────────────────────────────────────────────
# Seat Endpoints
# ──────────────────────────────────────────────

@router.post("/", response_model=SeatRead, status_code=status.HTTP_201_CREATED)
async def create_seat(seat: SeatCreate, db: AsyncSession = Depends(get_db)):
    """Create a single seat."""
    existing_seat = await SeatManager.get_seat_by_number(db, seat.number)
    if existing_seat:
        raise HTTPException(status_code=400, detail="Seat number already exists")
    new_seat = await SeatManager.create_seat(db, seat.number)
    return new_seat


@router.get("/", response_model=List[SeatRead])
async def list_seats(db: AsyncSession = Depends(get_db)):
    """List all seats."""
    seats = await SeatManager.list_seats(db)
    return seats


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed_seats(db: AsyncSession = Depends(get_db)):
    """Bulk-create seats 1 through 48 (skips seats that already exist).
    One-time setup convenience endpoint."""
    created = []
    skipped = []

    for number in range(1, 49):
        existing = await SeatManager.get_seat_by_number(db, number)
        if existing:
            skipped.append(number)
        else:
            await SeatManager.create_seat(db, number)
            created.append(number)

    return {
        "message": f"Seeded {len(created)} seats, skipped {len(skipped)} existing.",
        "created": created,
        "skipped": skipped
    }


@router.get("/matrix", response_model=List[SeatMatrixEntry])
async def get_seat_matrix(db: AsyncSession = Depends(get_db)):
    """Return all 48 seats with their active bookings in a single query.
    Powers the visual floor map — call this once to render all 48 seat cards
    with their occupancy status and time slots.
    
    Booking status logic (computed by the frontend):
    - No bookings → Vacant (green)
    - Has a 24h booking → Full (red)
    - Has time-slot bookings → Partial (yellow)
    - is_active = false → Out of Service (grey)
    """
    # Single query: all seats joined with their active bookings + student names
    from sqlalchemy import text
    query = text("""
        SELECT
            seats.id         AS seat_id,
            seats.number     AS seat_number,
            seats.is_active  AS seat_is_active,
            b.id             AS booking_id,
            b.student_id     AS student_id,
            st.name          AS student_name,
            b.is_24_hour_reservation,
            b.daily_start_time,
            b.daily_end_time,
            b.subscription_start_date
        FROM seats
        LEFT JOIN bookings b
            ON b.seat_id = seats.id AND b.is_active = true
        LEFT JOIN students st
            ON st.id = b.student_id
        ORDER BY seats.number ASC, b.id ASC
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    # Group rows by seat
    seats_map: dict = {}
    for row in rows:
        sid = row.seat_id
        if sid not in seats_map:
            seats_map[sid] = {
                "id": row.seat_id,
                "number": row.seat_number,
                "is_active": row.seat_is_active,
                "bookings": []
            }
        # Only add a booking slot if there is actually a booking on this seat
        if row.booking_id is not None:
            seats_map[sid]["bookings"].append(BookingSlot(
                booking_id=row.booking_id,
                student_id=row.student_id,
                student_name=row.student_name,
                is_24_hour_reservation=row.is_24_hour_reservation,
                daily_start_time=row.daily_start_time,
                daily_end_time=row.daily_end_time,
                subscription_start_date=row.subscription_start_date
            ))

    return list(seats_map.values())
