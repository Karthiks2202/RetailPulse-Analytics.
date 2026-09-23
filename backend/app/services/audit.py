from app.crud.audit_log import audit_log as audit_log_crud
from fastapi import Request
from uuid import UUID
from typing import Optional
from app.utils import sanitize_audit_values

class AuditService:
    @staticmethod
    async def log(
        db,
        company_id: UUID,
        user_id: UUID | None,
        action: str,
        request: Request,
        resource_type: str = "",
        resource_id: UUID | None = None,
        description: str | None = None,
        before_values: dict | None = None,
        after_values: dict | None = None,
        status: str = "SUCCESS",
    ):
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
        user_agent = request.headers.get("user-agent", "Unknown")
        await audit_log_crud.create(
            db,
            company_id=company_id,
            user_id=user_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            before_values=sanitize_audit_values(before_values) if before_values else None,
            after_values=sanitize_audit_values(after_values) if after_values else None,
            status=status,
        )

audit_service = AuditService()
