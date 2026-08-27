from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    last_invoice_number = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint('company_id', name='uq_invoice_sequence_company'),
    )

    company = relationship("Company", back_populates="invoice_sequences", lazy="raise_on_sql")
