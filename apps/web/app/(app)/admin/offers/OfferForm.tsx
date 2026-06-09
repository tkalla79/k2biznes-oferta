'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { OfferDto } from '@/lib/offers/mapper';
import {
  DEFAULT_PAYMENT_MILESTONES,
  type PricingOverride,
  type VariantOverride,
} from '@/lib/pricing/override';
import type { PaymentMilestone } from '@/lib/pricing/types';
import RichTextEditor from '@/components/RichTextEditor';

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

type VariantOverrideUI = {
  base: string; // input as text — '' = use auto-calc
  sfPct: string; // wpisywany jako % (np. "5" = 5% = 0.05)
  monthly: string;
  payment: PaymentMilestone[];
};

type ExecFeeUI = {
  kicker: string;
  title: string;
  desc: string;
  monthly: string; // '' = use selectedVariant.monthly
};

type AltProgramUI = {
  name: string;
  program: string;
  nabor: string;
  desc: string;
  url: string;
};

// Feature #2: pozycja biblioteki alt-programów (do szybkiego dodania do listy).
type AltProgramOpt = {
  id: string;
  name: string;
  program: string;
  nabor: string | null;
  desc: string | null;
  url: string | null;
};

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
  // PR-D: edytowalne sekcje oferty
  programDescription: string; // HTML z Tiptapa
  altPrograms: AltProgramUI[]; // alternatywne programy (per oferta)
  // Ownership (admin only)
  assignedConsultantId: string;
  // Pricing override (sekcja 6.5 spec / PR #29)
  pricingMode: 'auto' | 'manual';
  overrides: Record<Variant, VariantOverrideUI>;
  execFee: ExecFeeUI;
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

function emptyVariantOverride(): VariantOverrideUI {
  return { base: '', sfPct: '', monthly: '', payment: [...DEFAULT_PAYMENT_MILESTONES] };
}

function emptyOverrides(): Record<Variant, VariantOverrideUI> {
  return {
    I: emptyVariantOverride(),
    II: emptyVariantOverride(),
    III: emptyVariantOverride(),
    IV: emptyVariantOverride(),
  };
}

function emptyExecFee(): ExecFeeUI {
  return { kicker: '', title: '', desc: '', monthly: '' };
}

function overridesFromOffer(offer: OfferDto): Record<Variant, VariantOverrideUI> {
  const ov = offer.pricingOverride;
  const snap = offer.pricingSnapshot;
  const out = emptyOverrides();
  for (const id of ALL_VARIANTS) {
    const ovV = ov?.variants?.[id] ?? null;
    const snapV = snap?.variants?.find((x) => x.id === id);
    out[id] = {
      base: ovV?.base != null ? String(ovV.base) : snapV ? String(snapV.base) : '',
      sfPct:
        ovV?.sfPct != null
          ? String(Math.round(ovV.sfPct * 10000) / 100)
          : snapV
            ? String(Math.round(snapV.sfPct * 10000) / 100)
            : '',
      monthly: ovV?.monthly != null ? String(ovV.monthly) : snapV ? String(snapV.monthly) : '',
      payment:
        ovV?.payment ??
        (snapV?.payment && snapV.payment.length > 0
          ? snapV.payment
          : [...DEFAULT_PAYMENT_MILESTONES]),
    };
  }
  return out;
}

function execFeeFromOffer(offer: OfferDto): ExecFeeUI {
  const ex = offer.pricingOverride?.execFee;
  return {
    kicker: ex?.kicker ?? '',
    title: ex?.title ?? '',
    desc: ex?.desc ?? '',
    monthly: ex?.monthly != null ? String(ex.monthly) : '',
  };
}

function pricingModeFromOffer(offer: OfferDto): 'auto' | 'manual' {
  const variants = offer.pricingOverride?.variants;
  if (!variants) return 'auto';
  const hasAny = Object.values(variants).some((v) => v && Object.keys(v).length > 0);
  return hasAny ? 'manual' : 'auto';
}

