import { describe, it, expect } from 'vitest';
import { resolveOfferCc } from './cc';

describe('resolveOfferCc', () => {
  it('kopia idzie do osoby kontaktowej', () => {
    expect(
      resolveOfferCc({ contactEmail: 't.kalla@k2biznes.pl', recipientEmail: 'klient@firma.pl' }),
    ).toEqual(['t.kalla@k2biznes.pl']);
  });

  it('brak osoby kontaktowej w ofercie = brak CC', () => {
    expect(resolveOfferCc({ contactEmail: null, recipientEmail: 'klient@firma.pl' })).toEqual([]);
    expect(resolveOfferCc({ recipientEmail: 'klient@firma.pl' })).toEqual([]);
  });

  it('osoba kontaktowa bez maila (puste / same spacje) = brak CC', () => {
    expect(resolveOfferCc({ contactEmail: '', recipientEmail: 'klient@firma.pl' })).toEqual([]);
    expect(resolveOfferCc({ contactEmail: '   ', recipientEmail: 'klient@firma.pl' })).toEqual([]);
  });

  it('śmieć w kolumnie email nie leci do Resend', () => {
    expect(resolveOfferCc({ contactEmail: 'tel. 601-000-000', recipientEmail: 'k@f.pl' })).toEqual(
      [],
    );
    expect(resolveOfferCc({ contactEmail: 'bez-domeny@localhost', recipientEmail: 'k@f.pl' })).toEqual(
      [],
    );
  });

  it('osoba kontaktowa = odbiorca: bez dublowania adresu', () => {
    expect(
      resolveOfferCc({ contactEmail: 'klient@firma.pl', recipientEmail: 'klient@firma.pl' }),
    ).toEqual([]);
  });

  it('porównanie adresów ignoruje wielkość liter i spacje', () => {
    expect(
      resolveOfferCc({ contactEmail: '  Klient@Firma.PL ', recipientEmail: 'klient@firma.pl' }),
    ).toEqual([]);
  });

  it('adres z katalogu jest przycinany ze spacji', () => {
    expect(
      resolveOfferCc({ contactEmail: '  t.kalla@k2biznes.pl  ', recipientEmail: 'k@f.pl' }),
    ).toEqual(['t.kalla@k2biznes.pl']);
  });
});
