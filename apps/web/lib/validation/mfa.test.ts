import { describe, it, expect } from 'vitest';
import { EnrollMfaInput, VerifyMfaInput, UnenrollMfaInput } from './mfa';

describe('EnrollMfaInput', () => {
  it('default friendlyName = TOTP', () => {
    expect(EnrollMfaInput.parse({}).friendlyName).toBe('TOTP');
  });
  it('akceptuje custom friendlyName', () => {
    expect(EnrollMfaInput.parse({ friendlyName: 'iPhone 14' }).friendlyName).toBe('iPhone 14');
  });
  it('odrzuca pusty friendlyName', () => {
    expect(() => EnrollMfaInput.parse({ friendlyName: '' })).toThrow();
  });
  it('odrzuca friendlyName > 80 znaków', () => {
    expect(() => EnrollMfaInput.parse({ friendlyName: 'x'.repeat(81) })).toThrow();
  });
});

describe('VerifyMfaInput', () => {
  const validUuid = '00000000-0000-0000-0000-000000000001';
  it('akceptuje 6-cyfrowy kod', () => {
    const r = VerifyMfaInput.parse({ factorId: validUuid, code: '123456' });
    expect(r.code).toBe('123456');
  });
  it('akceptuje 8-cyfrowy kod', () => {
    expect(VerifyMfaInput.parse({ factorId: validUuid, code: '12345678' }).code).toBe(
      '12345678',
    );
  });
  it('odrzuca kod < 6 cyfr', () => {
    expect(() => VerifyMfaInput.parse({ factorId: validUuid, code: '12345' })).toThrow();
  });
  it('odrzuca kod z literami', () => {
    expect(() => VerifyMfaInput.parse({ factorId: validUuid, code: '12a456' })).toThrow();
  });
  it('odrzuca niepoprawny factorId', () => {
    expect(() => VerifyMfaInput.parse({ factorId: 'not-uuid', code: '123456' })).toThrow();
  });
});

describe('UnenrollMfaInput', () => {
  it('akceptuje uuid', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    expect(UnenrollMfaInput.parse({ factorId: id }).factorId).toBe(id);
  });
  it('odrzuca brak factorId', () => {
    expect(() => UnenrollMfaInput.parse({})).toThrow();
  });
});
