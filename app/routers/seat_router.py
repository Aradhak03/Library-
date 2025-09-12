from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from app.db.database import get_db
from app.managers.seat_manager import SeatManager

router = APIRouter(prefix="/seats", tags=["Seats"])

# Pydantic schema for request/response
class SeatCreate(BaseModel):
    number: int

class SeatRead(BaseModel):
    id: int
    number: int
    is_active: bool

    class Config:
        from_attributes = True

@router.post("/", response_model=SeatRead, status_code=status.HTTP_201_CREATED)
async def create_seat(seat: SeatCreate, db: AsyncSession = Depends(get_db)):
    # Check if seat number already exists
    existing_seat = await SeatManager.get_seat_by_number(db, seat.number)
    if existing_seat:
        raise HTTPException(status_code=400, detail="Seat number already exists")

    new_seat = await SeatManager.create_seat(db, seat.number)
    return new_seat

@router.get("/", response_model=List[SeatRead])
async def list_seats(db: AsyncSession = Depends(get_db)):
    seats = await SeatManager.list_seats(db)
    return seats
