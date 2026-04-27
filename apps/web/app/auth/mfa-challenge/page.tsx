/**
 * MFA challenge page (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * Wpada tu user który po signinie ma `aal1`, ale jego konto ma verified TOTP
 * factor. Wymaga wpisania kodu żeby upgrade'ować sesję do `aal2`.
 *
 * SSR: jeśli `aal2` już osiągnięte (np. session restore) — redirect do `next`.
 * Jeśli brak factor'a — redirect do `/auth/mfa-setup`.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { safeNext } from '@/lib/auth/safe-next';
import MfaChallengeForm from './MfaChallengeForm';

export const dynamic = 'force-dynamic';

export default async function MfaChallengePage({
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
        set: (_name: string, _value: string, _options: CookieOptions) => {},
        remove: (_name: string, _options: CookieOptions) => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sanityzacja chroni przed open-redirect: `?next=https://evil.com`.
  const next = safeNext(searchParams.next);
  if (!user) redirect(`/auth/signin?next=${encodeURIComponent(next)}`);

  // Sprawdź AAL — jeśli już aal2, nie ma sensu pytać o kod.
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === 'aal2') redirect(next);

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === 'verified') ?? null;
  if (!verifiedTotp) {
    // Brak factor'a — wyślij usera żeby najpierw zenrollował.
    redirect(`/auth/mfa-setup?next=${encodeURIComponent(next)}`);
  }

  return (
    <main style={main}>
      <div style={card}>
        <h1 style={h1}>K2BIZNES</h1>
        <p style={subtitle}>Drugi krok logowania</p>
        <p style={hint}>
          Wpisz 6-cyfrowy kod z aplikacji TOTP (
          {verifiedTotp.friendly_name ?? 'urządzenie'}).
        </p>
        <MfaChallengeForm factorId={verifiedTotp.id} next={next} />
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
  margin: '8px 0 16px',
};
const hint: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7a92',
  margin: '0 0 16px',
  lineHeight: 1.5,
};
