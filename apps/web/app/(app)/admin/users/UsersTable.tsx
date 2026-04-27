'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'consultant' | 'admin' | 'super_admin';
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
};

const ROLES: User['role'][] = ['consultant', 'admin', 'super_admin'];

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, newRole: User['role']) {
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Błąd.');
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  if (users.length === 0) {
    return <p style={{ color: '#6b7a92', fontSize: 14 }}>Brak użytkowników.</p>;
  }

  return (
    <>
      {error && <div style={errorBox}>{error}</div>}
      <table style={table}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e4e9f2' }}>
            <th style={th}>Email</th>
            <th style={th}>Imię</th>
            <th style={th}>Rola</th>
            <th style={th}>Utworzony</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isMe = u.id === currentUserId;
            return (
              <tr key={u.id}>
                <td style={td}>
                  {u.email}
                  {isMe && <span style={meBadge}>(Ty)</span>}
                </td>
                <td style={tdMuted}>{u.full_name ?? '—'}</td>
                <td style={td}>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as User['role'])}
                    disabled={updating === u.id}
                    style={select}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tdMuted}>
                  {new Date(u.created_at).toLocaleDateString('pl-PL')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={hint}>
        Zmiana roli powoduje wylogowanie wszystkich aktywnych sesji tego usera (sekcja 7.5
        spec). Po zalogowaniu nowy JWT będzie zawierał aktualną rolę.
      </p>
    </>
  );
}

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 0',
  fontSize: 12,
  color: '#6b7a92',
  textTransform: 'uppercase',
  letterSpacing: 1,
};
const td: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid #eef1f7' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
const select: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 13,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  fontFamily: 'inherit',
};
const meBadge: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 11,
  color: '#c92b3a',
  fontWeight: 600,
};
const hint: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7a92',
  marginTop: 12,
  lineHeight: 1.4,
};
const errorBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 4,
  color: '#c92b3a',
  fontSize: 13,
  marginBottom: 12,
};
