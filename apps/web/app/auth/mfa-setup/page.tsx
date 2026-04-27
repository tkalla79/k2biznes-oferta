/**
 * MFA setup page (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * SSR: sprawdza listę factorów. Jeśli user ma `verified` totp factor — pokazuje
 * "MFA aktywne" + unenroll. W przeciwnym razie deleguje do `MfaSetupForm`,
 * który robi enroll → display QR → verify.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { safeNext } from '@/lib/auth/safe-next';
import MfaSetupForm from './MfaSetupForm';

export const dynamic = 'force-dynamic';

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        // Page renderuje się bez modyfikacji cookies — set/remove no-op.
        set: (_name: string, _value: string, _options: CookieOptions) => {},
        remove: (_name: string, _options: CookieOptions) => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/auth/mfa-setup');

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === 'verified') ?? null;

  return (
    <main style={main}>
      <div style={card}>
        <h1 style={h1}>K2BIZNES</h1>
        <p style={subtitle}>Uwierzytelnianie dwuskładnikowe</p>

        <MfaSetupForm
          existingFactor={
            verifiedTotp
              ? { id: verifiedTotp.id, friendlyName: verifiedTotp.friendly_name ?? 'TOTP' }
              : null
          }
          next={safeNext(searchParams.next)}
        />

        <p style={footer}>
          Problemy z konfiguracją? Napisz do{' '}
          <a href="mailto:kontakt@k2biznes.pl" style={link}>
            kontakt@k2biznes.pl
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
  maxWidth: 480,
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
