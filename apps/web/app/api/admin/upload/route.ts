/**
 * POST /api/admin/upload — multipart/form-data file upload do Supabase Storage.
 *
 * Fields:
 *   file   — plik (max 5MB, image/jpeg|png|webp)
 *   folder — 'case-studies' | 'contact-persons' | 'programs'
 *
 * Response: { data: { storage_key: string, public_url: string } }
 *
 * SVG celowo NIEDOZWOLONE — przegladarki wykonują <script> w SVG serwowanym
 * top-level (storage.supabase.co), co tworzy XSS surface przy admin-compromise.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FOLDERS = ['case-studies', 'contact-persons', 'programs'] as const;
type Folder = (typeof ALLOWED_FOLDERS)[number];

const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder');

    if (!file || !(file instanceof File)) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pliku w żądaniu.', 422);
    }
    if (!folder || !ALLOWED_FOLDERS.includes(folder as Folder)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        `Niepoprawny folder. Dozwolone: ${ALLOWED_FOLDERS.join(', ')}.`,
        422,
      );
    }

    const mime = file.type;
    const ext = ALLOWED_MIMES[mime];
    if (!ext) {
      throw new ApiError(
        'VALIDATION_ERROR',
        `Niedozwolony typ pliku: ${mime}. Dozwolone: jpeg, png, webp, svg.`,
        415,
      );
    }

    if (file.size > MAX_SIZE) {
      throw new ApiError(
        'VALIDATION_ERROR',
        `Plik za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum: 5 MB.`,
        413,
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const storageKey = `${folder}/${randomUUID()}.${ext}`;

    const sb = createAdminClient();
    const { error } = await sb.storage
      .from('public-uploads')
      .upload(storageKey, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      throw new ApiError('INTERNAL_ERROR', `Błąd storage: ${error.message}`, 500);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/public-uploads/${storageKey}`;

    return NextResponse.json({ data: { storage_key: storageKey, public_url: publicUrl } });
  } catch (e) {
    return handleError(e);
  }
}
