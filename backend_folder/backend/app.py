"""Flask routes for KEYGUARD.

No business rules live here. Every route reads form/query input, calls
KeyService, and either renders a template or redirects (Post/Redirect/Get).
"""
import os
from datetime import datetime

from flask import Flask, flash, jsonify, redirect, render_template, request, url_for

from exceptions import (
    DuplicateKeyError,
    InvalidDueDateError,
    KeyGuardError,
    KeyNotFoundError,
    KeyUnavailableError,
    RecordNotFoundError,
    ValidationError,
)
from service import KeyService

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or os.urandom(32)

service = KeyService(data_dir="data")

_API_ERROR_STATUS = {
    ValidationError: 400,
    InvalidDueDateError: 400,
    DuplicateKeyError: 409,
    KeyUnavailableError: 409,
    KeyNotFoundError: 404,
    RecordNotFoundError: 404,
}


@app.before_request
def _api_preflight():
    if request.method == "OPTIONS" and request.path.startswith("/api"):
        return ("", 204)


@app.after_request
def _api_cors(response):
    if request.path.startswith("/api"):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def _attach_room(item):
    key = service.keys.get(item["key_id"])
    item["room"] = key["room"] if key else "Unknown room"
    item["location"] = key["location"] if key else ""
    return item


def _active_rows(now):
    rows = []
    for transaction in service.list_active_transactions(now):
        item = _attach_room(dict(transaction))
        item["status"] = item.pop("display_status")
        rows.append(item)
    return rows


def _overdue_rows(now):
    rows = []
    for transaction in service.list_overdue(now):
        item = _attach_room(dict(transaction))
        item["status"] = "OVERDUE"
        rows.append(item)
    return rows


def _due_soon_rows(now):
    rows = []
    for transaction in service.list_due_soon(now):
        item = _attach_room(dict(transaction))
        item["status"] = "DUE SOON"
        rows.append(item)
    return rows


def _search_payload(term):
    now = datetime.now()
    results = service.search(term)
    transactions = []
    for transaction in results["transactions"]:
        item = _attach_room(dict(transaction))
        item["display_status"] = service._status_for(transaction, now)
        transactions.append(item)
    return {"keys": results["keys"], "transactions": transactions}


def _api_state(term=""):
    now = datetime.now()
    return {
        "counts": service.get_dashboard_counts(now),
        "keys": service.list_keys(),
        "active": _active_rows(now),
        "overdue": _overdue_rows(now),
        "due_soon": _due_soon_rows(now),
        "transactions": service.list_transactions(),
        "audit_events": service.list_audit_events(),
        "search": _search_payload(term) if term else {"keys": [], "transactions": []},
    }


def _api_error(exc):
    status = _API_ERROR_STATUS.get(type(exc), 400)
    return jsonify({"error": str(exc), "code": type(exc).__name__}), status


def _json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


@app.route("/api/state")
def api_state():
    return jsonify(_api_state(request.args.get("q", "")))


@app.route("/api/keys", methods=["POST"])
def api_register_key():
    body = _json_body()
    try:
        key = service.register_key(body.get("key_id"), body.get("room"), body.get("location"))
    except KeyGuardError as exc:
        return _api_error(exc)
    return jsonify(key), 201


@app.route("/api/issue", methods=["POST"])
def api_issue_key():
    body = _json_body()
    try:
        transaction = service.issue_key(
            body.get("key_id"),
            body.get("recipient"),
            body.get("recipient_id"),
            body.get("due_datetime"),
        )
    except KeyGuardError as exc:
        return _api_error(exc)
    return jsonify(transaction), 201


@app.route("/api/return", methods=["POST"])
def api_return_key():
    body = _json_body()
    try:
        transaction = service.return_key(body.get("reference"))
    except KeyGuardError as exc:
        return _api_error(exc)
    return jsonify(transaction)


@app.route("/api/reset", methods=["POST"])
def api_reset():
    service.reset_demo_data()
    return jsonify(_api_state())


@app.context_processor
def inject_now():
    # Used as the `min` on the Issue form's datetime-local input.
    return {"now_iso": datetime.now().strftime("%Y-%m-%dT%H:%M")}


@app.route("/")
def dashboard():
    now = datetime.now()
    counts = service.get_dashboard_counts(now)
    overdue_preview = service.list_overdue(now)[:3]
    return render_template("dashboard.html", counts=counts, overdue_preview=overdue_preview)


@app.route("/keys")
def keys():
    return render_template("keys.html", keys=service.list_keys())


@app.route("/keys/register", methods=["GET", "POST"])
def register_key():
    if request.method == "POST":
        try:
            key = service.register_key(
                request.form.get("key_id"),
                request.form.get("room"),
                request.form.get("location"),
            )
            flash(f"Key '{key['key_id']}' registered.", "success")
            return redirect(url_for("keys"))
        except KeyGuardError as e:
            flash(str(e), "error")
            return render_template("register.html", form=request.form), 400
    return render_template("register.html", form={})


@app.route("/issue", methods=["GET", "POST"])
def issue():
    available_keys = [k for k in service.list_keys() if k["status"] == "AVAILABLE"]
    if request.method == "POST":
        try:
            transaction = service.issue_key(
                request.form.get("key_id"),
                request.form.get("recipient"),
                request.form.get("recipient_id"),
                request.form.get("due_datetime"),
            )
            flash(f"Key '{transaction['key_id']}' issued as {transaction['transaction_id']}.", "success")
            return redirect(url_for("issued"))
        except KeyGuardError as e:
            flash(str(e), "error")
            return render_template("issue.html", available_keys=available_keys, form=request.form), 400
    return render_template("issue.html", available_keys=available_keys, form={})


@app.route("/return", methods=["GET", "POST"])
def return_key():
    active = service.list_active_transactions()
    if request.method == "POST":
        try:
            transaction = service.return_key(request.form.get("reference"))
            flash(
                f"Transaction '{transaction['transaction_id']}' closed. "
                f"Key '{transaction['key_id']}' is available.",
                "success",
            )
            return redirect(url_for("issued"))
        except KeyGuardError as e:
            flash(str(e), "error")
            return render_template("return.html", active=active, form=request.form), 400
    return render_template("return.html", active=active, form={})


@app.route("/return/<reference>", methods=["POST"])
def return_from_list(reference):
    """Lets the Overdue/Due-soon/Issued tables carry a one-click Return button."""
    try:
        transaction = service.return_key(reference)
        flash(
            f"Transaction '{transaction['transaction_id']}' closed. "
            f"Key '{transaction['key_id']}' is available.",
            "success",
        )
    except KeyGuardError as e:
        flash(str(e), "error")
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/issued")
def issued():
    return render_template("issued.html", transactions=service.list_active_transactions())


@app.route("/overdue")
def overdue():
    return render_template("overdue.html", transactions=service.list_overdue())


@app.route("/due-soon")
def due_soon():
    return render_template("due_soon.html", transactions=service.list_due_soon())


@app.route("/search")
def search():
    term = request.args.get("q", "")
    results = service.search(term) if term else {"keys": [], "transactions": []}
    return render_template("search.html", term=term, results=results)


@app.route("/history")
def history():
    return render_template(
        "history.html",
        transactions=service.list_transactions(),
        audit_events=service.list_audit_events(),
    )


@app.route("/admin/reset-demo", methods=["POST"])
def reset_demo():
    service.reset_demo_data()
    flash("Demo data has been reset.", "info")
    return redirect(url_for("dashboard"))


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api"):
        return jsonify({"error": "Not found", "code": "NotFound"}), 404
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True)
