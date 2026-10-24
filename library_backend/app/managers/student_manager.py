from sqlalchemy.ext.asyncio import AsyncSession
from app.db.crud import CRUD
from app.models.student import Student

class StudentManager:
    @staticmethod
    async def get_student_by_mobile(db: AsyncSession, mobile_number: str):
        # Use or add get_by_field to CRUD to search by arbitrary field:
        return await CRUD.get_by_field(db, Student, "mobile_number", mobile_number)

    @staticmethod
    async def create_student(db: AsyncSession, student_data: dict):
        return await CRUD.create(db, Student, student_data)

    @staticmethod
    async def list_students(db: AsyncSession):
        return await CRUD.get_all(db, Student)
