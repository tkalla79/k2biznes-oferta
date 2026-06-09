/**
 * Loading state dla /o/[token] (H7 audit).
 *
 * `force-dynamic` + 4 SQL queries + cold-start Vercel + Supabase EU latency =
 * 800-2000ms biały ekran z perspektywy klienta klikającego z maila. Skeleton
 * hero daje natychmiastowy feedback "ładuje się" zamiast pustki.
 *
 * Layout wstrzykuje fonty (Fraunces/Inter) + styles.css — używamy tych klas.
 */
export default function OfferLoading() {
  return (
    <div className="app" aria-busy="true" aria-label="Ładowanie oferty">
      <section className="hero" style={{ minHeight: '70vh' }}>
        <div className="hero-content">
          <div style={sk(180, 28, 24)} />
          <div style={sk(560, 64, 20)} />
          <div style={sk(480, 64, 12)} />
          <div style={sk(320, 64, 40)} />
          <div style={{ display: 'flex', gap: 48, marginTop: 64 }}>
            <div style={sk(120, 56, 0)} />
            <div style={sk(120, 56, 0)} />
            <div style={sk(120, 56, 0)} />
          </div>
        </div>
      </section>
    </div>
  );
}

// Skeleton block — shimmer przez CSS animation w styles.css (.skeleton-pulse).
function sk(width: number, height: number, marginBottom: number): React.CSSProperties {
  return {
    width: `min(${width}px, 90%)`,
    height,
    marginBottom,
    borderRadius: 8,
    background: 'linear-gradient(90deg, #f0eeea 25%, #e4e1db 50%, #f0eeea 75%)',
    backgroundSize: '200% 100%',
    animation: 'k2-shimmer 1.4s ease-in-out infinite',
  };
}
