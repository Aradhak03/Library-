from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.crud import CRUD
from app.models.seat import Seat

class SeatManager:
    @staticmethod
    async def get_seat_by_number(db: AsyncSession, number: int):
        result = await db.execute(select(Seat).filter(Seat.number == number))
        return result.scalars().first()

    @staticmethod
    async def create_seat(db: AsyncSession, number: int):
        return await CRUD.create(db, Seat, {"number": number})

    @staticmethod
    async def list_seats(db: AsyncSession):
        return await CRUD.get_all(db, Seat)