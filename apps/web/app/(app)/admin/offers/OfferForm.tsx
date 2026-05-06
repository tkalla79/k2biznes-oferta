'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { OfferDto } from '@/lib/offers/mapper';

type ProgramOpt = { id: string; label: string; group_name: string };
type CaseStudyOpt = { id: string; client: string; title: string };
type ContactPersonOpt = { id: string; name: string; role: string };
type ProfileOpt = { id: string; full_name: string | null; email: string; role: string };
type Variant = 'I' | 'II' | 'III' | 'IV';

const ALL_VARIANTS: Variant[] = ['I', 'II', 'III', 'IV'];
const COMPANY_SIZES = [
  { value: '', label: '— nie wybrano —' },
  { value: 'micro', label: 'Mikro (<10)' },
  { value: 'small', label: 'Mała (10-49)' },
  { value: 'medium', label: 'Średnia (50-249)' },
  { value: 'large', label: 'Duża (250+)' },
];

// 16 województw PL — sortowane alfabetycznie. Plus "ogólnopolski" dla projektów
// rozproszonych. Wartości po polsku (lowercase, bez polskich znaków) — używane
// w filtrach + audycie.
const VOIVODESHIPS = [
  { value: '', label: '— nie wybrano —' },
  { value: 'dolnoslaskie', label: 'Dolnośląskie' },
  { value: 'kujawsko-pomorskie', label: 'Kujawsko-pomorskie' },
  { value: 'lubelskie', label: 'Lubelskie' },
  { value: 'lubuskie', label: 'Lubuskie' },
  { value: 'lodzkie', label: 'Łódzkie' },
  { value: 'malopolskie', label: 'Małopolskie' },
  { value: 'mazowieckie', label: 'Mazowieckie' },
  { value: 'opolskie', label: 'Opolskie' },
  { value: 'podkarpackie', label: 'Podkarpackie' },
  { value: 'podlaskie', label: 'Podlaskie' },
  { value: 'pomorskie', label: 'Pomorskie' },
  { value: 'slaskie', label: 'Śląskie' },
  { value: 'swietokrzyskie', label: 'Świętokrzyskie' },
  { value: 'warminsko-mazurskie', label: 'Warmińsko-mazurskie' },
  { value: 'wielkopolskie', label: 'Wielkopolskie' },
  { value: 'zachodniopomorskie', label: 'Zachodniopomorskie' },
  { value: 'ogolnopolski', label: 'Ogólnopolski (cała PL)' },
];

type FormState = {
  // Klient
  clientName: string;
  clientNip: string;
  clientIndustry: string;
  clientCompanySize: string;
  clientVoivodeship: string;
  // Program
  programId: string;
  programLabel: string;
  programCustomName: string;
  // Finanse
  projectValue: number;
  fundingRate: number;
  returningClient: boolean;
  projectCount: number;
  // Warianty
  offeredVariants: Variant[];
  selectedVariant: Variant;
  // Załączniki
  caseStudyId: string;
  contactPersonId: string;
  // Treść (rich text — start prosty: dwa textareas)
  contentIntro: string;
  contentFooter: string;
  // Ownership (admin only)
  assignedConsultantId: string;
};

type SimulatorResult = {
  funding: number;
  segment: { id: string; label: string };
  variants: Array<{
    id: Variant;
    name: string;
    base: number;
    sfAmount: number;
    monthly: number;
    total: number;
    expectedValue: number;
    breakEvenProbability: number;
  }>;
  recommendedVariantId: string;
};

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

