/**
 * Reset password page — landing po kliknięciu w recovery link.
 * Supabase auth callback ustawia sesję recovery, user wpisuje nowe hasło.
 */
import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <main style={main}>
      <div style={card}>
        <h1 style={h1}>K2BIZNES</h1>
        <p style={subtitle}>Ustaw nowe hasło</p>
        <ResetPasswordForm />
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
