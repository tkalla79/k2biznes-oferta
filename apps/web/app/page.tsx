import Link from 'next/link';

/**
 * Landing — minimalna strona startowa z brand'em K2 i przyciskiem do logowania.
 * Klienci końcowi nie używają `/` (link do oferty trafia bezpośrednio na
 * `/o/<token>` z maila), więc to widzi tylko tester/konsultant.
 */
export default function Home() {
  return (
    <main style={main}>
      <div style={card}>
        <div style={brand}>K2BIZNES</div>
        <h1 style={h1}>Oferta — panel konsultanta</h1>
        <p style={lead}>
          System przygotowywania i wysyłki ofert dotacyjnych dla klientów K2Biznes.
        </p>
        <Link href="/auth/signin" style={btn}>
          Zaloguj się →
        </Link>
        <div style={footer}>
          <a href="/privacy-policy" style={link}>Polityka prywatności</a>
          {' · '}
          <a href="https://www.k2biznes.pl" style={link} target="_blank" rel="noopener noreferrer">
            www.k2biznes.pl
          </a>
        </div>
      </div>
    </main>
  );
}

const main: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#fbfaf7',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  padding: 24,
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: '#fff',
  border: '1px solid #e4e6ec',
  borderRadius: 14,
  padding: '48px 40px',
  textAlign: 'center',
  boxShadow: '0 8px 28px rgba(18, 26, 40, .06)',
};
const brand: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#D91E18',
  letterSpacing: 2,
  marginBottom: 24,
};
const h1: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontWeight: 400,
  fontSize: 32,
  letterSpacing: '-.02em',
  color: '#2a324b',
  margin: '0 0 12px',
};
const lead: React.CSSProperties = {
  color: '#6B7385',
  fontSize: 15,
  lineHeight: 1.55,
  margin: '0 0 32px',
};
const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 32px',
  background: '#D91E18',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  marginBottom: 32,
};
const footer: React.CSSProperties = {
  fontSize: 12,
  color: '#6B7385',
  paddingTop: 24,
  borderTop: '1px solid #e4e6ec',
};
const link: React.CSSProperties = {
  color: '#6B7385',
  textDecoration: 'none',
};
