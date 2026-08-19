"""rename_document_owner_to_uploaded_by

Revision ID: 5497a14e548a
Revises: 841cda86b399
Create Date: 2026-08-19 08:32:14.552152

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5497a14e548a'
down_revision = '841cda86b399'
branch_labels = None
depends_on = None


def upgrade():
    # Autogenerate produced a naive add-then-drop, which would both fail
    # (uploaded_by NOT NULL with no default, against existing rows) and
    # silently lose every existing document's ownership data. This is a
    # genuine rename-with-data-preservation, hand-adjusted in three steps:
    # add nullable -> backfill via SQL -> tighten to NOT NULL and drop the
    # old column.
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uploaded_by', sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column('document_type', sa.String(length=30), nullable=False, server_default='general')
        )

    op.execute('UPDATE documents SET uploaded_by = owner_id')

    # SQLite doesn't enforce FK constraints unless PRAGMA foreign_keys=ON
    # (this app doesn't set it), so there's no live constraint to rename —
    # just the column, its index, and (for documentation/tooling that does
    # read the schema) a fresh FK declaration pointing at the new name.
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.alter_column('uploaded_by', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_index(batch_op.f('ix_documents_owner_id'))
        batch_op.create_index(batch_op.f('ix_documents_uploaded_by'), ['uploaded_by'], unique=False)
        batch_op.create_foreign_key('fk_documents_uploaded_by_users', 'users', ['uploaded_by'], ['id'])
        batch_op.drop_column('owner_id')


def downgrade():
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_id', sa.INTEGER(), nullable=True))

    op.execute('UPDATE documents SET owner_id = uploaded_by')

    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.alter_column('owner_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key('fk_documents_owner_id_users', 'users', ['owner_id'], ['id'])
        batch_op.drop_index(batch_op.f('ix_documents_uploaded_by'))
        batch_op.create_index(batch_op.f('ix_documents_owner_id'), ['owner_id'], unique=False)
        batch_op.drop_column('document_type')
        batch_op.drop_column('uploaded_by')
