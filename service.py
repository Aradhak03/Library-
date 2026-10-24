from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.database import engine, Base
from app.models.seat import Seat 
from app.models.student import Student
from app.models.booking import Booking
from app.models.payment import Payment
from app.routers.seat_router import router as seat_router
from app.routers.student_router import router as student_router
from app.routers.booking_router import router as booking_router
from app.routers.payment_router import router as payment_router
from app.routers.payment_router import router_dashboard

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    await create_tables()
    yield

app = FastAPI(
    lifespan=lifespan,
    title="Library Management API",
    description="Seat booking and payment management for a 48-seat study library",
    version="1.0.0"
)

# Allow requests from the Vite frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(seat_router)
app.include_router(student_router)
app.include_router(booking_router)
app.include_router(payment_router)
app.include_router(router_dashboard)

@app.get("/")
def root():
    return {"message": "Library Management API is running"}
