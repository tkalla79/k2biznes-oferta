'use client';

import { useRef, useState } from 'react';

type Folder = 'case-studies' | 'contact-persons' | 'programs';

type Props = {
  value: string | null;
  onChange: (storageKey: string | null) => void;
  folder: Folder;
  accept?: string;
  label?: string;
  previewUrl?: string | null;
};

export default function FileUploadInput({
  value,
  onChange,
  folder,
  accept = 'image/jpeg,image/png,image/webp',
  label = 'Plik (upload)',
  previewUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = previewUrl ?? (value ? null : null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder);

      const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Błąd uploadu.');
      }

      onChange(json.data.storage_key as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    onChange(null);
    setError(null);
  }

  return (
    <div style={wrapper}>
      <div style={labelText}>{label}</div>
      <div style={row}>
        {(value || displayUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl ?? `/api/admin/upload/preview?key=${encodeURIComponent(value!)}`}
            alt="podgląd"
            style={preview}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div style={controls}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={btnUpload}
            disabled={uploading}
          >
            {uploading ? 'Wczytywanie…' : value ? 'Zmień plik' : 'Wybierz plik'}
          </button>
          {value && (
            <button type="button" onClick={handleRemove} style={btnRemove} disabled={uploading}>
              Usuń
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      {value && !displayUrl && (
        <div style={keyText} title={value}>
          {value}
        </div>
      )}
      {error && <div style={errBox}>{error}</div>}
    </div>
  );
}

const wrapper: React.CSSProperties = { display: 'grid', gap: 6 };
const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', fontWeight: 600 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const controls: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const preview: React.CSSProperties = {
  width: 56,
  height: 56,
  objectFit: 'contain',
  borderRadius: 6,
  border: '1px solid #e4e9f2',
  background: '#f9fafc',
  flexShrink: 0,
};
const keyText: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 320,
};
const btnUpload: React.CSSProperties = {
  padding: '7px 12px',
  background: '#1B2A4A',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnRemove: React.CSSProperties = {
  padding: '7px 12px',
  background: '#fff',
  color: '#c92b3a',
  border: '1px solid #c92b3a',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const errBox: React.CSSProperties = {
  padding: '6px 10px',
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 4,
  color: '#c92b3a',
  fontSize: 12,
};
