from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.database import get_db
from app.managers.student_manager import StudentManager
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/students", tags=["Students"])

class StudentCreate(BaseModel):
    name: str
    mobile_number: str 

class StudentRead(BaseModel):
    id: int
    name: str
    mobile_number: str
    registered_at: datetime

    class Config:
        from_attributes = True

@router.post("/", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
async def create_student(student: StudentCreate, db: AsyncSession = Depends(get_db)):
    try:
        existing_student = await StudentManager.get_student_by_mobile(db, student.mobile_number)
        if existing_student:
            raise HTTPException(status_code=400, detail="Student with this mobile number already exists")

        new_student = await StudentManager.create_student(db, student.dict())
        return new_student
    except Exception as e:
        if "check_mobile_number_format" in str(e):
            raise HTTPException(status_code=400, detail="Invalid mobile number format")
        raise HTTPException(status_code=400, detail=f"Cannot create student: {e}")

@router.get("/", response_model=List[StudentRead])
async def list_students(db: AsyncSession = Depends(get_db)):
    students = await StudentManager.list_students(db)
    return students
