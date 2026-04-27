/**
 * Polityka prywatności (BACKEND_SPEC.md v1.1.1, sekcja 11.2).
 *
 * Treść jest placeholder'em — biznes (TODO Tomasz) musi dostarczyć finalny
 * tekst zatwierdzony przez prawnika. Struktura zgodna z RODO art. 13.
 */
export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <main style={main}>
      <h1 style={h1}>Polityka prywatności</h1>
      <p style={lead}>
        <strong>K2Biznes Sp. z o.o.</strong> przetwarza dane osobowe zgodnie z RODO. Poniżej
        znajdziesz informacje wymagane przez art. 13.
      </p>

      <p style={todoBanner}>
        ⚠ <strong>TODO biznes:</strong> finalny tekst zatwierdzony przez prawnika. Poniżej
        szkielet zgodny ze spec&apos;em (sekcja 11) — wymaga uzupełnienia.
      </p>

      <Section title="1. Administrator danych">
        <p>
          Administratorem danych osobowych jest <strong>K2Biznes Sp. z o.o.</strong>, z
          siedzibą w [adres do uzupełnienia], wpisana do KRS pod numerem [...].
        </p>
        <p>
          Inspektor Ochrony Danych: <a href="mailto:rodo@k2biznes.pl">rodo@k2biznes.pl</a>.
        </p>
      </Section>

      <Section title="2. Zakres przetwarzanych danych">
        <ul>
          <li>Dane kontaktowe klienta (imię, nazwisko, email) — z formularza akceptacji oferty.</li>
          <li>Dane firmy klienta (nazwa, NIP, branża, województwo) — wprowadzane przez konsultanta.</li>
          <li>Logi techniczne (skrót adresu IP, user-agent) — tylko dla celów audytu i bezpieczeństwa.</li>
          <li>Treść komentarzy klienta przy akceptacji oferty.</li>
        </ul>
      </Section>

      <Section title="3. Cel i podstawa prawna przetwarzania">
        <ul>
          <li>Realizacja procesu ofertowania i zawarcia umowy — art. 6 ust. 1 lit. b RODO.</li>
          <li>Wystawienie i przechowywanie dokumentów księgowych — art. 6 ust. 1 lit. c RODO (ustawa o rachunkowości).</li>
          <li>Audyt bezpieczeństwa systemu — art. 6 ust. 1 lit. f RODO (uzasadniony interes).</li>
        </ul>
      </Section>

      <Section title="4. Okres przechowywania">
        <ul>
          <li><strong>Oferty</strong> — 7 lat (zgodnie z art. 74 ustawy o rachunkowości).</li>
          <li><strong>Logi systemowe</strong> — 2 lata, potem anonimizacja (skrót IP → NULL).</li>
          <li><strong>Konta użytkowników (konsultantów)</strong> — do czasu wniesienia żądania usunięcia.</li>
        </ul>
      </Section>

      <Section title="5. Prawa osoby, której dane dotyczą">
        <ul>
          <li>
            Prawo do dostępu (art. 15) —{' '}
            <a href="mailto:rodo@k2biznes.pl?subject=Żądanie dostępu do danych">
              rodo@k2biznes.pl
            </a>{' '}
            lub eksport JSON z linku oferty.
          </li>
          <li>
            Prawo do sprostowania (art. 16) — przez kontakt z konsultantem lub email RODO.
          </li>
          <li>
            Prawo do usunięcia (art. 17) — żądanie przez{' '}
            <a href="/auth/request-data-deletion">formularz online</a> lub email RODO.
          </li>
          <li>Prawo do ograniczenia przetwarzania (art. 18).</li>
          <li>Prawo do przenoszenia danych (art. 20).</li>
          <li>Prawo do sprzeciwu wobec przetwarzania (art. 21).</li>
          <li>
            Prawo do wniesienia skargi do organu nadzorczego (PUODO,{' '}
            <a href="https://uodo.gov.pl">uodo.gov.pl</a>).
          </li>
        </ul>
      </Section>

      <Section title="6. Pliki cookie i analityka">
        <p>
          Używamy następujących kategorii cookies:
        </p>
        <ul>
          <li>
            <strong>Niezbędne</strong> — sesja Supabase Auth (token JWT). Bez nich aplikacja
            nie działa.
          </li>
          <li>
            <strong>Analityczne (opt-in)</strong> — Plausible Analytics jest cookieless;
            zbiera zagregowaną statystykę bez identyfikatorów użytkownika.
          </li>
        </ul>
      </Section>

      <Section title="7. Odbiorcy danych">
        <ul>
          <li>Supabase (hosting bazy danych, eksport poza EOG nie ma miejsca — region EU).</li>
          <li>Vercel (hosting aplikacji web).</li>
          <li>Resend (wysyłka emaili — region EU).</li>
          <li>Sentry (monitoring błędów — z PII scrubbing&apos;iem).</li>
          <li>HubSpot/Pipedrive (CRM — webhook po akceptacji oferty).</li>
        </ul>
      </Section>

      <Section title="8. Kontakt">
        <p>
          W sprawach RODO:{' '}
          <a href="mailto:rodo@k2biznes.pl">rodo@k2biznes.pl</a>.
        </p>
      </Section>

      <p style={footer}>
        Wersja klauzuli: <strong>v1-2026-04</strong> · Data ostatniej aktualizacji: 2026-04-25
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={section}>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

const main: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '48px 24px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  color: '#1B2A4A',
  lineHeight: 1.6,
};
const h1: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: 36, marginBottom: 8 };
const h2: React.CSSProperties = { fontSize: 18, marginTop: 0, marginBottom: 8 };
const lead: React.CSSProperties = { fontSize: 16, marginBottom: 24, color: '#2a3a5c' };
const todoBanner: React.CSSProperties = {
  background: '#fbf0d8',
  border: '1px solid #8a5a00',
  borderRadius: 6,
  padding: 12,
  fontSize: 13,
  color: '#8a5a00',
  margin: '0 0 24px',
};
const section: React.CSSProperties = {
  margin: '24px 0',
  padding: '16px 0',
  borderTop: '1px solid #eef1f7',
};
const footer: React.CSSProperties = {
  marginTop: 40,
  fontSize: 13,
  color: '#6b7a92',
  textAlign: 'center',
};
