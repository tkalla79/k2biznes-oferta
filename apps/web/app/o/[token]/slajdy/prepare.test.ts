import { describe, expect, it } from 'vitest';
import { CULTURE_SCOPE_EXEC, CULTURE_SCOPE_PREP, FAQ_ITEMS, SCOPE_EXEC, SCOPE_PREP } from '../staticContent';
import { grantFaq, proseTier, slideScope } from './prepare';

const row = (question: string, kind?: string | null) => ({ question, answer: `Odpowiedź: ${question}`, kind });

describe('grantFaq', () => {
  it('bierze tylko zestaw dotacyjny; brak i nieznany typ liczą się jako dotacja, jak na stronie', () => {
    const rows = [
      row('dotacja', 'grant'),
      row('pożyczka', 'loan'),
      row('zakres 2', 'exec'),
      row('null', null),
      row('brak pola'),
      row('nieznany', 'xyz'),
    ];
    expect(grantFaq(rows, FAQ_ITEMS).map((f) => f.q)).toEqual(['dotacja', 'null', 'brak pola', 'nieznany']);
    expect(grantFaq([row('dotacja', 'grant')], FAQ_ITEMS)).toEqual([{ q: 'dotacja', a: 'Odpowiedź: dotacja' }]);
  });

  it('bez wierszy dotacyjnych wraca do treści zaszytej w kodzie', () => {
    expect(grantFaq([], FAQ_ITEMS)).toBe(FAQ_ITEMS);
    expect(grantFaq([row('pożyczka', 'loan'), row('zakres 2', 'exec')], FAQ_ITEMS)).toBe(FAQ_ITEMS);
  });
});

describe('slideScope', () => {
  it('zadeklarowany wariant kultury działa bez słowa „EOG” w nazwie programu', () => {
    const s = slideScope({ name: 'Nabór krajowy', program: 'FENG', scopeVariant: 'culture' });
    expect(s.prep).toBe(CULTURE_SCOPE_PREP);
    expect(s.exec).toBe(CULTURE_SCOPE_EXEC);
    expect(s.hasExecFee).toBe(false);
  });

  it('zadeklarowany wariant standardowy wygrywa z nazwą zawierającą „EOG”', () => {
    const s = slideScope({ name: 'Program EOG', program: 'Fundusze Norweskie', scopeVariant: 'standard' });
    expect(s.prep).toBe(SCOPE_PREP);
    expect(s.hasExecFee).toBe(true);
  });

  it('oferta sprzed migracji (bez pola) wraca do rozpoznania po nazwie programu', () => {
    expect(slideScope({ name: 'Kultura', program: 'Fundusze Norweskie i EOG' }).hasExecFee).toBe(false);
    expect(slideScope({ name: 'Dig.IT', program: 'FENG 2.21' }).prep).toBe(SCOPE_PREP);
  });

  it('bez rekomendowanego programu zakres jest standardowy z opłatą wykonawczą', () => {
    const s = slideScope(null);
    expect(s.prep).toBe(SCOPE_PREP);
    expect(s.exec).toBe(SCOPE_EXEC);
    expect(s.hasExecFee).toBe(true);
  });
});

describe('proseTier', () => {
  it('liczy sam tekst bez znaczników i dobiera stopień wg progów kolumny', () => {
    const p = (n: number) => `<p>${'x'.repeat(n)}</p>`;
    expect(proseTier(p(850), false)).toBe('t0');
    expect(proseTier(p(851), false)).toBe('t1');
    expect(proseTier(p(1051), false)).toBe('t2');
    expect(proseTier(p(1301), false)).toBe('t3');
    expect(proseTier(p(1100), true)).toBe('t0');
    expect(proseTier(p(1701), true)).toBe('t3');
    expect(proseTier('<p><b>' + 'x'.repeat(840) + '</b></p>', false)).toBe('t0');
  });
});
