from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=False, default="")
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    description = Column(Text, nullable=True)
    ip_address = Column(String, nullable=False)
    user_agent = Column(String, nullable=False)
    before_values = Column(JSON, nullable=True)
    after_values = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="SUCCESS")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    company = relationship("Company", back_populates="audit_logs", lazy="raise_on_sql")
    user = relationship("User", back_populates="audit_logs", lazy="raise_on_sql")
