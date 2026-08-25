from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt


def role_required(*roles):
    """Gates a route to specific JWT `role` claims. Distinct from the
    ownership idiom used elsewhere (filter_by(id=x, owner_id=...) -> 404,
    "doesn't exist for you"): a role mismatch means the caller is
    authenticated but categorically not allowed, so this returns 403."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if get_jwt().get("role") not in roles:
                return jsonify({"error": "You don't have permission to do that."}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


staff_required = role_required("staff", "admin", "owner")
admin_required = role_required("admin", "owner")
owner_required = role_required("owner")
