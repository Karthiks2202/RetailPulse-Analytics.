"""enhance_notifications_with_priority_resource_fields

Revision ID: 596d87968991
Revises: 9ab2c2293ff5
Create Date: 2026-09-29 09:50:49.902516

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '596d87968991'
down_revision: Union[str, None] = '9ab2c2293ff5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notificationpriority = postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='notificationpriority')
    notificationpriority.create(op.get_bind(), checkfirst=True)

    notificationresourcetype = postgresql.ENUM('PRODUCT', 'IMPORT', 'SALE', 'SYSTEM', 'INVENTORY', name='notificationresourcetype')
    notificationresourcetype.create(op.get_bind(), checkfirst=True)

    op.add_column('notifications', sa.Column('priority', sa.Enum('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='notificationpriority'), nullable=False, server_default='MEDIUM'))
    op.add_column('notifications', sa.Column('resource_type', sa.Enum('PRODUCT', 'IMPORT', 'SALE', 'SYSTEM', 'INVENTORY', name='notificationresourcetype'), nullable=True))
    op.add_column('notifications', sa.Column('resource_id', sa.UUID(), nullable=True))
    op.add_column('notifications', sa.Column('read_at', sa.DateTime(), nullable=True))
    op.add_column('notifications', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)
    op.create_index(op.f('ix_notifications_expires_at'), 'notifications', ['expires_at'], unique=False)
    op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'], unique=False)
    op.create_index(op.f('ix_notifications_priority'), 'notifications', ['priority'], unique=False)
    op.create_index(op.f('ix_notifications_resource_id'), 'notifications', ['resource_id'], unique=False)
    op.create_index(op.f('ix_notifications_resource_type'), 'notifications', ['resource_type'], unique=False)
    op.create_index(op.f('ix_notifications_type'), 'notifications', ['type'], unique=False)

    conn = op.get_bind()
    existing_values = {'SYSTEM', 'CUSTOMER_REGISTERED', 'VIP_STATUS', 'CUSTOMER_INACTIVE', 'FIRST_PURCHASE', 'LOW_STOCK', 'OUT_OF_STOCK'}
    new_values = ['STOCKOUT_RISK', 'OVERSTOCK', 'IMPORT_COMPLETED', 'IMPORT_FAILED', 'IMPORT_COMPLETED_WITH_ERRORS', 'SALES_ALERT', 'SYSTEM_ALERT']
    for val in new_values:
        if val not in existing_values:
            try:
                op.execute(f"ALTER TYPE notificationtype ADD VALUE '{val}'")
            except Exception:
                pass


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_resource_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_resource_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_priority'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_is_read'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_expires_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_column('notifications', 'expires_at')
    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'resource_id')
    op.drop_column('notifications', 'resource_type')
    op.alter_column('notifications', 'priority', server_default=None)
    op.drop_column('notifications', 'priority')

    notificationpriority = postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='notificationpriority')
    notificationpriority.drop(op.get_bind(), checkfirst=True)

    notificationresourcetype = postgresql.ENUM('PRODUCT', 'IMPORT', 'SALE', 'SYSTEM', 'INVENTORY', name='notificationresourcetype')
    notificationresourcetype.drop(op.get_bind(), checkfirst=True)
