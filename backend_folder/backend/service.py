"""Business logic and JSON persistence for KEYGUARD.

This is the service layer: all business rules and file I/O live here.
Routes in app.py only read form input, call these methods, and render
or redirect -- they never touch self.keys / self.transactions directly
or duplicate a rule that belongs here.

The public method names and the exceptions raised are a CONTRACT that
later project phases (OOP refactor, stronger validation) should keep,
so the existing Flask routes and templates do not need to change.
"""
import json
import os
import re
from datetime import datetime, timedelta

from exceptions import (
    DuplicateKeyError,
    InvalidDueDateError,
    KeyNotFoundError,
    KeyUnavailableError,
    RecordNotFoundError,
    ValidationError,
)
from seed import build_sample_data

KEY_ID_PATTERN = re.compile(r"^K\d{3}$")
DUE_SOON_MINUTES = 30


class KeyService:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.keys_path = os.path.join(data_dir, "keys.json")
        self.transactions_path = os.path.join(data_dir, "transactions.json")
        self.audit_path = os.path.join(data_dir, "audit_log.json")
        os.makedirs(data_dir, exist_ok=True)

        if all(os.path.exists(p) for p in
               (self.keys_path, self.transactions_path, self.audit_path)):
            self._load()
        else:
            self.reset_demo_data()

    # ---------------------------------------------------------- persistence
    def _load(self):
        with open(self.keys_path, "r", encoding="utf-8") as f:
            self.keys = json.load(f)
        with open(self.transactions_path, "r", encoding="utf-8") as f:
            self.transactions = json.load(f)
        with open(self.audit_path, "r", encoding="utf-8") as f:
            self.audit_log = json.load(f)

    def _save(self):
        with open(self.keys_path, "w", encoding="utf-8") as f:
            json.dump(self.keys, f, indent=2)
        with open(self.transactions_path, "w", encoding="utf-8") as f:
            json.dump(self.transactions, f, indent=2)
        with open(self.audit_path, "w", encoding="utf-8") as f:
            json.dump(self.audit_log, f, indent=2)

    def reset_demo_data(self, now=None):
        """Regenerate fictional sample data with dates relative to `now`."""
        self.keys, self.transactions, self.audit_log = build_sample_data(now)
        self._save()

    # -------------------------------------------------------------- helpers
    @staticmethod
    def _iso(dt):
        return dt.replace(microsecond=0).isoformat()

    def _append_audit(self, action, description, now=None):
        now = now or datetime.now()
        self.audit_log.append({
            "timestamp": self._iso(now),
            "actor": "Office Administrator",
            "action": action,
            "description": description,
        })

    def _next_transaction_id(self):
        if not self.transactions:
            return "TX0001"
        last = max(int(t["transaction_id"][2:]) for t in self.transactions)
        return f"TX{last + 1:04d}"

    def _status_for(self, transaction, now):
        if transaction["status"] == "RETURNED":
            return "RETURNED"
        due = datetime.fromisoformat(transaction["due_date"])
        if due < now:
            return "OVERDUE"
        if due <= now + timedelta(minutes=DUE_SOON_MINUTES):
            return "DUE SOON"
        return "ISSUED"

    def _find_active_transaction(self, reference):
        reference = (reference or "").strip().upper()
        if not reference:
            raise ValidationError("Enter a transaction ID or key ID.")
        matches = [
            t for t in self.transactions
            if t["status"] == "ISSUED"
            and (t["transaction_id"] == reference or t["key_id"] == reference)
        ]
        if not matches:
            raise RecordNotFoundError(f"No active issue found for '{reference}'.")
        matches.sort(key=lambda t: t["issue_date"], reverse=True)
        return matches[0]

    # ------------------------------------------------------ core operations
    def register_key(self, key_id, room, location):
        key_id = (key_id or "").strip().upper()
        room = (room or "").strip()
        location = (location or "").strip()

        if not KEY_ID_PATTERN.match(key_id):
            raise ValidationError("Key ID must look like K101 (K followed by 3 digits).")
        if not room:
            raise ValidationError("Room name is required.")
        if not location:
            raise ValidationError("Location is required.")
        if key_id in self.keys:
            raise DuplicateKeyError(f"Key ID '{key_id}' is already registered.")

        now = datetime.now()
        self.keys[key_id] = {
            "key_id": key_id,
            "room": room,
            "location": location,
            "status": "AVAILABLE",
            "registered_at": self._iso(now),
        }
        self._append_audit("KEY_REGISTERED", f"{key_id} registered for {room}, {location}.", now)
        self._save()
        return self.keys[key_id]

    def issue_key(self, key_id, recipient, recipient_id, due_datetime, now=None):
        now = now or datetime.now()
        key_id = (key_id or "").strip().upper()
        recipient = (recipient or "").strip()
        recipient_id = (recipient_id or "").strip()

        if key_id not in self.keys:
            raise KeyNotFoundError(f"Key ID '{key_id}' does not exist.")
        if not recipient:
            raise ValidationError("Recipient name is required.")
        if not recipient_id:
            raise ValidationError("Recipient ID is required.")
        if self.keys[key_id]["status"] != "AVAILABLE":
            raise KeyUnavailableError(f"Key '{key_id}' is not available.")

        if isinstance(due_datetime, str):
            if not due_datetime.strip():
                raise InvalidDueDateError("Due date/time is required.")
            try:
                due_datetime = datetime.fromisoformat(due_datetime)
            except ValueError:
                raise InvalidDueDateError("Due date/time is not in a valid format.")
        if due_datetime <= now:
            raise InvalidDueDateError("Due date/time must be in the future.")

        transaction_id = self._next_transaction_id()
        transaction = {
            "transaction_id": transaction_id,
            "key_id": key_id,
            "recipient": recipient,
            "recipient_id": recipient_id,
            "issue_date": self._iso(now),
            "due_date": self._iso(due_datetime),
            "return_date": None,
            "status": "ISSUED",
        }
        # Validation passed for everything above before any data changed.
        self.transactions.append(transaction)
        self.keys[key_id]["status"] = "ISSUED"
        self._append_audit(
            "KEY_ISSUED",
            f"{key_id} issued to {recipient} ({recipient_id}); due {transaction['due_date']} - {transaction_id}.",
            now,
        )
        self._save()
        return transaction

    def return_key(self, reference, now=None):
        now = now or datetime.now()
        transaction = self._find_active_transaction(reference)

        transaction["return_date"] = self._iso(now)
        transaction["status"] = "RETURNED"
        self.keys[transaction["key_id"]]["status"] = "AVAILABLE"
        self._append_audit(
            "KEY_RETURNED",
            f"{transaction['key_id']} returned by {transaction['recipient']} - {transaction['transaction_id']}.",
            now,
        )
        self._save()
        return transaction

    # ------------------------------------------------------------- reports
    def list_keys(self):
        return sorted(self.keys.values(), key=lambda k: k["key_id"])

    def list_transactions(self):
        return sorted(self.transactions, key=lambda t: t["issue_date"], reverse=True)

    def list_audit_events(self):
        return sorted(self.audit_log, key=lambda e: e["timestamp"], reverse=True)

    def list_active_transactions(self, now=None):
        now = now or datetime.now()
        result = []
        for t in self.transactions:
            if t["status"] != "ISSUED":
                continue
            item = dict(t)
            item["display_status"] = self._status_for(t, now)
            result.append(item)
        return sorted(result, key=lambda t: t["due_date"])

    def list_overdue(self, now=None):
        now = now or datetime.now()
        result = []
        for t in self.transactions:
            if t["status"] != "ISSUED":
                continue
            due = datetime.fromisoformat(t["due_date"])
            if due < now:
                item = dict(t)
                minutes = int((now - due).total_seconds() // 60)
                item["overdue_minutes"] = minutes
                item["overdue_display"] = (
                    f"{minutes // 60} h {minutes % 60} min" if minutes >= 60 else f"{minutes} min"
                )
                result.append(item)
        return sorted(result, key=lambda t: t["due_date"])

    def list_due_soon(self, now=None, minutes=DUE_SOON_MINUTES):
        now = now or datetime.now()
        window_end = now + timedelta(minutes=minutes)
        result = []
        for t in self.transactions:
            if t["status"] != "ISSUED":
                continue
            due = datetime.fromisoformat(t["due_date"])
            if now <= due <= window_end:
                item = dict(t)
                item["minutes_remaining"] = int((due - now).total_seconds() // 60)
                result.append(item)
        return sorted(result, key=lambda t: t["due_date"])

    def get_dashboard_counts(self, now=None):
        now = now or datetime.now()
        keys = self.list_keys()
        return {
            "total": len(keys),
            "available": sum(1 for k in keys if k["status"] == "AVAILABLE"),
            "issued": sum(1 for k in keys if k["status"] == "ISSUED"),
            "overdue": len(self.list_overdue(now)),
            "due_soon": len(self.list_due_soon(now)),
            "returned": sum(1 for t in self.transactions if t["status"] == "RETURNED"),
        }

    def search(self, term):
        term = (term or "").strip().lower()
        if not term:
            return {"keys": [], "transactions": []}
        matched_keys = [
            k for k in self.keys.values()
            if term in k["key_id"].lower()
            or term in k["room"].lower()
            or term in k["location"].lower()
        ]
        matched_transactions = [
            t for t in self.transactions
            if term in t["transaction_id"].lower()
            or term in t["key_id"].lower()
            or term in t["recipient"].lower()
            or term in t["recipient_id"].lower()
            or term in t["status"].lower()
        ]
        return {"keys": matched_keys, "transactions": matched_transactions}
