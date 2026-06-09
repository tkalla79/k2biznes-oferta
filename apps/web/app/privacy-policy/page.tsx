/**
 * Polityka prywatności (BACKEND_SPEC.md v1.1.1, sekcja 11.2).
 *
 * Tekst zatwierdzony przez radcę prawnego (2026-05-28).
 * Struktura zgodna z RODO art. 13 + art. 14.
 */
export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <main style={main}>
      <h1 style={h1}>Polityka prywatności</h1>
      <p style={lead}>
        <strong>K2Biznes Sp. z o.o.</strong> przetwarza dane osobowe zgodnie z RODO. Poniżej
        znajdziesz informacje wymagane przez art. 13 i art. 14 RODO.
      </p>

      <Section title="1. Administrator danych">
        <p>
          Administratorem danych osobowych jest <strong>K2Biznes Sp. z o.o.</strong>, z
          siedzibą przy ul. Wrocławskiej 156a, 45-835 Opole, wpisana do rejestru
          przedsiębiorców KRS pod numerem 0001008787.
        </p>
        <p>
          Kontakt w sprawach ochrony danych:{' '}
          <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a>.
        </p>
      </Section>

      <Section title="2. Zakres przetwarzanych danych i ich źródło">
        <p>Przetwarzamy następujące kategorie danych:</p>
        <ul>
          <li>
            <strong>Dane kontaktowe osoby akceptującej ofertę</strong> (imię, nazwisko, adres
            e-mail) — pozyskiwane bezpośrednio od tej osoby, z formularza akceptacji oferty.
          </li>
          <li>
            <strong>Treść komentarza</strong> dodanego przez osobę akceptującą przy akceptacji
            oferty.
          </li>
          <li>
            <strong>Dane firmy</strong> (nazwa, NIP, branża, województwo) — wprowadzane przez
            konsultanta K2Biznes. W zakresie, w jakim dane te dotyczą osoby fizycznej (np.
            jednoosobowej działalności gospodarczej lub osoby kontaktowej), ich źródłem jest
            konsultant K2Biznes oraz publiczne rejestry przedsiębiorców.
          </li>
          <li>
            <strong>Logi techniczne</strong> (skrócony, haszowany adres IP, informacja o
            przeglądarce — user-agent) — wyłącznie dla celów bezpieczeństwa i dowodowych.
          </li>
        </ul>
      </Section>

      <Section title="3. Cel i podstawa prawna przetwarzania">
        <ul>
          <li>
            <strong>Obsługa procesu ofertowania i ewentualne zawarcie umowy</strong> o usługi
            doradcze — art. 6 ust. 1 lit. b RODO (niezbędność do podjęcia działań na żądanie
            osoby przed zawarciem umowy oraz do wykonania umowy).
          </li>
          <li>
            <strong>Wystawienie i przechowywanie dokumentów księgowych</strong> — art. 6 ust.
            1 lit. c RODO (ustawa o rachunkowości).
          </li>
          <li>
            <strong>Bezpieczeństwo systemu i cele dowodowe</strong> (logi techniczne) — art. 6
            ust. 1 lit. f RODO (prawnie uzasadniony interes administratora w zabezpieczeniu
            systemu oraz wykazaniu faktu i czasu akceptacji oferty).
          </li>
        </ul>
        <p>
          Podanie imienia, nazwiska i adresu e-mail jest warunkiem akceptacji oferty — bez tych
          danych akceptacja nie jest możliwa. Podanie komentarza jest dobrowolne.
        </p>
        <p>
          Nie podejmujemy wobec Ciebie decyzji w sposób wyłącznie zautomatyzowany, w tym nie
          stosujemy profilowania wywołującego skutki prawne.
        </p>
      </Section>

      <Section title="4. Okres przechowywania">
        <ul>
          <li>
            <strong>Oferty zaakceptowane</strong>, które doprowadziły do zawarcia umowy i
            rozliczenia — 7 lat (art. 74 ustawy o rachunkowości).
          </li>
          <li>
            <strong>Oferty niezaakceptowane lub niezrealizowane</strong> — przez okres
            niezbędny do ustania celu, nie dłużej niż do upływu okresu przedawnienia roszczeń
            związanych z procesem ofertowania (co do zasady 3 lata dla roszczeń związanych z
            prowadzeniem działalności gospodarczej).
          </li>
          <li>
            <strong>Logi systemowe</strong> — 2 lata, po czym są usuwane (skrót IP → NULL).
          </li>
          <li>
            <strong>Konta użytkowników (konsultantów)</strong> — do czasu wniesienia żądania
            usunięcia.
          </li>
        </ul>
      </Section>

      <Section title="5. Prawa osoby, której dane dotyczą">
        <p>Przysługują Ci następujące prawa:</p>
        <ul>
          <li>
            <strong>Prawo do dostępu do danych</strong> (art. 15) —{' '}
            <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a> lub eksport danych z linku
            oferty.
          </li>
          <li>
            <strong>Prawo do sprostowania danych</strong> (art. 16) — przez kontakt z
            konsultantem lub e-mail <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a>.
          </li>
          <li>
            <strong>Prawo do usunięcia danych</strong> (art. 17) — z zastrzeżeniem danych,
            które musimy przechowywać na podstawie przepisów (np. księgowych). Żądanie:{' '}
            <a href="/auth/request-data-deletion">formularz online</a> lub e-mail{' '}
            <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a>.
          </li>
          <li>
            <strong>Prawo do ograniczenia przetwarzania</strong> (art. 18).
          </li>
          <li>
            <strong>Prawo do przenoszenia danych</strong> (art. 20) — w zakresie danych
            przetwarzanych na podstawie art. 6 ust. 1 lit. b (umowa) i w sposób
            zautomatyzowany.
          </li>
          <li>
            <strong>Prawo do sprzeciwu</strong> (art. 21) — wobec przetwarzania opartego na
            prawnie uzasadnionym interesie (art. 6 ust. 1 lit. f), tj. wobec przetwarzania
            logów technicznych.
          </li>
          <li>
            <strong>Prawo do wniesienia skargi</strong> do organu nadzorczego — Prezesa Urzędu
            Ochrony Danych Osobowych (
            <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer">
              uodo.gov.pl
            </a>
            ).
          </li>
        </ul>
      </Section>

      <Section title="6. Pliki cookie i analityka">
        <p>Używamy następujących kategorii plików cookie i narzędzi:</p>
        <ul>
          <li>
            <strong>Niezbędne</strong> — sesja Supabase Auth (token JWT). Bez nich aplikacja
            nie działa; nie wymagają zgody.
          </li>
          <li>
            <strong>Analityka</strong> — Plausible Analytics działa bez plików cookie i bez
            zbierania danych osobowych ani identyfikatorów użytkownika; gromadzi wyłącznie
            zagregowane statystyki, dlatego nie wymaga Twojej zgody.
          </li>
        </ul>
      </Section>

      <Section title="7. Odbiorcy danych i transfer poza EOG">
        <p>
          Twoje dane mogą być przekazywane następującym dostawcom IT działającym jako podmioty
          przetwarzające na podstawie umów powierzenia (art. 28 RODO):
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — hosting bazy danych.
          </li>
          <li>
            <strong>Vercel</strong> — hosting aplikacji web.
          </li>
          <li>
            <strong>Resend</strong> — wysyłka wiadomości e-mail.
          </li>
          <li>
            <strong>Sentry</strong> — monitoring błędów (z usuwaniem danych osobowych z
            logów).
          </li>
          <li>
            <strong>Pipedrive</strong> — system CRM (przekazanie danych po akceptacji oferty).
          </li>
        </ul>
        <p>
          <strong>Transfer poza Europejski Obszar Gospodarczy.</strong> Część z powyższych
          dostawców może przetwarzać dane poza EOG, w tym w Stanach Zjednoczonych (m.in.
          Resend). W każdym takim przypadku transfer odbywa się na podstawie decyzji
          adekwatności EU-US Data Privacy Framework lub standardowych klauzul umownych (SCC)
          zgodnych z decyzją Komisji Europejskiej 2021/914, zawartych w umowach powierzenia z
          dostawcami. Kopię zastosowanych zabezpieczeń można uzyskać pod adresem{' '}
          <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a>.
        </p>
      </Section>

      <Section title="8. Kontakt">
        <p>
          W sprawach ochrony danych:{' '}
          <a href="mailto:biuro@k2biznes.pl">biuro@k2biznes.pl</a>.
        </p>
      </Section>

      <p style={footer}>
        K2Biznes Sp. z o.o. · ul. Wrocławska 156a, 45-835 Opole · KRS 0001008787
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
