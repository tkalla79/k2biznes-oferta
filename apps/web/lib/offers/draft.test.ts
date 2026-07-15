import { describe, it, expect } from 'vitest';
import { buildDraftData, type DraftLibItem } from './draft';

const LIB: DraftLibItem[] = [
  { id: 'feng-smart', name: 'FENG Ścieżka SMART', program: 'FENG', nabor: 'nabór 1/2026', desc: 'B+R i wdrożenia' },
  { id: 'kpo-a2', name: 'KPO A2.1.1', program: 'KPO', nabor: null, desc: null },
];

describe('buildDraftData — defensywna normalizacja wyjścia modelu', () => {
  it('mapuje poprawne pola i dodaje ostrzeżenie o kwocie', () => {
    const out = buildDraftData(
      {
        clientName: '  Tefa Group Sp. z o.o. ',
        clientNip: '1234563218',
        clientIndustry: 'produkcja',
        clientCompanySize: 'medium',
        clientVoivodeship: 'mazowieckie',
        recommendationBasis: 'Potrzeby: automatyzacja. Podstawa: FENG.',
        projectValue: 4_000_000,
        suggestedProgramId: 'feng-smart',
        warnings: ['Branża przyjęta z kontekstu.'],
      },
      LIB,
    );
    expect(out.fields.clientName).toBe('Tefa Group Sp. z o.o.');
    expect(out.fields.clientNip).toBe('1234563218');
    expect(out.fields.clientCompanySize).toBe('medium');
    expect(out.fields.clientVoivodeship).toBe('mazowieckie');
    expect(out.fields.projectValue).toBe(4_000_000);
    expect(out.suggestedProgram?.id).toBe('feng-smart');
    expect(out.warnings).toContain('Branża przyjęta z kontekstu.');
    expect(out.warnings.some((w) => w.includes('potwierdź kwotę'))).toBe(true);
  });

  it('odrzuca NIP o złej długości, ale czyści separatory z poprawnego', () => {
    expect(buildDraftData({ clientNip: '123-456' }, LIB).fields.clientNip).toBeNull();
    expect(buildDraftData({ clientNip: '123 456 32 18' }, LIB).fields.clientNip).toBe('1234563218');
  });

  it('odrzuca nieprawidłowe enumy (wielkość firmy, województwo)', () => {
    const out = buildDraftData(
      { clientCompanySize: 'gigantyczna', clientVoivodeship: 'Warszawa' },
      LIB,
    );
    expect(out.fields.clientCompanySize).toBeNull();
    expect(out.fields.clientVoivodeship).toBeNull();
  });

  it('odrzuca nierealne/niebędące liczbą kwoty i wtedy nie dodaje ostrzeżenia o kwocie', () => {
    for (const bad of [-100, 0, 2_000_000_000, '4000000', null, undefined, NaN]) {
      const out = buildDraftData({ projectValue: bad as unknown }, LIB);
      expect(out.fields.projectValue).toBeNull();
      expect(out.warnings.some((w) => w.includes('potwierdź kwotę'))).toBe(false);
    }
  });

  it('zaokrągla ułamkowe kwoty', () => {
    expect(buildDraftData({ projectValue: 3_500_000.6 }, LIB).fields.projectValue).toBe(3_500_001);
  });

  it('ignoruje sugestię programu spoza biblioteki', () => {
    expect(buildDraftData({ suggestedProgramId: 'nie-istnieje' }, LIB).suggestedProgram).toBeNull();
    expect(buildDraftData({ suggestedProgramId: 'kpo-a2' }, LIB).suggestedProgram?.id).toBe('kpo-a2');
  });

  it('przycina recommendationBasis do 1500 znaków', () => {
    const long = 'x'.repeat(3000);
    expect(buildDraftData({ recommendationBasis: long }, LIB).fields.recommendationBasis).toHaveLength(1500);
  });

  it('puste/śmieciowe wejście → same null-e, tylko ostrzeżenia serwera', () => {
    const out = buildDraftData({}, LIB, ['Przeanalizowano tylko fragment.']);
    expect(out.fields.clientName).toBeNull();
    expect(out.fields.projectValue).toBeNull();
    expect(out.suggestedProgram).toBeNull();
    expect(out.warnings).toEqual(['Przeanalizowano tylko fragment.']);
  });
});
