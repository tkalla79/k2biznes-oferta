import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { PricingVariant } from '@/lib/pricing';
import { CoverSlide, ProgramSlide, PricingSlide, ClosingSlide, statusBadge } from './slides';
import { ScopeSlide, ProcessSlide, FaqSlide } from './slides-info';
import { IntroSlide, BulletsSlide, NotesSlide, AboutSlide, resolveNotesExec } from './slides-text';

// Dane przykładowe oferty dotacyjnej (wartość projektu 1 000 000 zł, 50%). Klient i numer oferty są fikcyjne.
const variants: PricingVariant[] = [
  { id: 'I', name: 'Wariant I', tag: 'Szybka płatność', sfPct: 0.04, sfAmount: 20000, base: 8000, monthly: 1000, total: 28000,
    payment: [{ pct: 100, when: 'w 14 dni od podpisania umowy' }] },
  { id: 'II', name: 'Wariant II', tag: 'Rozłożony SF', sfPct: 0.065, sfAmount: 32500, base: 8000, monthly: 1000, total: 40500,
    payment: [{ pct: 50, when: 'po podpisaniu umowy' }, { pct: 50, when: 'po wniosku o płatność końcową' }] },
  { id: 'III', name: 'Wariant III', tag: '12 rat', sfPct: 0.078, sfAmount: 39000, base: 8000, monthly: 1000, total: 47000,
    payment: [{ pct: 25, when: 'po podpisaniu umowy' }, { pct: 75, when: 'w 12 ratach' }] },
] as PricingVariant[];

// Intl wstawia twarde spacje w kwotach; normalizujemy, żeby porównywać zwykły tekst.
const html = (el: ReactElement) => renderToStaticMarkup(el).replace(/[  ]/g, ' ');

const pricing = (execFee: { label: string; monthly: number | null } | null) =>
  html(
    <PricingSlide no="04" footer="Oferta K2/2026/01/001" d={{ variants, selectedId: 'III', projectValue: 1_000_000, fundingRate: 0.5, funding: 500_000, execFee }} />,
  );

describe('slajdy oferty', () => {
  it('okładka: tytuł zależy od oferty łączonej i nie ma stopki', () => {
    const d = { offerNumber: 'K2/2026/01/001', dateLabel: '01.01.2026', clientName: 'Przykładowa Firma Sp. z o.o.', programLabel: 'Dig.IT', validUntil: null };
    const joined = html(<CoverSlide d={{ ...d, execIncluded: true }} />);
    expect(joined).toContain('oraz jego obsługi i rozliczania');
    expect(joined).toContain('Przykładowa Firma Sp. z o.o.');
    expect(joined).not.toContain('sl-foot');
    expect(html(<CoverSlide d={{ ...d, execIncluded: false }} />)).toContain('dokumentacji projektu');
  });

  it('okładka: oznaczenie statusu tylko dla oferty nieaktywnej o statusie końcowym', () => {
    const d = { offerNumber: 'K2/2026/01/001', dateLabel: '01.01.2026', clientName: 'Przykładowa Firma Sp. z o.o.', programLabel: 'Dig.IT', validUntil: null, execIncluded: true };
    expect(statusBadge('accepted', false)).toBe('accepted');
    expect(statusBadge('rejected', false)).toBe('rejected');
    expect(statusBadge('expired', false)).toBe('expired');
    // aktywna oferta, status roboczy i nazwy z prototypu obiektu nie dostają oznaczenia
    expect(statusBadge('sent', true)).toBeNull();
    expect(statusBadge('viewed', true)).toBeNull();
    expect(statusBadge('accepted', true)).toBeNull();
    expect(statusBadge('draft', false)).toBeNull();
    expect(statusBadge('toString', false)).toBeNull();
    const accepted = html(<CoverSlide d={{ ...d, status: 'accepted' }} />);
    expect(accepted).toContain('sl-pill--accepted');
    expect(accepted).toContain('Oferta zaakceptowana');
    expect(accepted).toContain('K2/2026/01/001 · 01.01.2026');
    expect(html(<CoverSlide d={{ ...d, status: 'rejected' }} />)).toContain('Oferta odrzucona');
    expect(html(<CoverSlide d={{ ...d, status: 'expired' }} />)).toContain('Oferta wygasła');
    for (const status of [null, undefined]) {
      expect(html(<CoverSlide d={{ ...d, status }} />)).not.toContain('sl-pill--');
    }
  });

  it('cennik: kwoty, procenty, jeden rekomendowany wariant i trzy kolumny', () => {
    const out = pricing({ label: 'Obsługa i rozliczanie projektu: Wynagrodzenie miesięczne', monthly: null });
    for (const t of ['28 000 zł', '40 500 zł', '47 000 zł', '6,5%', '7,8%', '500 000 zł', '1 000 zł netto / miesiąc']) {
      expect(out).toContain(t);
    }
    expect(out.match(/Rekomendowany/g)).toHaveLength(1);
    expect(out).not.toContain('Wybrany');
    expect(out).toContain('repeat(3, minmax(0, 1fr))');
  });

  it('cennik: bez opłaty wykonawczej, gdy execFee=null', () => {
    expect(pricing(null)).not.toContain('sl-exec');
  });

  it('program: karta rekomendacji tylko gdy jest pozycja z biblioteki', () => {
    const base = { programLabel: 'Dig.IT', descriptionHtml: '<p>Opis</p>' };
    const withReco = html(<ProgramSlide no="02" footer="x" d={{ ...base, reco: { program: 'FENG 2.21', name: 'Dig.IT', nabor: '02.11.2026 - 30.11.2026', desc: 'Tekst' } }} />);
    expect(withReco).toContain('REKOMENDOWANY');
    expect(withReco).toContain('Nabór: <strong>02.11.2026 - 30.11.2026</strong>');
    expect(html(<ProgramSlide no="02" footer="x" d={{ ...base, reco: null }} />)).not.toContain('REKOMENDOWANY');
  });

  it('zakończenie: karta kontaktowa tylko gdy jest osoba', () => {
    const c = { name: 'Jan Kowalski', role: 'Konsultant', email: 'j@k2.pl', phone: '+48 600 000 000', photoUrl: null };
    expect(html(<ClosingSlide no="08" footer="x" d={{ contact: c, validUntil: '31.01.2026' }} />)).toContain('+48 600 000 000');
    expect(html(<ClosingSlide no="08" footer="x" d={{ contact: null, validUntil: null }} />)).not.toContain('sl-contact');
  });
});

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ t: `Pozycja ${i + 1}`, d: `Opis ${i + 1}` }));
const tabs = [
  { no: '01', label: 'Przygotowanie dokumentacji', tag: 'w cenie oferty' },
  { no: '02', label: 'Obsługa i rozliczanie projektu', tag: 'opcjonalne' },
];

