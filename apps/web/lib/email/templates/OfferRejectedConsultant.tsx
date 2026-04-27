/**
 * Email system → konsultant po odrzuceniu oferty (BACKEND_SPEC.md v1.1.1, sekcja 8.3).
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type OfferRejectedConsultantProps = {
  offerNumber: string;
  clientCompanyName: string;
  programLabel: string;
  clientName: string;
  clientEmail: string | null;
  reason: string | null;
  rejectedAt: string;
  adminUrl: string;
};

export default function OfferRejectedConsultant(p: OfferRejectedConsultantProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>
        Oferta {p.offerNumber} odrzucona — {p.clientCompanyName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Text style={badge}>OFERTA ODRZUCONA</Text>
          </Section>

          <Heading as="h1" style={h1}>
            {p.offerNumber}
          </Heading>

          <Section style={card}>
            <Row label="Klient" value={p.clientCompanyName} />
            <Row label="Program" value={p.programLabel} />
            <Row label="Odrzucający" value={p.clientName} />
            {p.clientEmail && <Row label="Email" value={p.clientEmail} />}
            <Row label="Data odrzucenia" value={p.rejectedAt} />
          </Section>

          {p.reason && (
            <Section style={reasonBox}>
              <Text style={reasonLabel}>Powód:</Text>
              <Text style={reasonText}>{p.reason}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={paragraph}>
            <a href={p.adminUrl} style={link}>
              Otwórz ofertę w panelu admina →
            </a>
          </Text>

          <Text style={footnote}>
            Warto wpisać feedback do CRM. Jeśli klient odrzucił z powodu konkurencji, ceny lub
            timingu — to dane do dashboard&apos;u konwersji (sekcja 5.2 stats/overview).
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

OfferRejectedConsultant.PreviewProps = {
  offerNumber: 'K2/2026/04/012',
  clientCompanyName: 'Aqustec Sp. z o.o.',
  programLabel: 'FENG · Ścieżka SMART',
  clientName: 'Anna Nowak',
  clientEmail: 'anna@example.com',
  reason: 'Wybraliśmy inną firmę z niższą ofertą.',
  rejectedAt: '2026-04-25 16:10',
  adminUrl: 'https://app.k2biznes.pl/admin/offers/abc-123',
} as const satisfies OfferRejectedConsultantProps;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ margin: '4px 0', fontSize: 14 }}>
      <span style={{ color: '#6b7a92', display: 'inline-block', minWidth: 140 }}>{label}:</span>
      <span style={{ color: '#1B2A4A' }}>{value}</span>
    </Text>
  );
}

const body = { backgroundColor: '#fbfaf7', fontFamily: '-apple-system, "Segoe UI", sans-serif' };
const container = { maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' };
const badge = {
  backgroundColor: '#fbf0d8',
  color: '#8a5a00',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600 as const,
  letterSpacing: 1,
  display: 'inline-block',
  margin: 0,
};
const h1 = { fontFamily: 'Georgia, serif', fontSize: 24, color: '#1B2A4A', margin: '16px 0 16px' };
const card = { background: '#f5f3ee', padding: 16, borderRadius: 6, margin: '0 0 16px' };
const reasonBox = { borderLeft: '3px solid #8a5a00', padding: '0 0 0 12px', margin: '8px 0 16px' };
const reasonLabel = { fontSize: 12, color: '#6b7a92', margin: '0 0 4px', textTransform: 'uppercase' as const };
const reasonText = { fontSize: 14, color: '#1B2A4A', lineHeight: 1.5, margin: 0, fontStyle: 'italic' as const };
const hr = { borderColor: '#e4e9f2', margin: '16px 0' };
const paragraph = { fontSize: 15, color: '#1B2A4A', margin: '0 0 8px' };
const link = { color: '#c92b3a', textDecoration: 'none', fontWeight: 600 as const };
const footnote = { fontSize: 13, color: '#6b7a92', lineHeight: 1.5, margin: 0 };
