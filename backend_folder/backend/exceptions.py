"""Custom exceptions for KEYGUARD business rules.

Routes (app.py) catch KeyGuardError and show the message to the user
with flash() -- never a raw traceback.
"""


class KeyGuardError(Exception):
    """Base class for all KEYGUARD business-rule errors."""


class DuplicateKeyError(KeyGuardError):
    """Raised when registering a Key ID that already exists."""


class KeyNotFoundError(KeyGuardError):
    """Raised when a referenced Key ID does not exist."""


class KeyUnavailableError(KeyGuardError):
    """Raised when trying to issue a key that is not AVAILABLE."""


class InvalidDueDateError(KeyGuardError):
    """Raised when a due date/time is missing, malformed, or not in the future."""


class RecordNotFoundError(KeyGuardError):
    """Raised when a transaction/key reference has no matching active record."""


class ValidationError(KeyGuardError):
    """Raised for missing or malformed required input."""
