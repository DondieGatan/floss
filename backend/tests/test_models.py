"""Model-definition assertions that a normal request-level test can't
catch, because the whole suite runs on SQLite while production runs on
Postgres — see migration d2a98fbd91ad for the bug this guards against.
"""
import pytest
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.schema import CreateIndex

from app.models import Admission, Appointment

# (model, index name, a fragment of the WHERE clause that must survive
# compilation on every dialect)
PARTIAL_UNIQUE_INDEXES = [
    (Appointment, "uq_appointments_doctor_start_active", "cancelled"),
    (Admission, "uq_admissions_bed_active", "discharged_at"),
]


@pytest.mark.parametrize("model,index_name,where_fragment", PARTIAL_UNIQUE_INDEXES)
def test_partial_unique_index_applies_on_every_supported_dialect(model, index_name, where_fragment):
    """These indexes must exclude the "inactive" rows (cancelled
    appointments, discharged admissions) on EVERY dialect this app actually
    runs on (SQLite locally/in tests, Postgres in production) — not just
    the one the test suite happens to run against. A dialect-prefixed Index
    kwarg like sqlite_where only takes effect for its own dialect; passing
    just that one silently produces a blanket (non-partial) unique index
    everywhere else, which is exactly what shipped to production once
    already for both of these."""
    index = next(i for i in model.__table__.indexes if i.name == index_name)

    for dialect in (sqlite.dialect(), postgresql.dialect()):
        ddl = str(CreateIndex(index).compile(dialect=dialect))
        assert "WHERE" in ddl, f"{index_name} has no partial WHERE clause when compiled for {dialect.name}"
        assert where_fragment in ddl