describe('slajdy zakresu, procesu i FAQ', () => {
  it('zakres: numeracja ciągła w dwóch kolumnach, jeden aktywny kafelek, tag wielkimi literami', () => {
    const out = html(<ScopeSlide no="03b" footer="x" d={{ headStart: 'Obsługa i ', headEm: 'rozliczanie projektu', lead: 'Lead', tabs, active: 1, items: items(7) }} />);
    expect(out.match(/class="sl-step-no">/g)).toHaveLength(7);
    expect(out).toContain('class="sl-step-no">05</span>'); // 7 pozycji dzieli się 4 + 3
    expect(out.match(/sl-tab sl-tab--on/g)).toHaveLength(1);
    expect(out).toContain('OPCJONALNE');
    expect(out).toContain('>03b</span>');
  });

  it('proces: wszystkie kroki z opisami, linia łącząca liczona od liczby kroków', () => {
    const out = html(<ProcessSlide no="05" footer="x" steps={items(5)} />);
    expect(out.match(/KROK 0/g)).toHaveLength(5);
    for (let i = 1; i <= 5; i++) expect(out).toContain(`Opis ${i}`);
    expect(out).toContain('left:10%;right:10%');
    expect(html(<ProcessSlide no="05" footer="x" steps={items(4)} />)).toContain('left:12.5%;right:12.5%');
  });

  it('FAQ: siedem pytań dzieli się 4 + 3, nic nie ginie, HTML w odpowiedzi jest escapowany', () => {
    const faq = Array.from({ length: 7 }, (_, i) => ({ q: `Pytanie ${i + 1}?`, a: `Odpowiedź ${i + 1} <b>` }));
    const out = html(<FaqSlide no="07" footer="x" items={faq} />);
    for (let i = 1; i <= 7; i++) expect(out).toContain(`Pytanie ${i}?`);
    expect(out).toContain('&lt;b&gt;');
    expect(out).not.toContain('<b>');
    expect(out).toContain('</p></div></div><div><div><div class="sl-faq-q">Pytanie 5?'); // początek drugiej kolumny
  });
});