function initialFromOffer(offer: OfferDto): FormState {
  const c = offer.content as { intro?: unknown; footer?: unknown } | null;
  return {
    clientName: offer.clientName,
    clientNip: offer.clientNip ?? '',
    clientIndustry: offer.clientIndustry ?? '',
    clientCompanySize: offer.clientCompanySize ?? '',
    clientVoivodeship: offer.clientVoivodeship ?? '',
    programId: offer.programId ?? '',
    programLabel: offer.programLabel,
    programCustomName: offer.programCustomName ?? '',
    projectValue: offer.projectValue,
    fundingRate: offer.fundingRate,
    returningClient: offer.returningClient,
    projectCount: offer.projectCount,
    offeredVariants: offer.offeredVariants as Variant[],
    selectedVariant: offer.selectedVariant as Variant,
    caseStudyId: offer.caseStudyId ?? '',
    contactPersonId: offer.contactPersonId ?? '',
    contentIntro: typeof c?.intro === 'string' ? c.intro : '',
    contentFooter: typeof c?.footer === 'string' ? c.footer : '',
    assignedConsultantId: offer.assignedConsultantId ?? '',
  };
}

function blankInitial(): FormState {
  return {
    clientName: '',
    clientNip: '',
    clientIndustry: '',
    clientCompanySize: '',
    clientVoivodeship: '',
    programId: '',
    programLabel: '',
    programCustomName: '',
    projectValue: 3_000_000,
    fundingRate: 0.7,
    returningClient: false,
    projectCount: 1,
    offeredVariants: ['I', 'II', 'III'],
    selectedVariant: 'I',
    caseStudyId: '',
    contactPersonId: '',
    contentIntro: '',
    contentFooter: '',
    assignedConsultantId: '',
  };
}

type Props =
  | {
      mode: 'create';
      offer?: undefined;
      programs: ProgramOpt[];
      caseStudies: CaseStudyOpt[];
      contactPersons: ContactPersonOpt[];
      profiles: ProfileOpt[];
      canAssignConsultant: boolean;
    }
  | {
      mode: 'edit';
      offer: OfferDto;
      programs: ProgramOpt[];
      caseStudies: CaseStudyOpt[];
      contactPersons: ContactPersonOpt[];
      profiles: ProfileOpt[];
      canAssignConsultant: boolean;
    };

