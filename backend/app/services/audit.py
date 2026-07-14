from app.crud.audit_log import audit_log as audit_log_crud
from fastapi import Request
from uuid import UUID

class AuditService:
    @staticmethod
    async def log(db, company_id: UUID, user_id: UUID | None, action: str, request: Request):
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
        browser = request.headers.get("user-agent", "Unknown")
        await audit_log_crud.create(db, company_id=company_id, user_id=user_id, action=action, ip_address=ip_address, browser=browser)

audit_service = AuditService()
