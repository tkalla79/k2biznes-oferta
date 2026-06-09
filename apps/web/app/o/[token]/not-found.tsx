/**
 * 404 dla /o/[token] (H7 audit).
 *
 * Gdy `fetchPublicOffer` rzuci notFound() (token nie istnieje / soft-deleted),
 * klient widzi friendly stronę PL z kontaktem zamiast generic Next 404.
 * Brandowane jak error.tsx.
 */
export default function OfferNotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#fbfaf7',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: 'center',
          background: '#fff',
          border: '1px solid #e4e6ec',
          borderRadius: 14,
          padding: '48px 40px',
          boxShadow: '0 8px 28px rgba(18,26,40,.06)',
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#D91E18',
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          K2BIZNES
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 400,
            fontSize: 28,
            color: '#2a324b',
            margin: '0 0 12px',
          }}
        >
          Oferta niedostępna
        </h1>
        <p style={{ color: '#6B7385', fontSize: 15, lineHeight: 1.55, margin: '0 0 28px' }}>
          Ten link do oferty jest nieprawidłowy lub oferta została wycofana.
          Jeśli otrzymali Państwo go od nas, prosimy o kontakt — prześlemy
          aktualny link.
        </p>
        <div style={{ fontSize: 13, color: '#6B7385', paddingTop: 20, borderTop: '1px solid #e4e6ec' }}>
          <a href="mailto:kontakt@k2biznes.pl" style={{ color: '#6B7385' }}>
            kontakt@k2biznes.pl
          </a>
        </div>
      </div>
    </div>
  );
}
