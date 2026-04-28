import { describe, it, expect } from 'vitest';
import {
  ProgramInput,
  ProgramUpdate,
  CaseStudyInput,
  ContactPersonInput,
  slugify,
} from './catalog';

describe('slugify', () => {
  it('konwertuje na lowercase + myślniki + zdejmuje polskie znaki', () => {
    expect(slugify('FENG · Ścieżka SMART')).toBe('feng-sciezka-smart');
  });
  it('przycina trailing/leading myślniki', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });
  it('zwraca pusty string dla samych specjalnych znaków', () => {
    expect(slugify('!!!')).toBe('');
  });
  it('limit 80 znaków', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});

describe('ProgramInput', () => {
  it('akceptuje minimum required (auto-slug)', () => {
    const r = ProgramInput.parse({ group_name: 'FENG', label: 'Ścieżka SMART' });
    expect(r.label).toBe('Ścieżka SMART');
    expect(r.is_active).toBe(true);
    expect(r.display_order).toBe(100);
  });
  it('odrzuca pusty group_name', () => {
    expect(() => ProgramInput.parse({ group_name: '', label: 'X' })).toThrow();
  });
  it('id musi być slug-iem (lowercase, [a-z0-9-])', () => {
    expect(() => ProgramInput.parse({ id: 'BadID', group_name: 'G', label: 'L' })).toThrow();
    expect(() => ProgramInput.parse({ id: '-no-leading', group_name: 'G', label: 'L' })).toThrow();
    expect(ProgramInput.parse({ id: 'feng-smart', group_name: 'G', label: 'L' }).id).toBe('feng-smart');
  });
});

describe('ProgramUpdate', () => {
  it('wszystkie pola opcjonalne', () => {
    expect(ProgramUpdate.parse({})).toEqual({});
  });
  it('akceptuje partial update', () => {
    const r = ProgramUpdate.parse({ is_active: false, display_order: 50 });
    expect(r.is_active).toBe(false);
    expect(r.display_order).toBe(50);
  });
  it('NIE akceptuje id (read-only po stworzeniu)', () => {
    // Omit('id') powinno wyrzucić w stripowaniu — Zod default z .partial().omit() zwraca strict
    const parsed = ProgramUpdate.parse({ id: 'evil', label: 'X' });
    expect((parsed as { id?: string }).id).toBeUndefined();
  });
});

describe('CaseStudyInput', () => {
  it('przyjmuje industries jako CSV string', () => {
    const r = CaseStudyInput.parse({
      client: 'X',
      title: 'Y',
      industries: 'produkcja, metalurgia, IT',
      program_tags: 'feng-smart',
    });
    expect(r.industries).toEqual(['produkcja', 'metalurgia', 'IT']);
    expect(r.program_tags).toEqual(['feng-smart']);
  });
  it('przyjmuje industries jako tablicę', () => {
    const r = CaseStudyInput.parse({ client: 'X', title: 'Y', industries: ['a', 'b'] });
    expect(r.industries).toEqual(['a', 'b']);
  });
  it('puste industries → pusta tablica', () => {
    const r = CaseStudyInput.parse({ client: 'X', title: 'Y', industries: '' });
    expect(r.industries).toEqual([]);
  });
  it('odrzuca niepoprawny URL w logo_big', () => {
    expect(() =>
      CaseStudyInput.parse({ client: 'X', title: 'Y', logo_big: 'not-a-url' }),
    ).toThrow();
  });
  it('akceptuje null w logo_big/logo_sm', () => {
    const r = CaseStudyInput.parse({ client: 'X', title: 'Y', logo_big: null, logo_sm: null });
    expect(r.logo_big).toBeNull();
  });
});

describe('ContactPersonInput', () => {
  it('akceptuje minimum required', () => {
    const r = ContactPersonInput.parse({ name: 'Jan Kowalski', role: 'CEO' });
    expect(r.is_active).toBe(true);
  });
  it('odrzuca niepoprawny email', () => {
    expect(() =>
      ContactPersonInput.parse({ name: 'X', role: 'Y', email: 'not-email' }),
    ).toThrow();
  });
  it('akceptuje null w optional polach', () => {
    const r = ContactPersonInput.parse({
      name: 'X',
      role: 'Y',
      phone: null,
      email: null,
      photo_url: null,
    });
    expect(r.phone).toBeNull();
    expect(r.email).toBeNull();
  });
});