function initialFromOffer(offer: OfferDto): FormState {
  const c = offer.content as
    | {
        intro?: unknown;
        footer?: unknown;
        programDescription?: unknown;
        altPrograms?: unknown;
      }
    | null;
  const altPrograms = Array.isArray(c?.altPrograms)
    ? (c!.altPrograms as unknown[])
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
        .map((p) => ({
          name: typeof p.name === 'string' ? p.name : '',
          program: typeof p.program === 'string' ? p.program : '',
          nabor: typeof p.nabor === 'string' ? p.nabor : '',
          desc: typeof p.desc === 'string' ? p.desc : '',
          url: typeof p.url === 'string' ? p.url : '',
        }))
    : [];
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
    programDescription: typeof c?.programDescription === 'string' ? c.programDescription : '',
    altPrograms,
    assignedConsultantId: offer.assignedConsultantId ?? '',
    pricingMode: pricingModeFromOffer(offer),
    overrides: overridesFromOffer(offer),
    execFee: execFeeFromOffer(offer),
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
    programDescription: '',
    altPrograms: [],
    assignedConsultantId: '',
    pricingMode: 'auto',
    overrides: emptyOverrides(),
    execFee: emptyExecFee(),
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
      altProgramLibrary?: AltProgramOpt[];
    }
  | {
      mode: 'edit';
      offer: OfferDto;
      programs: ProgramOpt[];
      caseStudies: CaseStudyOpt[];
      contactPersons: ContactPersonOpt[];
      profiles: ProfileOpt[];
      canAssignConsultant: boolean;
      altProgramLibrary?: AltProgramOpt[];
    };

