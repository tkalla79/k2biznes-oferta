import { describe, it, expect } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('akceptuje ścieżkę względną', () => {
    expect(safeNext('/admin/offers')).toBe('/admin/offers');
  });
  it('zwraca fallback dla undefined', () => {
    expect(safeNext(undefined)).toBe('/admin');
    expect(safeNext(null)).toBe('/admin');
  });
  it('zwraca fallback dla pustego stringa', () => {
    expect(safeNext('')).toBe('/admin');
  });
  it('blokuje absolute URL (http)', () => {
    expect(safeNext('http://evil.com')).toBe('/admin');
    expect(safeNext('https://evil.com/admin')).toBe('/admin');
  });
  it('blokuje protocol-relative `//evil.com`', () => {
    expect(safeNext('//evil.com')).toBe('/admin');
    expect(safeNext('//evil.com/path')).toBe('/admin');
  });
  it('blokuje backslash bypass', () => {
    expect(safeNext('/\\evil.com')).toBe('/admin');
    expect(safeNext('/foo\\bar')).toBe('/admin');
  });
  it('blokuje ścieżki bez leading slash', () => {
    expect(safeNext('admin')).toBe('/admin');
    expect(safeNext('javascript:alert(1)')).toBe('/admin');
  });
  it('akceptuje custom fallback', () => {
    expect(safeNext(undefined, '/offers')).toBe('/offers');
    expect(safeNext('https://evil.com', '/offers')).toBe('/offers');
  });
  it('akceptuje query string i hash', () => {
    expect(safeNext('/admin?tab=stats')).toBe('/admin?tab=stats');
    expect(safeNext('/o/abc123#section-2')).toBe('/o/abc123#section-2');
  });
});
