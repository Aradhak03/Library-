from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint
from datetime import datetime
from app.db.database import Base

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    mobile_number = Column(String, unique=True, index=True, nullable=False)
    registered_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint(
            "LENGTH(mobile_number) = 10 AND mobile_number ~ '^[0-9]{10}$'",
            name="check_mobile_number_format"
        ),
    )
