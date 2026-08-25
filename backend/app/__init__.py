import os
import sys

from flask import Flask, jsonify

from config import Config
from app.extensions import db, migrate, jwt, cors, limiter


def _start_reminder_scheduler(app):
    """Runs send_due_reminders() on a clock so appointment reminders
    actually go out without a request having to trigger them.

    create_app() is called from more places than just "serve the app" —
    `flask db migrate`/`upgrade`, `flask shell`, seed.py, and
    reembed_chunks.py all load it too, purely to get at the app/db objects,
    and the scheduler has no business starting for any of those (worst
    case: a query against a DB mid-migration, before a column this same
    feature adds even exists — this is not hypothetical, it's exactly what
    happened while building this). Rather than blocklist every one-off
    script, this allowlists the two things that actually are "serve
    traffic": run.py itself (`python run.py`, local dev) and gunicorn
    (production — see Procfile). sys.argv[0] is the path to whatever
    actually got invoked, so it reliably tells these apart.

    Also guarded against pytest (no point scheduling anything against a
    throwaway in-memory DB that's torn down after each test — tests call
    send_due_reminders() directly instead) and Flask's dev-mode reloader,
    which imports and calls create_app() twice — once in the watcher
    process, once in the actual worker — and would otherwise start two
    competing background threads.

    In production this app runs a single gunicorn worker (see Procfile) —
    with more than one, each worker would start its own scheduler and
    could double-send a reminder, an accepted limitation at this app's
    demo/portfolio scale rather than a distributed-lock feature it needs.
    """
    if app.config.get("TESTING"):
        return
    argv0 = os.path.basename(sys.argv[0]).lower()
    if argv0 != "run.py" and "gunicorn" not in argv0:
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return

    from datetime import datetime
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.appointments.reminders import send_due_reminders

    def _job():
        with app.app_context():
            send_due_reminders()

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(_job, "interval", minutes=15, next_run_time=datetime.now())
    scheduler.start()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # Content-Disposition isn't one of the handful of headers a browser
    # exposes to cross-origin fetch() by default (frontend and backend are
    # different origins in both dev and prod) — without this, the file
    # export's filename-from-header parsing in the frontend's downloadFile()
    # would silently always fall through to its fallback name instead.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"], "expose_headers": ["Content-Disposition"]}},
    )
    limiter.init_app(app)

    from app.auth import auth_bp
    from app.documents import documents_bp
    from app.chat import chat_bp
    from app.departments import departments_bp
    from app.doctors import doctors_bp
    from app.patients import patients_bp
    from app.appointments import appointments_bp
    from app.admissions import admissions_bp, wards_bp
    from app.users import users_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(doctors_bp)
    app.register_blueprint(patients_bp)
    app.register_blueprint(appointments_bp)
    app.register_blueprint(admissions_bp)
    app.register_blueprint(wards_bp)
    app.register_blueprint(users_bp)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Too many requests. Please try again shortly."}), 429

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File is too large."}), 413

    @jwt.unauthorized_loader
    def unauthorized(reason):
        return jsonify({"error": "Authentication required."}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"error": "Invalid or expired token."}), 401

    @jwt.expired_token_loader
    def expired_token(header, payload):
        return jsonify({"error": "Session expired, please log in again."}), 401

    @jwt.revoked_token_loader
    def revoked_token(header, payload):
        return jsonify({"error": "This session has been logged out."}), 401

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(header, payload):
        from app.models import TokenBlocklist
        jti = payload["jti"]
        return db.session.query(TokenBlocklist.id).filter_by(jti=jti).first() is not None

    _start_reminder_scheduler(app)

    return app
