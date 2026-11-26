export type PgContextErrorCode =
  | 'MISSING_IDENTITY'
  | 'INVALID_CONTEXT'
  | 'FORBIDDEN_TENANT'
  | 'PRIVILEGE_ESCALATION';

export class PgContextError extends Error {
  public readonly code: PgContextErrorCode;

  constructor(code: PgContextErrorCode, message: string) {
    super(message);
    this.name = 'PgContextError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