export default function OfferForm({
  mode,
  offer,
  programs,
  caseStudies,
  contactPersons,
  profiles,
  canAssignConsultant,
  altProgramLibrary = [],
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

  // Toggle Auto/Ręczne — przy włączaniu Manual prefillujemy override z bieżącego
  // simulator pricingu (lub snapshotu), żeby konsultant edytował od realnych
  // wartości a nie pustych pól.
  function setPricingMode(next: 'auto' | 'manual') {
    setForm((f) => {
      if (next === f.pricingMode) return f;
      if (next === 'auto') return { ...f, pricingMode: 'auto' };
      // → manual: prefill z pricing (jeśli jest), inaczej zostaw obecne overrides
      const overrides = { ...f.overrides };
      if (pricing) {
        for (const id of ALL_VARIANTS) {
          const pv = pricing.variants.find((x) => x.id === id);
          if (!pv) continue;
          const cur = overrides[id];
          overrides[id] = {
            base: cur.base !== '' ? cur.base : String(pv.base),
            sfPct:
              cur.sfPct !== ''
                ? cur.sfPct
                : pv.total > 0 && pv.base >= 0
                  ? // sfAmount/funding ≈ sfPct, ale simulator zwraca już sfAmount —
                    // odzyskujemy % z (sfAmount/funding) * 100
                    String(Math.round((pv.sfAmount / Math.max(1, pricing.funding)) * 10000) / 100)
                  : '',
            monthly: cur.monthly !== '' ? cur.monthly : String(pv.monthly),
            payment: cur.payment.length > 0 ? cur.payment : [...DEFAULT_PAYMENT_MILESTONES],
          };
        }
      }
      return { ...f, pricingMode: 'manual', overrides };
    });
  }

  function updateOverride(id: Variant, key: keyof VariantOverrideUI, value: string) {
    setForm((f) => ({
      ...f,
      overrides: { ...f.overrides, [id]: { ...f.overrides[id], [key]: value } },
    }));
  }

  function updatePayment(id: Variant, idx: number, key: 'pct' | 'when', value: string) {
    setForm((f) => {
      const list = [...f.overrides[id].payment];
      list[idx] = { ...list[idx], [key]: key === 'pct' ? Number(value) : value };
      return {
        ...f,
        overrides: { ...f.overrides, [id]: { ...f.overrides[id], payment: list } },
      };
    });
  }

  function addPayment(id: Variant) {
    setForm((f) => {
      const list = [...f.overrides[id].payment, { pct: 0, when: '' }];
      return {
        ...f,
        overrides: { ...f.overrides, [id]: { ...f.overrides[id], payment: list } },
      };
    });
  }

  function removePayment(id: Variant, idx: number) {
    setForm((f) => {
      const list = f.overrides[id].payment.filter((_, i) => i !== idx);
      return {
        ...f,
        overrides: { ...f.overrides, [id]: { ...f.overrides[id], payment: list } },
      };
    });
  }

  function updateExecFee<K extends keyof ExecFeeUI>(key: K, value: ExecFeeUI[K]) {
    setForm((f) => ({ ...f, execFee: { ...f.execFee, [key]: value } }));
  }

  // Buduje pricingOverride do wysłania w body PATCH/POST.
  // Auto mode + brak exec-fee → {} (czyści override).
  // Manual mode → variants per offered + execFee fields jeśli wypełnione.
  function buildPricingOverride(): PricingOverride {
    const out: PricingOverride = {};
    if (form.pricingMode === 'manual') {
      const variants: NonNullable<PricingOverride['variants']> = {};
      for (const id of form.offeredVariants) {
        const o = form.overrides[id];
        const v: VariantOverride = {};
        if (o.base !== '' && !Number.isNaN(Number(o.base))) v.base = Number(o.base);
        if (o.sfPct !== '' && !Number.isNaN(Number(o.sfPct))) v.sfPct = Number(o.sfPct) / 100;
        if (o.monthly !== '' && !Number.isNaN(Number(o.monthly))) v.monthly = Number(o.monthly);
        const cleanPayment = o.payment.filter((p) => p.when.trim() !== '' && p.pct >= 0);
        if (cleanPayment.length > 0) v.payment = cleanPayment;
        if (Object.keys(v).length > 0) variants[id] = v;
      }
      if (Object.keys(variants).length > 0) out.variants = variants;
    }
    const ex: NonNullable<PricingOverride['execFee']> = {};
    if (form.execFee.kicker.trim()) ex.kicker = form.execFee.kicker.trim();
    if (form.execFee.title.trim()) ex.title = form.execFee.title.trim();
    if (form.execFee.desc.trim()) ex.desc = form.execFee.desc.trim();
    if (form.execFee.monthly !== '' && !Number.isNaN(Number(form.execFee.monthly))) {
      ex.monthly = Number(form.execFee.monthly);
    }
    if (Object.keys(ex).length > 0) out.execFee = ex;
    return out;
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
    const content: Record<string, unknown> = {};
    if (form.contentIntro.trim()) content.intro = form.contentIntro.trim();
    if (form.contentFooter.trim()) content.footer = form.contentFooter.trim();
    if (form.programDescription.trim()) content.programDescription = form.programDescription;
    const cleanAlts = form.altPrograms.filter(
      (p) => p.name.trim() !== '' || p.desc.trim() !== '' || p.program.trim() !== '',
    );
    if (cleanAlts.length > 0) content.altPrograms = cleanAlts;

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
      pricingOverride: buildPricingOverride(),
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
        <div style={modeToggleRow}>
          <span style={{ fontSize: 13, color: '#6b7a92', fontWeight: 600 }}>Tryb cennika:</span>
          <label style={radioRow}>
            <input
              type="radio"
              name="pricingMode"
              checked={form.pricingMode === 'auto'}
              onChange={() => setPricingMode('auto')}
            />
            <span>Auto-calc (z konfiguracji segmentów)</span>
          </label>
          <label style={radioRow}>
            <input
              type="radio"
              name="pricingMode"
              checked={form.pricingMode === 'manual'}
              onChange={() => setPricingMode('manual')}
            />
            <span>Ręczne (negocjacje)</span>
          </label>
        </div>
        {form.pricingMode === 'manual' && (
          <p style={hint}>
            Tryb ręczny: wartości poniżej są wpisane przez Ciebie i będą zapisane w ofercie.
            Auto-calc nie nadpisze ich. Aby wrócić do auto, przełącz wyżej — override zostanie
            wyczyszczony przy zapisie.
          </p>
        )}
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
                  <th style={thRight}>SF %</th>
                  <th style={thRight}>Wynagrodzenie wynikowe</th>
                  <th style={thRight}>Razem</th>
                  <th style={thRight}>Mies. (exec)</th>
                  <th style={thRight} title="Wartość oczekiwana — total × prawdopodobieństwo akceptacji">EV ⓘ</th>
                </tr>
              </thead>
              <tbody>
                {pricing.variants.map((v) => {
                  const offered = form.offeredVariants.includes(v.id);
                  const selected = form.selectedVariant === v.id;
                  const ov = form.overrides[v.id];
                  // W manual mode wartości pokazujemy z override (z fallbackiem do
                  // simulator). W auto mode — tylko z simulatora.
                  const sfPctNum =
                    form.pricingMode === 'manual' && ov.sfPct !== ''
                      ? Number(ov.sfPct) / 100
                      : pricing.funding > 0
                        ? v.sfAmount / pricing.funding
                        : 0;
                  const baseNum =
                    form.pricingMode === 'manual' && ov.base !== '' ? Number(ov.base) : v.base;
                  const monthlyNum =
                    form.pricingMode === 'manual' && ov.monthly !== ''
                      ? Number(ov.monthly)
                      : v.monthly;
                  const sfAmount = Math.round(pricing.funding * sfPctNum);
                  const totalNum = baseNum + sfAmount;
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
                      <td style={tdRight}>
                        {form.pricingMode === 'manual' ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={ov.base}
                            onChange={(e) => updateOverride(v.id, 'base', e.target.value)}
                            placeholder={String(v.base)}
                            style={cellInput}
                          />
                        ) : (
                          fmtPLN(v.base)
                        )}
                      </td>
                      <td style={tdRight}>
                        {form.pricingMode === 'manual' ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            value={ov.sfPct}
                            onChange={(e) => updateOverride(v.id, 'sfPct', e.target.value)}
                            placeholder={(sfPctNum * 100).toFixed(2)}
                            style={cellInput}
                          />
                        ) : (
                          `${(sfPctNum * 100).toFixed(2)}%`
                        )}
                      </td>
                      <td style={tdRight}>{fmtPLN(sfAmount)}</td>
                      <td style={tdRight}>{fmtPLN(totalNum)}</td>
                      <td style={tdRight}>
                        {form.pricingMode === 'manual' ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={ov.monthly}
                            onChange={(e) => updateOverride(v.id, 'monthly', e.target.value)}
                            placeholder={String(v.monthly)}
                            style={cellInput}
                          />
                        ) : (
                          fmtPLN(v.monthly)
                        )}
                      </td>
                      <td style={{ ...tdRight, fontWeight: 600 }}>{fmtPLN(v.expectedValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {form.pricingMode === 'manual' && (
              <div style={{ marginTop: 16 }}>
                <h3 style={subH3}>Harmonogram płatności (per wariant)</h3>
                {form.offeredVariants.map((id) => (
                  <div key={id} style={paymentBlock}>
                    <div style={paymentBlockHead}>Wariant {id}</div>
                    <div style={paymentList}>
                      {form.overrides[id].payment.map((p, idx) => (
                        <div key={idx} style={paymentRow}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={p.pct}
                            onChange={(e) => updatePayment(id, idx, 'pct', e.target.value)}
                            style={{ ...cellInput, width: 60 }}
                            aria-label="Procent"
                          />
                          <span style={{ fontSize: 13, color: '#6b7a92' }}>%</span>
                          <input
                            type="text"
                            maxLength={120}
                            value={p.when}
                            onChange={(e) => updatePayment(id, idx, 'when', e.target.value)}
                            placeholder="np. po podpisaniu umowy"
                            style={{ ...cellInput, flex: 1 }}
                            aria-label="Kiedy płatne"
                          />
                          <button
                            type="button"
                            onClick={() => removePayment(id, idx)}
                            style={btnSmallGhost}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addPayment(id)} style={btnSmall}>
                        + dodaj ratę
                      </button>
                    </div>
                  </div>
                ))}
                <p style={hint}>
                  Suma % nie musi być 100 — zachowujesz dowolność (np. zaliczka + finalizacja).
                  Pole „kiedy płatne” pojawi się dosłownie w ofercie pod paskiem.
                </p>
              </div>
            )}

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

      {/* SECTION 4b: Wynagrodzenie wykonawcze (exec fee) — opcjonalne nadpisanie
          tekstu i kwoty miesięcznej. Pola puste = wartości domyślne (kicker/title/desc)
          oraz monthly z wybranego wariantu. */}
      <Section title="Wynagrodzenie wykonawcze (exec-fee)">
        <p style={hint}>
          Pojawia się pod tabelą wariantów na ofercie. Jeśli chcesz zachować
          domyślne brzmienie, zostaw pola puste — pojawi się tekst standardowy. Pole „kwota
          miesięczna” puste = używamy <code>monthly</code> z wybranego wariantu.
        </p>
        <Grid2>
          <Field label="Kicker (mała etykieta nad tytułem)">
            <input
              type="text"
              maxLength={200}
              value={form.execFee.kicker}
              onChange={(e) => updateExecFee('kicker', e.target.value)}
              placeholder="Obsługa i rozliczanie projektu (opcjonalnie)"
              style={input}
            />
          </Field>
          <Field label="Tytuł">
            <input
              type="text"
              maxLength={200}
              value={form.execFee.title}
              onChange={(e) => updateExecFee('title', e.target.value)}
              placeholder="Wynagrodzenie miesięczne"
              style={input}
            />
          </Field>
        </Grid2>
        <Field label="Opis">
          <textarea
            rows={2}
            maxLength={2000}
            value={form.execFee.desc}
            onChange={(e) => updateExecFee('desc', e.target.value)}
            placeholder="Po pozytywnej decyzji, jeśli zdecydują się Państwo kontynuować współpracę przy obsłudze projektu."
            style={textarea}
          />
        </Field>
        <Field label="Kwota miesięczna (PLN, opcjonalnie)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.execFee.monthly}
            onChange={(e) => updateExecFee('monthly', e.target.value)}
            placeholder="np. 6000 — puste = z wariantu"
            style={input}
          />
        </Field>
      </Section>

      {/* SECTION 4c: Opis rekomendowanego programu (rich text — Tiptap) */}
      <Section title="Opis rekomendowanego programu (na ofercie)">
        <p style={hint}>
          Pojawia się w sekcji „Rekomendujemy: <em>{form.programLabel || '<nazwa programu>'}</em>”.
          Pozostaw puste, by użyć domyślnych punktów (4 bullets).
        </p>
        <RichTextEditor
          value={form.programDescription}
          onChange={(html) => update('programDescription', html)}
          placeholder="Wpisz dlaczego ten program jest najlepszy dla klienta — możesz użyć list, pogrubień, cytatów."
          minHeight={180}
        />
      </Section>

      {/* SECTION 4d: Alternatywne programy (per oferta) */}
      <Section title="Alternatywne programy (Inne możliwości wsparcia)">
        <p style={hint}>
          Lista programów, które pojawią się pod opisem rekomendowanego — jako backup lub
          uzupełnienie. Pusta lista = pokazuje domyślne 4 programy z szablonu.
        </p>

        {/* Feature #2: szybkie dodanie z biblioteki. Klik → kopia do listy poniżej
            (edytowalna/usuwalna jak ad-hoc). Zarządzanie biblioteką: /admin/alt-programs. */}
        {altProgramLibrary.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#3a4254', marginBottom: 6 }}>
              Dodaj z biblioteki:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {altProgramLibrary.map((lib) => {
                const already = form.altPrograms.some(
                  (p) => p.name === lib.name && p.program === lib.program,
                );
                return (
                  <button
                    key={lib.id}
                    type="button"
                    disabled={already}
                    onClick={() =>
                      update('altPrograms', [
                        ...form.altPrograms,
                        {
                          name: lib.name,
                          program: lib.program,
                          nabor: lib.nabor ?? '',
                          desc: lib.desc ?? '',
                          url: lib.url ?? '',
                        },
                      ])
                    }
                    style={{
                      padding: '5px 12px',
                      fontSize: 13,
                      borderRadius: 999,
                      border: '1px solid #d4dae6',
                      background: already ? '#eef1f6' : '#fff',
                      color: already ? '#9aa3b2' : '#3a4254',
                      cursor: already ? 'default' : 'pointer',
                    }}
                    title={already ? 'Już dodany' : `Dodaj: ${lib.program}`}
                  >
                    {already ? '✓ ' : '+ '}
                    {lib.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.altPrograms.map((p, idx) => (
          <div key={idx} style={altCardStyle}>
            <div style={altCardHead}>
              Program #{idx + 1}
              <button
                type="button"
                onClick={() =>
                  update(
                    'altPrograms',
                    form.altPrograms.filter((_, i) => i !== idx),
                  )
                }
                style={btnSmallGhost}
              >
                Usuń
              </button>
            </div>
            <Grid2>
              <Field label="Nazwa programu (np. Ścieżka SMART)">
                <input
                  type="text"
                  maxLength={120}
                  value={p.name}
                  onChange={(e) => {
                    const next = [...form.altPrograms];
                    next[idx] = { ...next[idx], name: e.target.value };
                    update('altPrograms', next);
                  }}
                  style={input}
                />
              </Field>
              <Field label="Etykieta programu (np. FENG 2021–2027)">
                <input
                  type="text"
                  maxLength={120}
                  value={p.program}
                  onChange={(e) => {
                    const next = [...form.altPrograms];
                    next[idx] = { ...next[idx], program: e.target.value };
                    update('altPrograms', next);
                  }}
                  style={input}
                />
              </Field>
              <Field label="Termin naboru">
                <input
                  type="text"
                  maxLength={80}
                  value={p.nabor}
                  onChange={(e) => {
                    const next = [...form.altPrograms];
                    next[idx] = { ...next[idx], nabor: e.target.value };
                    update('altPrograms', next);
                  }}
                  placeholder="np. IV kw. 2026"
                  style={input}
                />
              </Field>
              <Field label="Link (URL)">
                <input
                  type="url"
                  maxLength={400}
                  value={p.url}
                  onChange={(e) => {
                    const next = [...form.altPrograms];
                    next[idx] = { ...next[idx], url: e.target.value };
                    update('altPrograms', next);
                  }}
                  placeholder="https://..."
                  style={input}
                />
              </Field>
            </Grid2>
            <Field label="Krótki opis">
              <textarea
                rows={2}
                maxLength={500}
                value={p.desc}
                onChange={(e) => {
                  const next = [...form.altPrograms];
                  next[idx] = { ...next[idx], desc: e.target.value };
                  update('altPrograms', next);
                }}
                style={textarea}
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update('altPrograms', [
              ...form.altPrograms,
              { name: '', program: '', nabor: '', desc: '', url: '' },
            ])
          }
          style={btnSmall}
        >
          + dodaj program alternatywny
        </button>
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
const modeToggleRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '8px 12px',
  marginBottom: 12,
  background: '#f7f9fc',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
};
const cellInput: React.CSSProperties = {
  width: 110,
  padding: '4px 6px',
  fontSize: 13,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  background: '#fff',
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  boxSizing: 'border-box',
};
const subH3: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1B2A4A',
  margin: '0 0 8px',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const paymentBlock: React.CSSProperties = {
  marginBottom: 12,
  padding: 10,
  background: '#f7f9fc',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
};
const paymentBlockHead: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7a92',
  marginBottom: 6,
};
const paymentList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
const paymentRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};
const btnSmall: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '4px 10px',
  fontSize: 12,
  background: '#fff',
  border: '1px solid #c92b3a',
  color: '#c92b3a',
  borderRadius: 4,
  cursor: 'pointer',
};
const btnSmallGhost: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 14,
  background: 'transparent',
  border: '1px solid #e4e9f2',
  color: '#6b7a92',
  borderRadius: 4,
  cursor: 'pointer',
};
const altCardStyle: React.CSSProperties = {
  padding: 12,
  marginBottom: 12,
  background: '#f7f9fc',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
};
const altCardHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7a92',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 8,
};
