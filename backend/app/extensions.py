from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address, default_limits=["2000 per day", "300 per hour"])

# A global "always BEGIN IMMEDIATE" hook (via pysqlite's connect/begin
# events) was tried here to close the appointment-booking race window
# described in app/appointments/routes.py, and reverted: it broke ordinary
# multi-statement SQLAlchemy operations (db.create_all()/drop_all(), and
# by extension Alembic's batch-mode migrations) with "cannot start a
# transaction within a transaction", because those issue their own nested
# "begin" events that collide with a forced BEGIN IMMEDIATE. A fix that
# destabilizes schema management to close a narrow, low-probability race
# is a worse trade than the race itself at this app's scale — see the
# comment in app/appointments/routes.py for what mitigation actually
# shipped instead (the partial unique index in app/models.py:Appointment).
