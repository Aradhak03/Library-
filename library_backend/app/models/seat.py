from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class Seat(Base):
    __tablename__ = "seats"
    
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True, nullable=False)  
    is_active = Column(Boolean, default=True)
