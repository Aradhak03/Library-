from fastapi import FastAPI
from app.db.database import engine, Base
from app.models.seat import Seat  
from app.routers.seat_router import router as seat_router

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI()

# Include routers
app.include_router(seat_router)

@app.on_event("startup")
async def startup_event():
    # Create all tables on startup
    await create_tables()

@app.get("/")
def root():
    return {"message": "Library Management API is running"}
