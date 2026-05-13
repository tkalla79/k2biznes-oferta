/**
 * Forgot password page — wpisuje email, dostaje link recovery na email.
 */
import ForgotPasswordForm from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <main style={main}>
      <div style={card}>
        <h1 style={h1}>K2BIZNES</h1>
        <p style={subtitle}>Zresetuj hasło</p>
        <ForgotPasswordForm />
        <p style={footer}>
          Pamiętasz hasło?{' '}
          <a href="/auth/signin" style={link}>
            Wróć do logowania
          </a>
        </p>
      </div>
    </main>
  );
}

const main: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#fbfaf7',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  padding: 24,
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 32,
};
const h1: React.CSSProperties = {
  letterSpacing: 2,
  fontSize: 14,
  color: '#c92b3a',
  fontWeight: 700,
  margin: 0,
};
const subtitle: React.CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: 22,
  color: '#1B2A4A',
  margin: '8px 0 24px',
};
const footer: React.CSSProperties = {
  marginTop: 24,
  fontSize: 13,
  color: '#6b7a92',
  textAlign: 'center',
};
const link: React.CSSProperties = {
  color: '#c92b3a',
  textDecoration: 'none',
};
