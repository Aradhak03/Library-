from sqlalchemy.ext.asyncio import AsyncSession
from app.db.crud import CRUD
from app.models.seat import Seat

class SeatManager:
    @staticmethod
    async def get_seat_by_number(db: AsyncSession, number: int):
        return await CRUD.get_by_field(db, Seat, "number", number)

    @staticmethod
    async def create_seat(db: AsyncSession, number: int):
        return await CRUD.create(db, Seat, {"number": number})

    @staticmethod
    async def list_seats(db: AsyncSession):
        return await CRUD.get_all(db, Seat)