export default function OfferForm({
  mode,
  offer,
  programs,
  caseStudies,
  contactPersons,
  profiles,
  canAssignConsultant,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(
    mode === 'edit' ? initialFromOffer(offer) : blankInitial(),
  );
  const [pricing, setPricing] = useState<SimulatorResult | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Auto-fill program label gdy wybierze się program z select'a.
  function selectProgram(id: string) {
    const p = programs.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      programId: id,
      programLabel: p?.label ?? f.programLabel,
    }));
  }

  // Live pricing preview — debounced 400ms na zmianach finansów.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPricing();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectValue, form.fundingRate, form.returningClient, form.projectCount]);

  async function fetchPricing() {
    if (form.projectValue <= 0 || form.fundingRate <= 0) return;
    try {
      const res = await fetch('/api/simulator/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectValue: form.projectValue,
          fundingRate: form.fundingRate,
          probability: 0.5,
          returningClient: form.returningClient,
          projectCount: form.projectCount,
          monthsExec: 18,
        }),
      });
      const json = await res.json();
      if (res.ok) setPricing(json.data);
    } catch {
      // Silent — preview is non-critical.
    }
  }

  function toggleOffered(v: Variant) {
    const next = form.offeredVariants.includes(v)
      ? form.offeredVariants.filter((x) => x !== v)
      : [...form.offeredVariants, v];
    if (next.length === 0) return; // co najmniej 1
    setForm((f) => ({
      ...f,
      offeredVariants: next,
      selectedVariant: next.includes(f.selectedVariant) ? f.selectedVariant : next[0],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.clientName.trim() || !form.programLabel.trim()) {
      setError('Klient i nazwa programu są wymagane.');
      return;
    }
    if (!form.offeredVariants.includes(form.selectedVariant)) {
      setError('Wybrany wariant musi być w zaznaczonych ofertowych.');
      return;
    }
    if (form.clientNip && !/^\d{10}$/.test(form.clientNip)) {
      setError('NIP musi mieć 10 cyfr.');
      return;
    }

    setBusy(true);
    const content: Record<string, string> = {};
    if (form.contentIntro.trim()) content.intro = form.contentIntro.trim();
    if (form.contentFooter.trim()) content.footer = form.contentFooter.trim();

    const body = {
      clientName: form.clientName.trim(),
      clientNip: form.clientNip.trim() || undefined,
      clientIndustry: form.clientIndustry.trim() || undefined,
      clientCompanySize: form.clientCompanySize || undefined,
      clientVoivodeship: form.clientVoivodeship.trim() || undefined,
      programId: form.programId || undefined,
      programLabel: form.programLabel.trim(),
      programCustomName: form.programCustomName.trim() || undefined,
      projectValue: form.projectValue,
      fundingRate: form.fundingRate,
      returningClient: form.returningClient,
      projectCount: form.projectCount,
      selectedVariant: form.selectedVariant,
      offeredVariants: form.offeredVariants,
      caseStudyId: form.caseStudyId || undefined,
      contactPersonId: form.contactPersonId || undefined,
      assignedConsultantId:
        canAssignConsultant && form.assignedConsultantId ? form.assignedConsultantId : undefined,
      content,
    };

    try {
      const url = mode === 'create' ? '/api/offers' : `/api/offers/${offer!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? `${method} failed.`);
        return;
      }
      if (mode === 'create') {
        const id = json.data?.id;
        startTransition(() => {
          if (id) router.push(`/admin/offers/${id}/edit`);
          else router.push('/admin/offers');
          router.refresh();
        });
      } else {
        setSuccess('Zapisano.');
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Programy zgrupowane dla <optgroup>
  const grouped = useMemo(() => {
    const m = new Map<string, ProgramOpt[]>();
    for (const p of programs) {
      const list = m.get(p.group_name) ?? [];
      list.push(p);
      m.set(p.group_name, list);
    }
    return Array.from(m.entries());
  }, [programs]);

  const isEditingSentOffer = mode === 'edit' && offer!.status !== 'draft';

  return (
    <form onSubmit={submit} style={formStyle}>
      {isEditingSentOffer && (
        <div style={warnBox}>
          <strong>Uwaga:</strong> oferta ma status <code>{offer!.status}</code>. Zmiany finansów
          spowodują rekalkulację snapshotu i unieważnienie cache PDF.
        </div>
      )}

      {/* SECTION 1: Klient */}
      <Section title="Klient">
        <Grid2>
          <Field label="Nazwa firmy *">
            <input
              type="text"
              required
              maxLength={200}
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              style={input}
            />
          </Field>
          <Field label="NIP (10 cyfr)">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              value={form.clientNip}
              onChange={(e) => update('clientNip', e.target.value.replace(/\D/g, ''))}
              style={input}
            />
          </Field>
          <Field label="Branża">
            <input
              type="text"
              maxLength={200}
              value={form.clientIndustry}
              onChange={(e) => update('clientIndustry', e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Wielkość firmy">
            <select
              value={form.clientCompanySize}
              onChange={(e) => update('clientCompanySize', e.target.value)}
              style={input}
            >
              {COMPANY_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Województwo">
            <select
              value={form.clientVoivodeship}
              onChange={(e) => update('clientVoivodeship', e.target.value)}
              style={input}
            >
              {VOIVODESHIPS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </Grid2>
      </Section>

      {/* SECTION 2: Program */}
      <Section title="Program dotacyjny">
        <Field label="Wybierz z katalogu (lub zostaw puste i wpisz własny)">
          <select
            value={form.programId}
            onChange={(e) => selectProgram(e.target.value)}
            style={input}
          >
            <option value="">— wybierz program —</option>
            {grouped.map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Grid2>
          <Field label="Nazwa programu (label) *">
            <input
              type="text"
              required
              maxLength={200}
              value={form.programLabel}
              onChange={(e) => update('programLabel', e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Custom name (override)">
            <input
              type="text"
              maxLength={200}
              value={form.programCustomName}
              onChange={(e) => update('programCustomName', e.target.value)}
              style={input}
              placeholder="opcjonalnie"
            />
          </Field>
        </Grid2>
      </Section>

      {/* SECTION 3: Finanse */}
      <Section title="Finanse projektu">
        <Grid2>
          <Field label="Wartość projektu (PLN) *">
            <input
              type="number"
              required
              min={1}
              max={1_000_000_000}
              step="any"
              value={form.projectValue}
              onChange={(e) => update('projectValue', Number(e.target.value))}
              style={input}
              placeholder="np. 3500000 lub 3500000.50"
            />
          </Field>
          <Field label={`Intensywność: ${(form.fundingRate * 100).toFixed(0)}%`}>
            <input
              type="range"
              min={0.1}
              max={0.95}
              step={0.05}
              value={form.fundingRate}
              onChange={(e) => update('fundingRate', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Liczba projektów">
            <select
              value={form.projectCount}
              onChange={(e) => update('projectCount', Number(e.target.value))}
              style={input}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Klient powracający">
            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={form.returningClient}
                onChange={(e) => update('returningClient', e.target.checked)}
              />
              <span>Tak — rabat 20% na base fee</span>
            </label>
          </Field>
        </Grid2>
      </Section>

      {/* SECTION 4: Pricing preview (live) */}
      <Section title="Pricing (live preview)">
        {pricing ? (
          <div>
            <p style={pricingSummary}>
              Funding: <strong>{fmtPLN(pricing.funding)}</strong> · Segment{' '}
              <strong>{pricing.segment.label}</strong> · Rekomendowany wariant{' '}
              <strong>{pricing.recommendedVariantId}</strong>
            </p>
            <table style={tablePricing}>
              <thead>
                <tr>
                  <th style={thLeft}></th>
                  <th style={thCell}>Wariant</th>
                  <th style={thRight}>Opłata wstępna</th>
                  <th style={thRight}>Wynagrodzenie wynikowe</th>
                  <th style={thRight}>Razem</th>
                  <th style={thRight} title="Wartość oczekiwana — total × prawdopodobieństwo akceptacji">EV ⓘ</th>
                </tr>
              </thead>
              <tbody>
                {pricing.variants.map((v) => {
                  const offered = form.offeredVariants.includes(v.id);
                  const selected = form.selectedVariant === v.id;
                  return (
                    <tr
                      key={v.id}
                      style={selected ? rowSelected : offered ? undefined : rowMuted}
                    >
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={offered}
                          onChange={() => toggleOffered(v.id)}
                        />
                      </td>
                      <td style={td}>
                        <strong>{v.id}</strong> — {v.name}
                        {v.id === pricing.recommendedVariantId && (
                          <span style={recoTag}>★</span>
                        )}
                      </td>
                      <td style={tdRight}>{fmtPLN(v.base)}</td>
                      <td style={tdRight}>{fmtPLN(v.sfAmount)}</td>
                      <td style={tdRight}>{fmtPLN(v.total)}</td>
                      <td style={{ ...tdRight, fontWeight: 600 }}>{fmtPLN(v.expectedValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7a92' }}>Wariant rekomendowany dla klienta:</span>
              {form.offeredVariants.map((v) => (
                <label key={v} style={radioRow}>
                  <input
                    type="radio"
                    name="selectedVariant"
                    value={v}
                    checked={form.selectedVariant === v}
                    onChange={() => update('selectedVariant', v)}
                  />
                  <span>{v}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: '#6b7a92', fontSize: 13 }}>Liczę pricing…</p>
        )}
      </Section>

      {/* SECTION 5: Treść (rich text — start z dwóch textareas) */}
      <Section title="Treść w ofercie">
        <Field label="Wstęp (intro) — pojawi się nad pricingiem">
          <textarea
            value={form.contentIntro}
            onChange={(e) => update('contentIntro', e.target.value)}
            style={textarea}
            rows={4}
            maxLength={4000}
            placeholder="Np. Dziękujemy za rozmowę. Poniżej propozycja współpracy przy aplikacji o dofinansowanie…"
          />
        </Field>
        <Field label="Podsumowanie (footer) — pojawi się pod pricingiem">
          <textarea
            value={form.contentFooter}
            onChange={(e) => update('contentFooter', e.target.value)}
            style={textarea}
            rows={3}
            maxLength={2000}
            placeholder="Np. Pełen zakres usług, harmonogram pracy i warunki płatności znajdziesz w załączonym PDF."
          />
        </Field>
      </Section>

      {/* SECTION 6: Załączniki */}
      <Section title="Załączniki w ofercie">
        <Grid2>
          <Field label="Osoba kontaktowa">
            <select
              value={form.contactPersonId}
              onChange={(e) => update('contactPersonId', e.target.value)}
              style={input}
            >
              <option value="">— bez osoby kontaktowej —</option>
              {contactPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Case study">
            <select
              value={form.caseStudyId}
              onChange={(e) => update('caseStudyId', e.target.value)}
              style={input}
            >
              <option value="">— bez case study —</option>
              {caseStudies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client} — {c.title}
                </option>
              ))}
            </select>
          </Field>
        </Grid2>
      </Section>

      {/* SECTION 7: Ownership (admin only) */}
      {canAssignConsultant && profiles.length > 0 && (
        <Section title="Właściciel oferty (admin)">
          <Field label="Przypisany konsultant">
            <select
              value={form.assignedConsultantId}
              onChange={(e) => update('assignedConsultantId', e.target.value)}
              style={input}
            >
              <option value="">— bez przypisania (zostaje przy autorze) —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email} ({p.role})
                </option>
              ))}
            </select>
          </Field>
          <p style={hint}>
            Reassign zmienia kto widzi i edytuje ofertę. Autor (created_by) nie zmienia się.
          </p>
        </Section>
      )}

      {/* Actions */}
      <div style={actions}>
        <button type="submit" disabled={busy || pending} style={btnPrimary}>
          {busy ? 'Zapisuję…' : mode === 'create' ? 'Stwórz ofertę' : 'Zapisz zmiany'}
        </button>
        {error && <div style={errorBox}>{error}</div>}
        {success && <div style={successBox}>{success}</div>}
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Sub-komponenty
// -----------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={labelText}>{label}</div>
      {children}
    </label>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={grid2}>{children}</div>;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const formStyle: React.CSSProperties = { display: 'grid', gap: 20 };
const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 20,
};
const h2: React.CSSProperties = { fontSize: 16, marginTop: 0, marginBottom: 12, color: '#1B2A4A' };
const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};
const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 4 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  background: '#fff',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const textarea: React.CSSProperties = {
  ...input,
  resize: 'vertical',
  lineHeight: 1.5,
  padding: 10,
};
const hint: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7a92',
  margin: '8px 0 0',
  lineHeight: 1.4,
};
const checkboxRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 14,
  paddingTop: 6,
};
const radioRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  fontSize: 14,
};
const pricingSummary: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7a92',
  margin: '0 0 12px',
};
const tablePricing: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};
const thLeft: React.CSSProperties = { width: 32 };
const thCell: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 0',
  fontSize: 11,
  color: '#6b7a92',
  textTransform: 'uppercase',
  borderBottom: '2px solid #e4e9f2',
};
const thRight: React.CSSProperties = { ...thCell, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid #eef1f7' };
const tdRight: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const rowSelected: React.CSSProperties = { background: '#dff3e8' };
const rowMuted: React.CSSProperties = { opacity: 0.5 };
const recoTag: React.CSSProperties = { marginLeft: 6, fontSize: 11, color: '#1f7a4c' };

const actions: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginTop: 8,
};
const btnPrimary: React.CSSProperties = {
  padding: '12px 24px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
const errorBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};
const successBox: React.CSSProperties = {
  padding: 10,
  background: '#dff3e8',
  border: '1px solid #1f7a4c',
  borderRadius: 6,
  color: '#1f7a4c',
  fontSize: 13,
};
const warnBox: React.CSSProperties = {
  padding: 12,
  background: '#fef3c7',
  border: '1px solid #d97706',
  borderRadius: 6,
  color: '#92400e',
  fontSize: 13,
};
