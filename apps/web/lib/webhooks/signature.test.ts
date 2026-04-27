import { describe, it, expect, beforeEach } from 'vitest';
import { signWebhookBody, verifyWebhookSignature } from './signature';

describe('signWebhookBody / verifyWebhookSignature', () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_HUBSPOT = 'test-secret-1';
    process.env.WEBHOOK_SECRET_PIPEDRIVE = 'test-secret-2';
  });

  it('generuje stabilną sygnaturę dla tego samego inputu', () => {
    const sig1 = signWebhookBody('hubspot', '{"event":"offer.accepted"}');
    const sig2 = signWebhookBody('hubspot', '{"event":"offer.accepted"}');
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('różny secret per target → różne sygnatury', () => {
    const sigA = signWebhookBody('hubspot', '{"event":"x"}');
    const sigB = signWebhookBody('pipedrive', '{"event":"x"}');
    expect(sigA).not.toBe(sigB);
  });

  it('różny body → różne sygnatury', () => {
    const sigA = signWebhookBody('hubspot', '{"a":1}');
    const sigB = signWebhookBody('hubspot', '{"a":2}');
    expect(sigA).not.toBe(sigB);
  });

  it('rzuca gdy secret nie ustawiony', () => {
    delete process.env.WEBHOOK_SECRET_CUSTOM;
    expect(() => signWebhookBody('custom', 'body')).toThrow(/WEBHOOK_SECRET_CUSTOM/);
  });

  it('verify zwraca true dla poprawnej sygnatury', () => {
    const body = '{"x":1}';
    const sig = signWebhookBody('hubspot', body);
    expect(verifyWebhookSignature('hubspot', body, sig)).toBe(true);
  });

  it('verify zwraca false dla zmodyfikowanego body', () => {
    const sig = signWebhookBody('hubspot', '{"x":1}');
    expect(verifyWebhookSignature('hubspot', '{"x":2}', sig)).toBe(false);
  });

  it('verify zwraca false gdy header brak/nieprawidłowy format', () => {
    expect(verifyWebhookSignature('hubspot', 'body', null)).toBe(false);
    expect(verifyWebhookSignature('hubspot', 'body', undefined)).toBe(false);
    expect(verifyWebhookSignature('hubspot', 'body', 'plain-text')).toBe(false);
    expect(verifyWebhookSignature('hubspot', 'body', 'md5=abc')).toBe(false);
  });

  it('verify jest timing-safe (a/b o tej samej długości)', () => {
    const sig = signWebhookBody('hubspot', 'body');
    // Zmiana ostatniego znaku — same length, fail
    const tampered = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0');
    expect(verifyWebhookSignature('hubspot', 'body', tampered)).toBe(false);
  });
});
