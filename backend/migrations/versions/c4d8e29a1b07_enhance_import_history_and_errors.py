"""enhance import history and errors

Revision ID: c4d8e29a1b07
Revises: b3f37512587e
Create Date: 2026-11-04 10:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d8e29a1b07'
down_revision: Union[str, None] = 'b3f37512587e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TYPE importtype ADD VALUE IF NOT EXISTS 'INVENTORY'")
        op.execute("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'UPLOADED'")
        op.execute("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'VALIDATING'")
        op.execute("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'CANCELLED'")
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'IMPORT_STARTED'")

    op.add_column('import_history', sa.Column('skipped_records', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('import_history', sa.Column('duplicate_strategy', sa.String(), nullable=True, server_default='REJECT'))
    op.add_column('import_history', sa.Column('started_at', sa.DateTime(), nullable=True))
    op.add_column('import_history', sa.Column('duration_seconds', sa.Float(), nullable=True))

    op.add_column('import_errors', sa.Column('error_type', sa.String(), nullable=True, server_default='VALIDATION_ERROR'))
    op.add_column('import_errors', sa.Column('processing_status', sa.String(), nullable=True, server_default='FAILED'))


def downgrade() -> None:
    op.drop_column('import_errors', 'processing_status')
    op.drop_column('import_errors', 'error_type')
    op.drop_column('import_history', 'duration_seconds')
    op.drop_column('import_history', 'started_at')
    op.drop_column('import_history', 'duplicate_strategy')
    op.drop_column('import_history', 'skipped_records')
