/**
 * Smoke tests dla email templates — sprawdzają że JSX kompiluje się i renderuje
 * do non-empty HTML + text. Pełna walidacja MIME / klientów emailowych poza
 * zakresem unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render } from '@react-email/render';
import OfferSentToClient from './templates/OfferSentToClient';
import OfferAcceptedConsultant from './templates/OfferAcceptedConsultant';
import OfferRejectedConsultant from './templates/OfferRejectedConsultant';

describe('OfferSentToClient', () => {
  it('renderuje HTML zawierający kluczowe pola', async () => {
    const html = await render(createElement(OfferSentToClient, OfferSentToClient.PreviewProps));
    expect(html).toContain('Aqustec Sp. z o.o.');
    expect(html).toContain('FENG · Ścieżka SMART');
    expect(html).toContain('2 600 000 zł');
    expect(html).toContain('Wariant I — Szybka płatność');
    expect(html).toContain('https://app.k2biznes.pl/o/example-token');
    expect(html).toContain('Tomasz Kalla');
  });

  it('renderuje plain text', async () => {
    const text = await render(
      createElement(OfferSentToClient, OfferSentToClient.PreviewProps),
      { plainText: true },
    );
    // @react-email/render uppercase'uje treść <Heading>, więc szukamy case-insensitively.
    expect(text.toLowerCase()).toContain('aqustec');
    expect(text).toContain('https://app.k2biznes.pl/o/example-token');
    // plain text nie powinien zawierać surowych tagów HTML
    expect(text).not.toContain('<html');
    expect(text).not.toContain('<div');
  });

  it('renderuje bez customMessage', async () => {
    const props = { ...OfferSentToClient.PreviewProps, customMessage: undefined };
    const html = await render(createElement(OfferSentToClient, props));
    expect(html).toContain('Aqustec');
    expect(html).not.toContain('Po naszej rozmowie');
  });
});

describe('OfferAcceptedConsultant', () => {
  it('renderuje HTML z numerem oferty + kwotą', async () => {
    const html = await render(
      createElement(OfferAcceptedConsultant, OfferAcceptedConsultant.PreviewProps),
    );
    expect(html).toContain('K2/2026/04/012');
    expect(html).toContain('143 000 zł');
    expect(html).toContain('Jan Kowalski');
    expect(html).toContain('Wszystko jasne');
  });

  it('pomija comment gdy null', async () => {
    const props = { ...OfferAcceptedConsultant.PreviewProps, comment: null };
    const html = await render(createElement(OfferAcceptedConsultant, props));
    expect(html).not.toContain('Komentarz klienta');
  });
});

describe('OfferRejectedConsultant', () => {
  it('renderuje HTML z reason', async () => {
    const html = await render(
      createElement(OfferRejectedConsultant, OfferRejectedConsultant.PreviewProps),
    );
    expect(html).toContain('K2/2026/04/012');
    expect(html).toContain('Anna Nowak');
    expect(html).toContain('Wybraliśmy inną firmę');
  });

  it('pomija reason gdy null', async () => {
    const props = { ...OfferRejectedConsultant.PreviewProps, reason: null };
    const html = await render(createElement(OfferRejectedConsultant, props));
    expect(html).not.toContain('Powód');
  });

  it('pomija email gdy null', async () => {
    const props = { ...OfferRejectedConsultant.PreviewProps, clientEmail: null };
    const html = await render(createElement(OfferRejectedConsultant, props));
    expect(html).not.toContain('anna@example.com');
  });
});
