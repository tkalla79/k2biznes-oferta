'use client';

/**
 * Zamiennik `window.prompt` — modal w stylu panelu.
 *
 * Natywny prompt miał trzy wady, które bolały w codziennej pracy: wygląda jak
 * alert z innej epoki i wypada ze stylu panelu, nie da się w nim napisać
 * dłuższego tekstu w kilku liniach (np. powodu odrzucenia wniosku RODO), a w
 * części przeglądarek bywa blokowany albo tłumiony razem z innymi oknami
 * natywnymi — wtedy akcja po cichu nie działa.
 *
 * API celowo naśladuje `prompt`: `ask()` zwraca Promise ze stringiem albo
 * `null` przy anulowaniu, więc wywołania zostają jednolinijkowe i nie trzeba
 * przepisywać logiki na callbacki. Pusty string to NIE to samo co `null` —
 * powód odrzucenia wolno zostawić pusty, ale anulowanie musi przerwać akcję.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type PromptOptions = {
  title: string;
  label?: string;
  /** Tekst pod etykietą — kiedy warto coś wpisać, a kiedy można pominąć. */
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Pole wielolinijkowe (powód, notatka). */
  multiline?: boolean;
  /** Pusta wartość blokuje zatwierdzenie. */
  required?: boolean;
  confirmLabel?: string;
  maxLength?: number;
};

type State = (PromptOptions & { value: string }) | null;

export function usePromptDialog() {
  const [state, setState] = useState<State>(null);
  const resolveRef = useRef<((v: string | null) => void) | null>(null);

  const finish = useCallback((v: string | null) => {
    resolveRef.current?.(v);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ask = useCallback((opts: PromptOptions) => {
    setState({ ...opts, value: opts.defaultValue ?? '' });
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  // Odmontowanie z otwartym oknem nie może zostawić wiszącego Promise —
  // czekający `await` nigdy by się nie wznowił i akcja zawisłaby na „Zapisuję…".
  useEffect(() => {
    return () => {
      resolveRef.current?.(null);
      resolveRef.current = null;
    };
  }, []);

  const dialog = state ? (
    <PromptDialog
      state={state}
      onChange={(value) => setState((s) => (s ? { ...s, value } : s))}
      onCancel={() => finish(null)}
      onConfirm={() => finish(state.value)}
    />
  ) : null;

  return { ask, dialog };
}

function PromptDialog({
  state,
  onChange,
  onCancel,
  onConfirm,
}: {
  state: NonNullable<State>;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const canConfirm = !state.required || state.value.trim() !== '';

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Escape zamyka — tak samo jak w natywnym prompcie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div style={overlay} onClick={onCancel}>
      <div
        style={modal}
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={h3}>{state.title}</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onConfirm();
          }}
        >
          {state.label && <div style={labelText}>{state.label}</div>}
          {state.hint && <div style={hintText}>{state.hint}</div>}

          {state.multiline ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              rows={4}
              value={state.value}
              maxLength={state.maxLength ?? 2000}
              placeholder={state.placeholder}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...input, lineHeight: 1.5, resize: 'vertical' }}
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              value={state.value}
              maxLength={state.maxLength ?? 200}
              placeholder={state.placeholder}
              onChange={(e) => onChange(e.target.value)}
              style={input}
            />
          )}

          <div style={actions}>
            <button type="button" onClick={onCancel} style={btnGhost}>
              Anuluj
            </button>
            <button type="submit" disabled={!canConfirm} style={canConfirm ? btnPrimary : btnOff}>
              {state.confirmLabel ?? 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(16, 22, 36, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 100,
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 24,
  width: '100%',
  maxWidth: 460,
  boxShadow: '0 20px 48px rgba(16, 22, 36, 0.28)',
};
const h3: React.CSSProperties = { margin: '0 0 16px', fontSize: 18 };
const labelText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#3a4254',
  marginBottom: 4,
};
const hintText: React.CSSProperties = { fontSize: 12, color: '#9aa3b2', marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d4dae6',
  borderRadius: 6,
  fontSize: 15,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const actions: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 20,
};
const btnBase: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  border: '1px solid transparent',
};
const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: '#fff',
  color: '#6b7a92',
  borderColor: '#e4e9f2',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#c92b3a', color: '#fff' };
const btnOff: React.CSSProperties = {
  ...btnBase,
  background: '#f1f3f7',
  color: '#9aa7bb',
  borderColor: '#e4e9f2',
  cursor: 'not-allowed',
};
