from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.db.database import engine, Base
from app.models.seat import Seat 
from app.models.student import Student
from app.models.booking import Booking
from app.routers.seat_router import router as seat_router
from app.routers.student_router import router as student_router
from app.routers.booking_router import router as booking_router

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    await create_tables()
    yield

app = FastAPI(lifespan=lifespan)

# Include routers
app.include_router(seat_router)
app.include_router(student_router)
app.include_router(booking_router)

@app.get("/")
def root():
    return {"message": "Library Management API is running"}
