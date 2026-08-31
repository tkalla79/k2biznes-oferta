import { describe, expect, it } from 'vitest';
import { sanitizeRichText, sanitizeProse } from './richtext';

describe('sanitizeRichText', () => {
  it('zachowuje dozwolone znaczniki', () => {
    expect(sanitizeRichText('<p>tekst <strong>ważny</strong></p>')).toBe(
      '<p>tekst <strong>ważny</strong></p>',
    );
  });

  it('usuwa script i atrybuty zdarzeń', () => {
    expect(sanitizeRichText('<p onclick="x()">a</p><script>alert(1)</script>')).toBe('<p>a</p>');
  });

  it('puste wejście -> pusty string', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText(undefined)).toBe('');
  });
});

describe('sanitizeProse', () => {
  it('HTML z edytora przechodzi przez sanitizację', () => {
    const out = sanitizeProse('<p>Rekomendujemy <strong>FENG 2.33</strong></p><script>x</script>');
    expect(out).toBe('<p>Rekomendujemy <strong>FENG 2.33</strong></p>');
  });

  it('czysty tekst: puste linie dzielą akapity', () => {
    const out = sanitizeProse('Pierwszy akapit.\n\nDrugi akapit.');
    expect(out).toBe('<p>Pierwszy akapit.</p><p>Drugi akapit.</p>');
  });

  it('czysty tekst: pojedynczy enter to <br>, nie nowy akapit', () => {
    expect(sanitizeProse('linia A\nlinia B')).toBe('<p>linia A<br />linia B</p>');
  });

  it('czysty tekst jest escapowany — nie wstrzykuje markupu', () => {
    // Bez znacznika HTML w calosci: 5 < 7 nie moze stac sie tagiem.
    const out = sanitizeProse('Wsparcie 5 < 7 & "tak"');
    expect(out).toBe('<p>Wsparcie 5 &lt; 7 &amp; &quot;tak&quot;</p>');
    expect(out).not.toContain('<7');
  });

  it('tekst z osadzonym tagiem idzie ścieżką HTML i traci niedozwolone znaczniki', () => {
    const out = sanitizeProse('Uwaga <img src=x onerror=alert(1)> koniec');
    expect(out).not.toContain('img');
    expect(out).toContain('Uwaga');
    expect(out).toContain('koniec');
  });

  it('nadmiarowe puste linie i białe znaki nie tworzą pustych akapitów', () => {
    expect(sanitizeProse('  A  \n\n\n\n  B  \n\n')).toBe('<p>A</p><p>B</p>');
  });

  it('puste wejście -> pusty string', () => {
    expect(sanitizeProse('')).toBe('');
    expect(sanitizeProse(null)).toBe('');
    expect(sanitizeProse('   \n\n  ')).toBe('');
  });
});
