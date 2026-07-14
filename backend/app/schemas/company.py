from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional

class CompanyBase(BaseModel):
    name: str
    industry: str
    email: EmailStr
    address: str
    phone: str

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
