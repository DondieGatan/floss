"""Vercel serverless entrypoint.

Vercel's Python runtime looks for a WSGI callable named ``app`` in ``api/*.py``.
The Flask app factory lives one directory up, so add that to the import path.

Nothing here is Vercel-specific beyond that: the same ``create_app()`` serves
the Render/gunicorn deployment and local ``python run.py``. The few places the
two differ (no background scheduler, a smaller upload cap, a DB connection
that must survive Neon suspending) key off the ``VERCEL`` environment variable
that Vercel sets for every function.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402

app = create_app()
