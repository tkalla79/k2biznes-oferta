import { describe, it, expect } from 'vitest';
import { RequestDeletionInput, ReviewDeletionInput, ExportRequestInput } from './rodo';

describe('RequestDeletionInput', () => {
  it('akceptuje sam email', () => {
    expect(RequestDeletionInput.parse({ email: 'k@e.com' })).toEqual({ email: 'k@e.com' });
  });
  it('akceptuje email + reason', () => {
    const r = RequestDeletionInput.parse({ email: 'k@e.com', reason: 'nie chcę' });
    expect(r.reason).toBe('nie chcę');
  });
  it('odrzuca niepoprawny email', () => {
    expect(() => RequestDeletionInput.parse({ email: 'not-email' })).toThrow();
  });
  it('odrzuca reason > 2000 znaków', () => {
    expect(() => RequestDeletionInput.parse({ email: 'k@e.com', reason: 'x'.repeat(2001) })).toThrow();
  });
});

describe('ReviewDeletionInput', () => {
  it.each(['approve', 'reject', 'execute'] as const)('akceptuje decision=%s', (decision) => {
    expect(ReviewDeletionInput.parse({ decision }).decision).toBe(decision);
  });
  it('odrzuca decision spoza enum', () => {
    expect(() => ReviewDeletionInput.parse({ decision: 'foo' })).toThrow();
  });
  it('akceptuje rejectReason + notes', () => {
    const r = ReviewDeletionInput.parse({
      decision: 'reject',
      rejectReason: 'duplikat',
      notes: 'wyjaśniono mailowo',
    });
    expect(r.rejectReason).toBe('duplikat');
  });
});

describe('ExportRequestInput', () => {
  it('wymaga email', () => {
    expect(ExportRequestInput.parse({ email: 'k@e.com' }).email).toBe('k@e.com');
    expect(() => ExportRequestInput.parse({})).toThrow();
  });
});
