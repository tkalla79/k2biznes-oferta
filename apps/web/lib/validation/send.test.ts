import { describe, it, expect } from 'vitest';
import { SendOfferInput } from './send';

describe('SendOfferInput', () => {
  it('akceptuje tylko recipientEmail', () => {
    const r = SendOfferInput.parse({ recipientEmail: 'klient@example.com' });
    expect(r.recipientEmail).toBe('klient@example.com');
  });

  it('akceptuje pełny payload', () => {
    const r = SendOfferInput.parse({
      recipientEmail: 'klient@example.com',
      recipientName: 'Jan Kowalski',
      subject: 'Custom subject',
      message: 'Po naszej rozmowie...',
      expiresAt: '2026-12-31T23:59:00Z',
    });
    expect(r.message).toBe('Po naszej rozmowie...');
    expect(r.expiresAt).toBe('2026-12-31T23:59:00Z');
  });

  it('akceptuje expiresAt=null (wyczyszczenie)', () => {
    const r = SendOfferInput.parse({ recipientEmail: 'k@e.com', expiresAt: null });
    expect(r.expiresAt).toBeNull();
  });

  it('odrzuca niepoprawny email', () => {
    expect(() => SendOfferInput.parse({ recipientEmail: 'not-email' })).toThrow();
  });

  it('odrzuca niepoprawny expiresAt', () => {
    expect(() =>
      SendOfferInput.parse({ recipientEmail: 'k@e.com', expiresAt: '2026-12-31' }),
    ).toThrow();
  });

  it('odrzuca message > 2000 znaków', () => {
    expect(() =>
      SendOfferInput.parse({ recipientEmail: 'k@e.com', message: 'x'.repeat(2001) }),
    ).toThrow();
  });
});
