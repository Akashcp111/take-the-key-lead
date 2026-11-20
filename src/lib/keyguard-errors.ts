export class KeyGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DuplicateKeyError extends KeyGuardError {}
export class KeyNotFoundError extends KeyGuardError {}
export class KeyUnavailableError extends KeyGuardError {}
export class InvalidDueDateError extends KeyGuardError {}
export class RecordNotFoundError extends KeyGuardError {}
export class ValidationError extends KeyGuardError {}