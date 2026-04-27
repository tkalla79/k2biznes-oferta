/**
 * Email system → konsultant po akceptacji oferty (BACKEND_SPEC.md v1.1.1, sekcja 8.2).
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

export type OfferAcceptedConsultantProps = {
  offerNumber: string;
  clientCompanyName: string;
  programLabel: string;
  acceptedVariant: string;
  acceptedFee: string;
  clientName: string;
  clientEmail: string;
  comment: string | null;
  acceptedAt: string;
  adminUrl: string;
};

export default function OfferAcceptedConsultant(p: OfferAcceptedConsultantProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>
        ✅ {p.offerNumber} zaakceptowana — {p.clientCompanyName}, wariant {p.acceptedVariant}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Text style={badge}>OFERTA ZAAKCEPTOWANA</Text>
          </Section>

          <Heading as="h1" style={h1}>
            {p.offerNumber}
          </Heading>

          <Section style={card}>
            <Row label="Klient" value={p.clientCompanyName} />
            <Row label="Program" value={p.programLabel} />
            <Row label="Wybrany wariant" value={p.acceptedVariant} />
            <Row label="Success fee" value={p.acceptedFee} bold />
            <Row label="Akceptujący" value={`${p.clientName} <${p.clientEmail}>`} />
            <Row label="Data akceptacji" value={p.acceptedAt} />
          </Section>

          {p.comment && (
            <Section style={commentBox}>
              <Text style={commentLabel}>Komentarz klienta:</Text>
              <Text style={commentText}>{p.comment}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={paragraph}>
            <a href={p.adminUrl} style={link}>
              Otwórz ofertę w panelu admina →
            </a>
          </Text>

          <Text style={footnote}>
            Następne kroki: skontaktuj się z klientem, wyślij umowę, wprowadź deal w CRM.
            Webhook do CRM zostanie wywołany automatycznie (sekcja 10).
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

OfferAcceptedConsultant.PreviewProps = {
  offerNumber: 'K2/2026/04/012',
  clientCompanyName: 'Aqustec Sp. z o.o.',
  programLabel: 'FENG · Ścieżka SMART',
  acceptedVariant: 'II',
  acceptedFee: '143 000 zł',
  clientName: 'Jan Kowalski',
  clientEmail: 'j.kowalski@example.com',
  comment: 'Wszystko jasne, gotowi jesteśmy na podpisanie umowy.',
  acceptedAt: '2026-04-25 14:22',
  adminUrl: 'https://app.k2biznes.pl/admin/offers/abc-123',
} as const satisfies OfferAcceptedConsultantProps;

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <Text style={{ margin: '4px 0', fontSize: 14 }}>
      <span style={{ color: '#6b7a92', display: 'inline-block', minWidth: 140 }}>{label}:</span>
      <span style={{ color: '#1B2A4A', fontWeight: bold ? 600 : 400 }}>{value}</span>
    </Text>
  );
}

const body = { backgroundColor: '#fbfaf7', fontFamily: '-apple-system, "Segoe UI", sans-serif' };
const container = { maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' };
const badge = {
  backgroundColor: '#dff3e8',
  color: '#1f7a4c',
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
const commentBox = { borderLeft: '3px solid #c92b3a', padding: '0 0 0 12px', margin: '8px 0 16px' };
const commentLabel = { fontSize: 12, color: '#6b7a92', margin: '0 0 4px', textTransform: 'uppercase' as const };
const commentText = { fontSize: 14, color: '#1B2A4A', lineHeight: 1.5, margin: 0, fontStyle: 'italic' as const };
const hr = { borderColor: '#e4e9f2', margin: '16px 0' };
const paragraph = { fontSize: 15, color: '#1B2A4A', margin: '0 0 8px' };
const link = { color: '#c92b3a', textDecoration: 'none', fontWeight: 600 as const };
const footnote = { fontSize: 13, color: '#6b7a92', lineHeight: 1.5, margin: 0 };
