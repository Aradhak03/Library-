from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update as sqlalchemy_update, delete as sqlalchemy_delete
from typing import Type, Any, Dict

class CRUD:
    @staticmethod
    async def get_by_id(db: AsyncSession, model: Type, obj_id: Any):
        result = await db.execute(select(model).filter(model.id == obj_id))
        return result.scalars().first()

    @staticmethod
    async def get_by_field(db: AsyncSession, model: Type, field: str, value: Any):
        result = await db.execute(select(model).filter(getattr(model, field) == value))
        return result.scalars().first()

    @staticmethod
    async def get_all(db: AsyncSession, model: Type):
        result = await db.execute(select(model))
        return result.scalars().all()

    @staticmethod
    async def create(db: AsyncSession, model: Type, obj_in: Dict):
        obj = model(**obj_in)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    @staticmethod
    async def update(db: AsyncSession, model: Type, obj_id: Any, obj_in: Dict):
        await db.execute(
            sqlalchemy_update(model).where(model.id == obj_id).values(**obj_in)
        )
        await db.commit()
        # Return the updated object
        return await CRUD.get_by_id(db, model, obj_id)

    @staticmethod
    async def delete(db: AsyncSession, model: Type, obj_id: Any):
        await db.execute(
            sqlalchemy_delete(model).where(model.id == obj_id)
        )
        await db.commit()