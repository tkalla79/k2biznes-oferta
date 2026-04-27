/**
 * Email konsultant → klient z linkiem do oferty (BACKEND_SPEC.md v1.1.1, sekcja 8.1).
 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type OfferSentToClientProps = {
  clientName: string;
  programLabel: string;
  fundingAmount: string;
  variantName: string;
  variantTotal: string;
  consultantName: string;
  consultantEmail: string;
  consultantPhone: string | null;
  offerUrl: string;
  customMessage?: string;
};

export default function OfferSentToClient(p: OfferSentToClientProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>
        Oferta K2Biznes dla {p.clientName} — {p.programLabel}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Text style={brand}>K2BIZNES</Text>
          </Section>

          <Heading as="h1" style={h1}>
            Oferta dla {p.clientName}
          </Heading>

          <Text style={paragraph}>
            Dzień dobry,
          </Text>
          <Text style={paragraph}>
            przesyłam ofertę na pozyskanie dofinansowania w programie{' '}
            <strong>{p.programLabel}</strong>.
          </Text>

          {p.customMessage && (
            <Text style={paragraph}>{p.customMessage}</Text>
          )}

          <Section style={summary}>
            <Text style={summaryRow}>
              <span style={label}>Kwota dofinansowania:</span>
              <span style={value}>{p.fundingAmount}</span>
            </Text>
            <Text style={summaryRow}>
              <span style={label}>Rekomendowany wariant:</span>
              <span style={value}>{p.variantName}</span>
            </Text>
            <Text style={summaryRow}>
              <span style={label}>Łączne wynagrodzenie:</span>
              <span style={value}>{p.variantTotal}</span>
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button href={p.offerUrl} style={cta}>
              Zobacz pełną ofertę
            </Button>
          </Section>

          <Text style={paragraph}>
            W ofercie znajdą Państwo szczegółowy opis programu, trzy warianty
            wynagrodzenia oraz nasze referencje. Można ją przeglądać w wygodnej
            chwili — link jest aktywny przez 30 dni.
          </Text>

          <Hr style={hr} />

          <Section>
            <Text style={signatureName}>{p.consultantName}</Text>
            <Text style={signatureRole}>K2Biznes Sp. z o.o.</Text>
            <Text style={signatureContact}>{p.consultantEmail}</Text>
            {p.consultantPhone && (
              <Text style={signatureContact}>{p.consultantPhone}</Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

OfferSentToClient.PreviewProps = {
  clientName: 'Aqustec Sp. z o.o.',
  programLabel: 'FENG · Ścieżka SMART',
  fundingAmount: '2 600 000 zł',
  variantName: 'Wariant I — Szybka płatność',
  variantTotal: '132 000 zł',
  consultantName: 'Tomasz Kalla',
  consultantEmail: 'tomasz.kalla@k2biznes.pl',
  consultantPhone: '+48 600 000 000',
  offerUrl: 'https://app.k2biznes.pl/o/example-token',
  customMessage: 'Po naszej rozmowie przygotowałem ofertę.',
} as const satisfies OfferSentToClientProps;

// Styles (inline — email klienci nie wspierają stylesheet).
const body = { backgroundColor: '#fbfaf7', fontFamily: '-apple-system, "Segoe UI", sans-serif' };
const container = { maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' };
const brand = { letterSpacing: 2, fontSize: 12, color: '#c92b3a', fontWeight: 600 as const, margin: 0 };
const h1 = { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 500, color: '#1B2A4A', margin: '16px 0 12px' };
const paragraph = { fontSize: 15, lineHeight: 1.6, color: '#1B2A4A', margin: '0 0 12px' };
const summary = { background: '#f5f3ee', padding: 16, borderRadius: 6, margin: '20px 0' };
const summaryRow = { fontSize: 14, margin: '4px 0' };
const label = { color: '#6b7a92', display: 'inline-block', minWidth: 200 };
const value = { color: '#1B2A4A', fontWeight: 600 as const };
const ctaSection = { textAlign: 'center' as const, margin: '24px 0' };
const cta = {
  backgroundColor: '#c92b3a',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: 15,
  fontWeight: 600 as const,
};
const hr = { borderColor: '#e4e9f2', margin: '24px 0' };
const signatureName = { fontSize: 14, fontWeight: 600 as const, margin: '0 0 2px' };
const signatureRole = { fontSize: 13, color: '#6b7a92', margin: '0 0 8px' };
const signatureContact = { fontSize: 13, color: '#6b7a92', margin: 0 };
