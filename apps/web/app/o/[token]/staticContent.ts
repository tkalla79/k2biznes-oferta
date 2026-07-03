/**
 * Statyczna treść doradcza (z designu Claude Design — Oferta K2Biznes.html).
 *
 * To są treści które obecnie są HARDCODED w designie. W przyszłości można
 * przenieść do `offer.content` jsonb żeby per-oferta konfigurować, ale na
 * MVP zostają stałe dla całej firmy K2Biznes.
 */

// Uwaga 2026-07: domyślne punkty były zaszłością z oferty pisanej pod
// konkretnego klienta ("Kredyt Ekologiczny", "Audytor Energetyczny") i
// wyciekały do ofert z pustą listą potrzeb. Teraz uniwersalne; konsultant
// nadpisuje je per-oferta w formularzu (pole "Potrzeby klienta").
export const NEEDS = [
  {
    k: 'Dobór optymalnego programu wsparcia',
    v: 'Wskazujemy działanie najlepiej dopasowane do charakteru inwestycji, kryteriów naboru oraz strategicznych celów firmy.',
  },
  {
    k: 'Weryfikacja zakresu inwestycji',
    v: 'Zakres inwestycyjny zostanie zweryfikowany i doprecyzowany na etapie realizacji usługi doradczej, tak aby zmaksymalizować szanse projektu.',
  },
  {
    k: 'Kompleksowa dokumentacja',
    v: 'Wsparcie na etapie opracowywania dokumentacji aplikacyjnej i obsługa procesu składania oraz oceny wniosku.',
  },
  {
    k: 'Komunikacja z instytucją',
    v: 'Kontakt z instytucją dokonującą oceny projektu oraz wsparcie na etapie przygotowywania załączników do umowy o dofinansowanie.',
  },
];

export const PROGRAM_BULLETS = [
  'Wysoka intensywność pomocy dla inwestycji ekologicznych',
  'Możliwość refundacji do 80% kosztów kwalifikowanych',
  'Komplementarność z audytem energetycznym klienta',
  'Ścieżka zaakceptowana przez BGK – sprawdzony proces',
];

export const ALT_PROGRAMS = [
  {
    name: 'Ścieżka SMART',
    program: 'FENG 2021–2027',
    nabor: 'IV kw. 2026',
    desc: 'Kompleksowy rozwój firm poprzez projekty B+R, wdrożenie innowacji, infrastrukturę, kompetencje i internacjonalizację.',
    url: 'https://www.k2biznes.pl/sciezka-smart/',
  },
  {
    name: 'FENG Działanie 2.32',
    program: 'Cyfryzacja MŚP',
    nabor: 'I kw. 2026',
    desc: 'Wsparcie transformacji cyfrowej: oprogramowanie, sprzęt IT, cyberbezpieczeństwo, szkolenia dla pracowników.',
    url: 'https://www.k2biznes.pl/cyfryzacja-msp/',
  },
  {
    name: 'Fundusze regionalne',
    program: 'FE dla Opolskiego',
    nabor: 'nabór ciągły',
    desc: 'Dotacje na inwestycje produkcyjne i OZE dla firm z województwa opolskiego. Wyższa intensywność pomocy.',
    url: 'https://www.k2biznes.pl/fundusze-regionalne/',
  },
  {
    name: 'NCBR BRIdge Alfa',
    program: 'Finansowanie B+R',
    nabor: 'konkursy kwartalne',
    desc: 'Finansowanie prac badawczo-rozwojowych dla projektów na wczesnym etapie rozwoju technologicznego.',
    url: 'https://www.k2biznes.pl/ncbr-bridge-alfa/',
  },
];

export const SCOPE_PREP = [
  {
    t: 'Analiza potrzeb i potencjału pomysłu',
    d: 'Weryfikujemy, czy projekt ma potencjał biznesowy, innowacyjny i ekologiczny. Oceniamy kondycję finansową i doradzamy, jak przygotować firmę do procesu aplikacyjnego.',
  },
  {
    t: 'Dobór struktury i budżetu projektu',
    d: 'Analizujemy pomysł pod kątem kryteriów formalnych i merytorycznych, pomagając dobrać strukturę, zakres i wydatki tak, by zmaksymalizować wysokość dotacji i szanse na pozytywną ocenę.',
  },
  {
    t: 'Opracowanie dokumentacji aplikacyjnej',
    d: 'Koordynujemy i opracowujemy pełną dokumentację projektu – wniosek, załączniki, harmonogramy i oświadczenia – zapewniając, że całość jest spójna, zgodna z wytycznymi i gotowa do złożenia.',
  },
  {
    t: 'Monitoring oceny wniosku',
    d: 'Monitorujemy przebieg oceny, wprowadzamy niezbędne korekty. Gdy procedura tego wymaga – przygotowujemy klienta do spotkania panelowego z ekspertami.',
  },
  {
    t: 'Udział w panelu ekspertów',
    d: 'Nasi doradcy uczestniczą w panelu, odpowiadając na pytania dotyczące aspektów formalnych i administracyjnych projektu.',
  },
  {
    t: 'Przygotowanie do podpisania umowy',
    d: 'Po pozytywnej ocenie projektu pomagamy opracować wszystkie załączniki niezbędne do zawarcia umowy o dofinansowanie.',
  },
  {
    t: 'Wsparcie po negatywnej ocenie',
    d: 'W przypadku odrzucenia wniosku przeprowadzamy analizę i – jeśli istnieją realne szanse – przygotowujemy skuteczny protest zgodnie z zasadami procedury odwoławczej.',
  },
];

