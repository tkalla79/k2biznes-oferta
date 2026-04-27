/**
 * Email po wykonaniu anonimizacji (BACKEND_SPEC.md v1.1.1, sekcja 11.4).
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type DataDeletionExecutedProps = {
  email: string;
  requestId: string;
  offersAnonymized: number;
  eventsAnonymized: number;
  profileAnonymized: boolean;
  executedAt: string;
};

export default function DataDeletionExecuted(p: DataDeletionExecutedProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>Twoje dane zostały usunięte z systemu K2Biznes.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>K2BIZNES</Text>

          <Heading as="h1" style={h1}>
            Dane zostały usunięte
          </Heading>

          <Text style={paragraph}>
            Wykonaliśmy anonimizację Twoich danych osobowych zgodnie z art. 17 RODO (prawo do
            usunięcia).
          </Text>

          <Section style={card}>
            <Text style={row}>
              <span style={label}>Zanonimizowane oferty:</span>
              <span style={value}>{p.offersAnonymized}</span>
            </Text>
            <Text style={row}>
              <span style={label}>Zanonimizowane zdarzenia:</span>
              <span style={value}>{p.eventsAnonymized}</span>
            </Text>
            <Text style={row}>
              <span style={label}>Profil użytkownika:</span>
              <span style={value}>{p.profileAnonymized ? 'usunięty' : 'nie dotyczy'}</span>
            </Text>
            <Text style={row}>
              <span style={label}>Data wykonania:</span>
              <span style={value}>{p.executedAt}</span>
            </Text>
          </Section>

          <Text style={paragraph}>
            Co zostaje (zgodnie z prawnym obowiązkiem retention):
          </Text>
          <Text style={paragraphSmall}>
            • Numery ofert i ich wartości — przez 7 lat dla księgowości (art. 74 ustawy o rachunkowości).<br />
            • Logi systemowe (bez danych osobowych) — przez 2 lata dla audytu bezpieczeństwa.
          </Text>

          <Text style={paragraph}>
            Email referencyjny: <span style={mono}>{p.email}</span><br />
            ID żądania: <span style={mono}>{p.requestId}</span>
          </Text>

          <Text style={footnote}>
            K2Biznes Sp. z o.o. · Inspektor Ochrony Danych: rodo@k2biznes.pl
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

DataDeletionExecuted.PreviewProps = {
  email: 'klient@example.com',
  requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  offersAnonymized: 3,
  eventsAnonymized: 12,
  profileAnonymized: false,
  executedAt: '2026-04-27 14:30',
} as const satisfies DataDeletionExecutedProps;

const body = { backgroundColor: '#fbfaf7', fontFamily: '-apple-system, "Segoe UI", sans-serif' };
const container = { maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' };
const brand = { letterSpacing: 2, fontSize: 12, color: '#c92b3a', fontWeight: 600 as const, margin: 0 };
const h1 = { fontFamily: 'Georgia, serif', fontSize: 24, color: '#1B2A4A', margin: '16px 0 16px' };
const paragraph = { fontSize: 15, lineHeight: 1.6, color: '#1B2A4A', margin: '0 0 12px' };
const paragraphSmall = { fontSize: 13, lineHeight: 1.6, color: '#6b7a92', margin: '0 0 12px' };
const card = { background: '#dff3e8', padding: 16, borderRadius: 6, margin: '12px 0', border: '1px solid #1f7a4c' };
const row = { fontSize: 14, margin: '4px 0' };
const label = { color: '#1f7a4c', display: 'inline-block', minWidth: 200 };
const value = { color: '#1B2A4A', fontWeight: 600 as const };
const mono = { fontFamily: 'monospace', fontSize: 12, color: '#6b7a92' };
const footnote = { fontSize: 12, color: '#6b7a92', margin: '20px 0 0' };
