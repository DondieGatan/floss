"""Shared offset pagination for list endpoints that could otherwise grow
unbounded (see app/users/routes.py, app/patients/routes.py,
app/appointments/routes.py, app/chat/routes.py) — a plain .all() on any of
these was fine at seed-data scale but has no ceiling as real data
accumulates.
"""
from flask import request

DEFAULT_PER_PAGE = 50
MAX_PER_PAGE = 200


def paginate(query, default_per_page=DEFAULT_PER_PAGE):
    """Applies page/perPage query params to `query` and returns
    (items, meta) — meta is meant to be spread directly into the JSON
    response alongside the existing array key, so callers that don't yet
    read it keep working unchanged (they just stop getting everything past
    the first page)."""
    # request.args.get(..., type=int) already falls back to the given
    # default when the param is absent or fails to parse — an `or default`
    # after it would also (wrongly) override an explicit 0 or negative
    # value, which max()/min() below need to see in order to clamp it.
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("perPage", default_per_page, type=int)
    page = max(page, 1)
    per_page = min(max(per_page, 1), MAX_PER_PAGE)

    total = query.order_by(None).count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()

    return items, {
        "page": page,
        "perPage": per_page,
        "total": total,
        "hasMore": page * per_page < total,
    }