export const SCOPE_EXEC = [
  {
    t: 'Spotkanie wprowadzające do realizacji projektu',
    d: 'Przedstawienie zasad informacji i promocji, analiza zapisów umowy, omówienie harmonogramu zadań zaplanowanych w projekcie.',
  },
  {
    t: 'Monitoring harmonogramu rzeczowo-finansowego',
    d: 'Bieżący nadzór nad postępem realizacji projektu i zgodnością z założeniami umowy.',
  },
  {
    t: 'Dokumenty dot. zmian w harmonogramie',
    d: 'Przygotowywanie wniosków i aneksów związanych ze zmianami harmonogramu rzeczowo-finansowego.',
  },
  {
    t: 'Nadzór nad wyborem wykonawców i dostawców',
    d: 'Przygotowanie dokumentacji zamówień w ramach projektu, zgodnie z zasadą konkurencyjności.',
  },
  {
    t: 'Wnioski o płatność',
    d: 'Przygotowywanie wniosków o płatność zaliczkową, refundacyjną, sprawozdawczą i końcową.',
  },
  {
    t: 'Konsultacje i doradztwo bieżące',
    d: 'Stałe wsparcie związane z prawidłową realizacją projektu zgodnie z zapisami umowy o dofinansowanie.',
  },
  {
    t: 'Audyt dokumentacji i obsługa kontroli',
    d: 'Audyt dokumentacji w przypadku kontroli, czynny udział Managera Projektu podczas kontroli na miejscu.',
  },
  {
    t: 'Kontakt z instytucją i obsługa systemu',
    d: 'Bieżący kontakt z Instytucją Pośredniczącą/Zarządzającą i obsługa systemu teleinformatycznego.',
  },
];

export const PROCESS = [
  { t: 'Spotkanie z klientem', d: 'Omawiamy możliwości aplikowania, zakres współpracy i szanse projektu.' },
  { t: 'Wysłanie oferty', d: 'Do 2 dni roboczych po spotkaniu klient otrzymuje spersonalizowaną ofertę.' },
  { t: 'Omówienie oferty', d: 'Po 5 dniach roboczych kontaktujemy się w celu omówienia oferty i udzielenia wyjaśnień.' },
  { t: 'Akceptacja oferty', d: 'Klient potwierdza gotowość do podpisania umowy i zakres współpracy.' },
  {
    t: 'Podpisana umowa. Start prac',
    d: 'Po obustronnym podpisaniu umowy przystępujemy do przygotowania dokumentacji aplikacyjnej.',
  },
];

export const AFTER_PHASES = [
  { month: 'M1', t: 'Start współpracy', d: 'Kick-off, wymiana danych, powołanie zespołu projektowego.' },
  { month: 'M1–M2', t: 'Analiza i dobór zakresu', d: 'Finalizacja założeń, analiza kryteriów, konsultacje z audytorem energetycznym.' },
  { month: 'M2–M3', t: 'Opracowanie dokumentacji', d: 'Wniosek aplikacyjny, załączniki, harmonogramy, oświadczenia.' },
  { month: 'M3', t: 'Złożenie wniosku', d: 'Rejestracja w systemie instytucji oceniającej, kontrola formalna.' },
  { month: 'M3–M6', t: 'Ocena wniosku', d: 'Monitoring oceny, udział w panelu ekspertów (jeśli wymagany).' },
  { month: 'M6–M7', t: 'Umowa o dofinansowanie', d: 'Przygotowanie załączników, podpisanie umowy z BGK/instytucją.' },
  { month: 'M7–M30', t: 'Realizacja projektu', d: 'Opcjonalna obsługa rozliczeniowa: wnioski o płatność, kontrole, sprawozdania.' },
];

export const CLIENT_LOGOS = [
  'ZUGIL', 'AKPOL', 'STALMEX', 'POLCOPPER', 'EKOTECH',
  'INNOVA', 'TERMOPLAST', 'MAŁOPOLSKA S.A.', 'AGRO-MAX', 'EUROPLAST', 'HYDRO-TECH', 'STAL-MONT',
];

export const FAQ_ITEMS = [
  {
    q: 'Co jeśli nasz wniosek nie otrzyma dofinansowania?',
    a: 'Success fee naliczane jest wyłącznie po pozytywnej ocenie. Opłata wstępna pokrywa koszty przygotowania dokumentacji. W przypadku odrzucenia wniosku — jeśli istnieją szanse — przygotujemy protest zgodnie z procedurą odwoławczą.',
  },
  {
    q: 'Czy mogę sam złożyć wniosek, a Wy tylko go zweryfikujecie?',
    a: 'Tak. Możemy pracować w modelu pełnego prowadzenia projektu lub jako konsultant wspierający — w zależności od Państwa zasobów i potrzeb. W tym drugim przypadku wycena jest indywidualna.',
  },
  {
    q: 'Jak długo trwa przygotowanie dokumentacji?',
    a: 'Standardowo 6–10 tygodni od startu współpracy do złożenia wniosku — zależy od złożoności projektu, dostępności audytu energetycznego oraz harmonogramu naboru.',
  },
  {
    q: 'Czy współpraca obejmuje również obsługę po przyznaniu dofinansowania?',
    a: 'Tak — jest to etap opcjonalny, rozliczany w modelu miesięcznym. Klient decyduje, czy chce kontynuować współpracę przy obsłudze projektu.',
  },
  {
    q: 'Kto jest właścicielem dokumentacji po zakończeniu współpracy?',
    a: 'Klient. Cała dokumentacja aplikacyjna oraz materiały powstałe w ramach usługi są własnością klienta — przekazujemy je w formie edytowalnej.',
  },
  {
    q: 'Jak wygląda ochrona danych i informacji poufnych?',
    a: 'Każda współpraca rozpoczyna się od podpisania NDA. Dane przechowujemy w zaszyfrowanej formie na serwerach zlokalizowanych w UE.',
  },
];
