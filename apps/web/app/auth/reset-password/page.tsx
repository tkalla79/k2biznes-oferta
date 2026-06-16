/**
 * Reset password page — landing po kliknięciu w recovery link.
 * Supabase auth callback ustawia sesję recovery, user wpisuje nowe hasło.
 *
 * Konta z MFA: sesja recovery to AAL1, a zmiana hasła wymaga AAL2. SSR wykrywa
 * verified TOTP factor i przekazuje `mfaFactorId` — formularz pokaże pole na kod.
 */
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (_n: string, _v: string, _o: CookieOptions) => {},
        remove: (_n: string, _o: CookieOptions) => {},
      },
    },
  );

  let mfaFactorId: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      mfaFactorId = factors?.totp?.find((f) => f.status === 'verified')?.id ?? null;
    }
  }

  return (
    <main style={main}>
      <div style={card}>
        <h1 style={h1}>K2BIZNES</h1>
        <p style={subtitle}>Ustaw nowe hasło</p>
        <ResetPasswordForm mfaFactorId={mfaFactorId} />
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
