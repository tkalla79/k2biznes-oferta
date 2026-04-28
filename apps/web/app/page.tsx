import { redirect } from 'next/navigation';

/**
 * Root `/` przekierowuje na signin. Faktyczne strony wejściowe to:
 * - `/auth/signin` — dla konsultantów/adminów
 * - `/o/<token>` — dla klientów (link z maila)
 *
 * Po zalogowaniu middleware kieruje admin/super_admin na /admin (a stamtąd
 * konsultanci klikają w listę ofert).
 */
export default function Home() {
  redirect('/auth/signin');
}
