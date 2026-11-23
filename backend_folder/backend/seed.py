"""Sample data for KEYGUARD (fictional names and IDs only).

All dates are relative to "now", so the demo always has one OVERDUE key and one
DUE SOON key no matter which day it is presented.
"""
from datetime import datetime, timedelta

ACTOR = "Office Administrator"

SAMPLE_KEYS = [
    ("K101", "Computer Lab 1", "Block A"),
    ("K102", "Cyber Security Lab", "Block B"),
    ("K103", "Seminar Hall", "Block A"),
    ("K104", "Faculty Room 2", "Block C"),
    ("K105", "Network Lab", "Block B"),
    ("K106", "Conference Room", "Block A"),
]


def _iso(moment):
    return moment.replace(microsecond=0).isoformat()


def _event(moment, action, description):
    return {
        "timestamp": _iso(moment),
        "actor": ACTOR,
        "action": action,
        "description": description,
    }


def build_sample_data(now=None):
    """Return (keys, transactions, audit) with dates relative to `now`."""
    now = (now or datetime.now()).replace(microsecond=0)
    registered = now - timedelta(days=60)

    keys = {}
    audit = []
    for offset, (key_id, room, location) in enumerate(SAMPLE_KEYS):
        stamp = registered + timedelta(minutes=offset)
        keys[key_id] = {
            "key_id": key_id,
            "room": room,
            "location": location,
            "status": "AVAILABLE",
            "registered_at": _iso(stamp),
        }
        audit.append(_event(stamp, "KEY_REGISTERED",
                            f"{key_id} registered for {room} ({location})"))

    yesterday = now - timedelta(days=1)
    # (id, key, recipient, recipient id, issued, due, returned or None)
    history = [
        ("TX0001", "K103", "Meera Nair", "EMP118",
         yesterday, yesterday + timedelta(hours=4), yesterday + timedelta(hours=3)),
        ("TX0002", "K101", "Rahul Sharma", "EMP101",
         now - timedelta(hours=6), now - timedelta(hours=2), None),
        ("TX0003", "K102", "Anita Rao", "STU204",
         now - timedelta(hours=3), now + timedelta(minutes=20), None),
    ]

    transactions = []
    for txn_id, key_id, name, person_id, issued, due, returned in history:
        transactions.append({
            "transaction_id": txn_id,
            "key_id": key_id,
            "recipient": name,
            "recipient_id": person_id,
            "issue_date": _iso(issued),
            "due_date": _iso(due),
            "return_date": _iso(returned) if returned else None,
            "status": "RETURNED" if returned else "ISSUED",
        })
        audit.append(_event(
            issued, "KEY_ISSUED",
            f"{key_id} issued to {name} ({person_id}); due {due:%Y-%m-%d %H:%M} - {txn_id}"))
        if returned:
            audit.append(_event(
                returned, "KEY_RETURNED",
                f"{key_id} returned by {name} ({person_id}) - {txn_id}"))
        else:
            keys[key_id]["status"] = "ISSUED"

    audit.sort(key=lambda event: event["timestamp"])
    return keys, transactions, audit
