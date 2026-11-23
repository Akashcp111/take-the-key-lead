"""Unit tests for KeyService business rules (normal, boundary, failure cases)."""
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from exceptions import (
    DuplicateKeyError,
    InvalidDueDateError,
    KeyNotFoundError,
    KeyUnavailableError,
    RecordNotFoundError,
)
from service import KeyService

FIXED_NOW = datetime(2026, 11, 21, 12, 0, 0)


class KeyServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.service = KeyService(data_dir=self.tmp_dir)

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    # ---- registration ----
    def test_register_new_key(self):
        key = self.service.register_key("K201", "Store Room", "Block D")
        self.assertEqual(key["status"], "AVAILABLE")

    def test_reject_duplicate_key(self):
        self.service.register_key("K201", "Store Room", "Block D")
        with self.assertRaises(DuplicateKeyError):
            self.service.register_key("K201", "Store Room", "Block D")

    # ---- issue ----
    def test_issue_available_key(self):
        due = FIXED_NOW + timedelta(hours=4)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        self.assertEqual(t["status"], "ISSUED")
        self.assertEqual(self.service.keys["K104"]["status"], "ISSUED")

    def test_reject_issue_of_issued_key(self):
        due = FIXED_NOW + timedelta(hours=4)
        self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        with self.assertRaises(KeyUnavailableError):
            self.service.issue_key("K104", "Another User", "STU998", due, now=FIXED_NOW)

    def test_reject_unknown_key(self):
        with self.assertRaises(KeyNotFoundError):
            self.service.issue_key(
                "K999", "Test User", "STU999", FIXED_NOW + timedelta(hours=1), now=FIXED_NOW
            )

    def test_reject_due_time_equal_to_now(self):
        with self.assertRaises(InvalidDueDateError):
            self.service.issue_key("K104", "Test User", "STU999", FIXED_NOW, now=FIXED_NOW)

    def test_reject_due_time_before_now(self):
        with self.assertRaises(InvalidDueDateError):
            self.service.issue_key(
                "K104", "Test User", "STU999", FIXED_NOW - timedelta(minutes=1), now=FIXED_NOW
            )

    # ---- return ----
    def test_return_by_transaction_id(self):
        due = FIXED_NOW + timedelta(hours=4)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        closed = self.service.return_key(t["transaction_id"], now=FIXED_NOW + timedelta(hours=1))
        self.assertEqual(closed["status"], "RETURNED")
        self.assertEqual(self.service.keys["K104"]["status"], "AVAILABLE")

    def test_return_by_key_id(self):
        due = FIXED_NOW + timedelta(hours=4)
        self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        closed = self.service.return_key("K104", now=FIXED_NOW + timedelta(hours=1))
        self.assertEqual(closed["status"], "RETURNED")

    def test_reject_unknown_return_reference(self):
        with self.assertRaises(RecordNotFoundError):
            self.service.return_key("TX9999", now=FIXED_NOW)

    def test_reject_double_return(self):
        due = FIXED_NOW + timedelta(hours=4)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        self.service.return_key(t["transaction_id"], now=FIXED_NOW + timedelta(hours=1))
        with self.assertRaises(RecordNotFoundError):
            self.service.return_key(t["transaction_id"], now=FIXED_NOW + timedelta(hours=2))

    # ---- overdue / due-soon boundaries ----
    def test_overdue_excludes_returned(self):
        due = FIXED_NOW + timedelta(minutes=10)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        later = FIXED_NOW + timedelta(hours=2)
        self.service.return_key(t["transaction_id"], now=later)
        overdue = self.service.list_overdue(now=later)
        self.assertFalse(any(o["transaction_id"] == t["transaction_id"] for o in overdue))

    def test_due_exactly_now_is_due_soon_not_overdue(self):
        due = FIXED_NOW + timedelta(minutes=5)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        overdue = self.service.list_overdue(now=due)
        due_soon = self.service.list_due_soon(now=due)
        self.assertFalse(any(o["transaction_id"] == t["transaction_id"] for o in overdue))
        self.assertTrue(any(d["transaction_id"] == t["transaction_id"] for d in due_soon))

    def test_due_30_minutes_ahead_is_due_soon(self):
        due = FIXED_NOW + timedelta(minutes=30)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        due_soon = self.service.list_due_soon(now=FIXED_NOW)
        self.assertTrue(any(d["transaction_id"] == t["transaction_id"] for d in due_soon))

    def test_due_31_minutes_ahead_is_not_due_soon(self):
        due = FIXED_NOW + timedelta(minutes=31)
        t = self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        due_soon = self.service.list_due_soon(now=FIXED_NOW)
        self.assertFalse(any(d["transaction_id"] == t["transaction_id"] for d in due_soon))

    # ---- search / persistence / audit ----
    def test_search_is_case_insensitive_and_partial(self):
        due = FIXED_NOW + timedelta(hours=4)
        self.service.issue_key("K104", "Rahul Sharma", "EMP101", due, now=FIXED_NOW)
        results = self.service.search("rahul")
        self.assertTrue(any(t["recipient"] == "Rahul Sharma" for t in results["transactions"]))

    def test_data_persists_across_reload(self):
        due = FIXED_NOW + timedelta(hours=4)
        self.service.issue_key("K104", "Test User", "STU999", due, now=FIXED_NOW)
        before = len(self.service.transactions)
        reloaded = KeyService(data_dir=self.tmp_dir)
        self.assertEqual(reloaded.keys["K104"]["status"], "ISSUED")
        self.assertEqual(len(reloaded.transactions), before)

    def test_audit_event_appended_on_register(self):
        start = len(self.service.audit_log)
        self.service.register_key("K201", "Store Room", "Block D")
        self.assertEqual(len(self.service.audit_log), start + 1)
        self.assertEqual(self.service.audit_log[-1]["action"], "KEY_REGISTERED")


if __name__ == "__main__":
    unittest.main()