describe('slajdy z tekstem konsultanta i ustawieniami firmowymi', () => {
  it('01: nazwa klienta w tytule i gotowy HTML w treści', () => {
    const out = html(<IntroSlide no="01" footer="x" clientName="Przykładowa Firma Sp. z o.o." html="<p>Akapit <strong>ważny</strong></p>" />);
    expect(out).toContain('szyte na miarę <em>Przykładowa Firma Sp. z o.o.</em>');
    expect(out).toContain('<p>Akapit <strong>ważny</strong></p>');
  });

  it('04b: 11 punktów, numeracja ciągła, kolumny balansuje CSS, tekst escapowany', () => {
    const bullets = Array.from({ length: 11 }, (_, i) => `Punkt ${i + 1} <i>`);
    const out = html(<BulletsSlide no="04b" footer="x" bullets={bullets} />);
    expect(out.match(/class="sl-bullet"/g)).toHaveLength(11);
    expect(out).toContain('column-count:3');
    expect(out).toContain('<span>01</span><p>Punkt 1');
    expect(out).toContain('<span>11</span><p>Punkt 11');
    expect(out).toContain('&lt;i&gt;');
    expect(html(<BulletsSlide no="04b" footer="x" bullets={['a', 'b']} />)).toContain('column-count:2');
    expect(html(<BulletsSlide no="04b" footer="x" bullets={['a']} />)).toContain('column-count:1');
  });

  it('04c: tytuł i liczba kart zależą od tego, co oferta ma', () => {
    const exec = { kicker: 'Obsługa i rozliczanie projektu', monthly: 1000, desc: 'Opis stawki' };
    const both = html(<NotesSlide no="04c" footer="x" d={{ exec, notes: 'Uwaga 1\n\nUwaga 2' }} />);
    expect(both).toContain('Obsługa projektu i <em>uwagi</em>');
    expect(both).toContain('1 000 zł');
    expect(both).toContain('netto / miesiąc');
    expect(both).toContain('Uwaga 1\n\nUwaga 2'); // CSS pre-line zachowuje akapity
    expect(both).toContain('minmax(0, 5fr) minmax(0, 7fr)'); // uwagi dostają szerszą kartę
    const onlyExec = html(<NotesSlide no="04c" footer="x" d={{ exec, notes: '' }} />);
    expect(onlyExec).toContain('Obsługa i <em>rozliczanie projektu</em>');
    expect(onlyExec).not.toContain('UWAGI DO OFERTY');
    const onlyNotes = html(<NotesSlide no="04c" footer="x" d={{ exec: null, notes: 'Rabat 10%' }} />);
    expect(onlyNotes).toContain('Uwagi <em>do oferty</em>');
    expect(onlyNotes).not.toContain('netto / miesiąc');
  });

  it('04c: rozmiar czcionki liczony osobno dla opisu opłaty i dla uwag, z granicami 700 i 1200', () => {
    // Kolejność w HTML: najpierw karta opłaty (opis), potem karta uwag.
    const sizes = (desc: string, notes: string) =>
      [
        ...html(<NotesSlide no="04c" footer="x" d={{ exec: { kicker: 'Obsługa', monthly: 1000, desc }, notes }} />).matchAll(
          /sl-note-text--(md|sm|xs)/g,
        ),
      ].map((m) => m[1]);
    const n = (len: number) => 'x'.repeat(len);
    expect(sizes(n(300), n(300))).toEqual(['md', 'md']);
    expect(sizes(n(700), n(701))).toEqual(['md', 'sm']); // granica: powyżej 700 znaków
    expect(sizes(n(1200), n(1201))).toEqual(['sm', 'xs']); // granica: powyżej 1200 znaków
    expect(sizes(n(1300), n(10))).toEqual(['xs', 'md']); // opis i uwagi są niezależne
  });

  it('04c: opłata znika bez wybranego wariantu (jak na stronie), zamiast pokazywać 0 zł', () => {
    const base = { hidden: false, kicker: 'Obsługa', desc: 'Opis' };
    expect(resolveNotesExec({ ...base, selected: null, execMonthly: null })).toBeNull();
    expect(resolveNotesExec({ ...base, selected: null, execMonthly: 1000 })).toBeNull(); // strona też ukrywa blok
    expect(resolveNotesExec({ ...base, hidden: true, selected: { monthly: 1000 }, execMonthly: null })).toBeNull(); // Kultura
    expect(resolveNotesExec({ ...base, selected: { monthly: 1000 }, execMonthly: null })?.monthly).toBe(1000);
    expect(resolveNotesExec({ ...base, selected: { monthly: 1000 }, execMonthly: 1500 })?.monthly).toBe(1500); // override
  });

  it('06: statystyki firmowe z ustawień, "ponad" tylko przy liczbie projektów', () => {
    const out = html(<AboutSlide no="06" footer="x" stats={{ funding: '500 mln zł', projects: '254', since: 'od 2015' }} />);
    for (const t of ['500 mln zł', 'ponad 254', 'od 2015', 'Niebieska', 'Czerwona', 'Dwie energie, <em>jedna misja</em>']) {
      expect(out).toContain(t);
    }
    expect(out).not.toContain('ponad 500');
  });
});
