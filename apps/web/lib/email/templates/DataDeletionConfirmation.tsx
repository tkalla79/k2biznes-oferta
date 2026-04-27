/**
 * Email do osoby zgłaszającej żądanie usunięcia (BACKEND_SPEC.md v1.1.1, sekcja 8.5 + 11.4).
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

export type DataDeletionConfirmationProps = {
  email: string;
  requestId: string;
  reason: string | null;
};

export default function DataDeletionConfirmation(p: DataDeletionConfirmationProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>Potwierdzenie zgłoszenia żądania usunięcia danych — K2Biznes</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>K2BIZNES</Text>

          <Heading as="h1" style={h1}>
            Otrzymaliśmy Twoje żądanie
          </Heading>

          <Text style={paragraph}>
            Dziękujemy za zgłoszenie żądania usunięcia danych osobowych z platformy K2Biznes
            Oferta.
          </Text>

          <Section style={card}>
            <Text style={row}>
              <span style={label}>ID żądania:</span>
              <span style={mono}>{p.requestId}</span>
            </Text>
            <Text style={row}>
              <span style={label}>Email:</span>
              <span>{p.email}</span>
            </Text>
            {p.reason && (
              <Text style={row}>
                <span style={label}>Powód:</span>
                <span>{p.reason}</span>
              </Text>
            )}
          </Section>

          <Text style={paragraph}>
            Twoje żądanie zostało zarejestrowane i będzie rozpatrzone w terminie do 30 dni
            zgodnie z art. 12 RODO. Po zatwierdzeniu otrzymasz osobne powiadomienie z
            informacją o wykonaniu.
          </Text>

          <Text style={paragraph}>
            Jeśli to żądanie nie pochodzi od Ciebie — odpowiedz na ten email lub skontaktuj
            się z nami pod adresem <a href="mailto:rodo@k2biznes.pl" style={link}>rodo@k2biznes.pl</a>.
          </Text>

          <Hr style={hr} />

          <Text style={footnote}>
            K2Biznes Sp. z o.o. · Inspektor Ochrony Danych: rodo@k2biznes.pl
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

DataDeletionConfirmation.PreviewProps = {
  email: 'klient@example.com',
  requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  reason: 'Nie chcę dłużej być w bazie potencjalnych klientów.',
} as const satisfies DataDeletionConfirmationProps;

const body = { backgroundColor: '#fbfaf7', fontFamily: '-apple-system, "Segoe UI", sans-serif' };
const container = { maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' };
const brand = { letterSpacing: 2, fontSize: 12, color: '#c92b3a', fontWeight: 600 as const, margin: 0 };
const h1 = { fontFamily: 'Georgia, serif', fontSize: 24, color: '#1B2A4A', margin: '16px 0 16px' };
const paragraph = { fontSize: 15, lineHeight: 1.6, color: '#1B2A4A', margin: '0 0 12px' };
const card = { background: '#f5f3ee', padding: 16, borderRadius: 6, margin: '12px 0' };
const row = { fontSize: 14, margin: '4px 0' };
const label = { color: '#6b7a92', display: 'inline-block', minWidth: 100 };
const mono = { fontFamily: 'monospace', fontSize: 12, color: '#1B2A4A' };
const link = { color: '#c92b3a', textDecoration: 'none' };
const hr = { borderColor: '#e4e9f2', margin: '20px 0' };
const footnote = { fontSize: 12, color: '#6b7a92', margin: 0 };
