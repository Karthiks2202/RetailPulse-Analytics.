import pytest
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock
from datetime import datetime, timedelta

from app.crud.audit_log import audit_log as audit_log_crud
from app.services.audit import audit_service


def _make_request():
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    return request


class TestAuditLogCRUD:
    @pytest.mark.asyncio
    async def test_create_audit_log(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()
        log = await audit_log_crud.create(
            db_session,
            company_id=company_id,
            user_id=user_id,
            action="Test Action",
            ip_address="127.0.0.1",
            user_agent="pytest",
            resource_type="TestResource",
            description="Testing audit log creation",
        )
        assert log.id is not None
        assert log.action == "Test Action"
        assert log.resource_type == "TestResource"

    @pytest.mark.asyncio
    async def test_company_isolation(self, db_session: AsyncSession):
        company_a = uuid4()
        company_b = uuid4()
        user_id = uuid4()
        
        log_a = await audit_log_crud.create(
            db_session, company_id=company_a, user_id=user_id, action="A Action", ip_address="1", user_agent="1"
        )
        await audit_log_crud.create(
            db_session, company_id=company_b, user_id=user_id, action="B Action", ip_address="2", user_agent="2"
        )
        
        fetched_a = await audit_log_crud.get(db_session, log_a.id)
        assert fetched_a is not None
        assert fetched_a.company_id == company_a

        # Listing for A should not include B
        logs, total = await audit_log_crud.get_multi(db_session, company_id=company_a)
        assert total == 1
        assert logs[0].company_id == company_a
        assert logs[0].action == "A Action"

    @pytest.mark.asyncio
    async def test_clear_logs(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()
        
        await audit_log_crud.create(
            db_session, company_id=company_id, user_id=user_id, action="A Action", ip_address="1", user_agent="1"
        )
        
        # Manually backdate a log
        old_log = await audit_log_crud.create(
            db_session, company_id=company_id, user_id=user_id, action="Old Action", ip_address="1", user_agent="1"
        )
        old_log.created_at = datetime.utcnow() - timedelta(days=10)
        db_session.add(old_log)
        await db_session.commit()
        
        # Clear logs before 5 days ago
        cutoff = datetime.utcnow() - timedelta(days=5)
        deleted = await audit_log_crud.clear_logs(db_session, company_id, cutoff)
        assert deleted == 1
        
        logs, total = await audit_log_crud.get_multi(db_session, company_id)
        assert total == 1
        assert logs[0].action == "A Action"

class TestAuditService:
    @pytest.mark.asyncio
    async def test_audit_service_log(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()
        request = _make_request()
        
        await audit_service.log(
            db_session,
            company_id=company_id,
            user_id=user_id,
            action="Service Action",
            request=request,
            resource_type="ServiceResource",
            commit=True,
        )
        
        logs, total = await audit_log_crud.get_multi(db_session, company_id)
        assert total == 1
        assert logs[0].action == "Service Action"
        assert logs[0].ip_address == "127.0.0.1"
        assert logs[0].user_agent == "Unknown"
