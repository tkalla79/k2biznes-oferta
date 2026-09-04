import { describe, it, expect } from 'vitest';
import { SigninInput, MagicLinkInput, InviteUserInput, UpdateRoleInput,
  UpdateUserStatusInput,
} from './auth';

describe('SigninInput', () => {
  it('akceptuje email + password', () => {
    const r = SigninInput.parse({ email: 'a@b.com', password: '12345678' });
    expect(r.email).toBe('a@b.com');
  });
  it('odrzuca password < 8 znaków', () => {
    expect(() => SigninInput.parse({ email: 'a@b.com', password: 'short' })).toThrow();
  });
  it('odrzuca niepoprawny email', () => {
    expect(() => SigninInput.parse({ email: 'not-email', password: '12345678' })).toThrow();
  });
});

describe('MagicLinkInput', () => {
  it('akceptuje sam email', () => {
    expect(MagicLinkInput.parse({ email: 'a@b.com' }).email).toBe('a@b.com');
  });
  it('akceptuje email + redirectTo', () => {
    const r = MagicLinkInput.parse({ email: 'a@b.com', redirectTo: '/admin/offers' });
    expect(r.redirectTo).toBe('/admin/offers');
  });
});

describe('InviteUserInput', () => {
  it('default role consultant', () => {
    const r = InviteUserInput.parse({ email: 'a@b.com', fullName: 'Jan Kowalski' });
    expect(r.role).toBe('consultant');
  });
  it('akceptuje admin/super_admin', () => {
    expect(InviteUserInput.parse({ email: 'a@b.com', fullName: 'X', role: 'admin' }).role).toBe('admin');
    expect(InviteUserInput.parse({ email: 'a@b.com', fullName: 'X', role: 'super_admin' }).role).toBe('super_admin');
  });
  it('odrzuca rolę spoza enum', () => {
    expect(() =>
      InviteUserInput.parse({ email: 'a@b.com', fullName: 'X', role: 'guest' as never }),
    ).toThrow();
  });
  it('odrzuca pusty fullName', () => {
    expect(() => InviteUserInput.parse({ email: 'a@b.com', fullName: '' })).toThrow();
  });
});

describe('UpdateRoleInput', () => {
  it.each(['consultant', 'admin', 'super_admin'] as const)('akceptuje %s', (role) => {
    expect(UpdateRoleInput.parse({ role }).role).toBe(role);
  });
  it('odrzuca rolę spoza enum', () => {
    expect(() => UpdateRoleInput.parse({ role: 'guest' as never })).toThrow();
  });
});

describe('UpdateUserStatusInput', () => {
  it('przyjmuje isActive true/false', () => {
    expect(UpdateUserStatusInput.parse({ isActive: false })).toEqual({ isActive: false });
    expect(UpdateUserStatusInput.parse({ isActive: true })).toEqual({ isActive: true });
  });

  it('odrzuca brak pola i wartości nie-boolowskie', () => {
    expect(() => UpdateUserStatusInput.parse({})).toThrow();
    expect(() => UpdateUserStatusInput.parse({ isActive: 'false' })).toThrow();
    expect(() => UpdateUserStatusInput.parse({ isActive: 0 })).toThrow();
  });

  it('ignoruje nadmiarowe pola — nie da się przemycić np. roli', () => {
    expect(UpdateUserStatusInput.parse({ isActive: false, role: 'super_admin' })).toEqual({
      isActive: false,
    });
  });
});
