/**
 * Treść pożyczkowa zależna od tego, czy oferta podała własną podstawę
 * naliczenia success fee (`content.loan.sfNote`).
 *
 * Testy pilnują jednej rzeczy: żadne miejsce w ofercie nie może twierdzić, że
 * wynagrodzenie wynikowe liczy się od kwoty pożyczki, jeśli oferta mówi co
 * innego przy samej kwocie.
 */
import { describe, expect, it } from 'vitest';
import {
  loanFaqItems,
  LOAN_PRICING_LEAD,
  LOAN_PRICING_LEAD_CUSTOM_BASIS,
} from './staticContent';

const SF_FEE_Q = 'Kiedy płacę wynagrodzenie wynikowe?';
const sfFeeAnswer = (sfNote: string | undefined) =>
  loanFaqItems(sfNote).find((i) => i.q === SF_FEE_Q)!.a;

describe('loanFaqItems', () => {
  it('brak sfNote → odpowiedź domyślna nazywa podstawę naliczenia', () => {
    expect(sfFeeAnswer(undefined)).toContain('kwoty faktycznie przyznanej pożyczki');
  });

  it('własny sfNote → odpowiedź nie twierdzi już, od czego liczymy', () => {
    const a = sfFeeAnswer('2% kwoty umorzenia kapitału');
    expect(a).not.toContain('przyznanej pożyczki');
    expect(a).toContain('Model wynagrodzenia');
  });

  it('pusty sfNote też zdejmuje twierdzenie — oferta świadomie nie podaje podstawy', () => {
    expect(sfFeeAnswer('')).not.toContain('przyznanej pożyczki');
  });

  it('prawda niezależna od wariantu zostaje: brak pożyczki = brak wynagrodzenia', () => {
    for (const note of [undefined, '', '2% kwoty umorzenia']) {
      expect(sfFeeAnswer(note)).toContain('wynagrodzenie wynikowe nie jest należne');
    }
  });

  it('pozostałe pytania są te same w obu wariantach', () => {
    expect(loanFaqItems(undefined).map((i) => i.q)).toEqual(
      loanFaqItems('cokolwiek').map((i) => i.q),
    );
  });
});

describe('LOAN_PRICING_LEAD', () => {
  it('wariant domyślny nazywa podstawę, wariant z nadpisaniem jej nie nazywa', () => {
    expect(LOAN_PRICING_LEAD).toContain('liczonym od kwoty przyznanej pożyczki');
    expect(LOAN_PRICING_LEAD_CUSTOM_BASIS).not.toContain('przyznanej pożyczki');
  });
});
