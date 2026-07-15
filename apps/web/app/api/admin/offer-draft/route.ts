/**
 * POST /api/admin/offer-draft — wstępne wypełnienie oferty z transkrypcji spotkania.
 *
 * Wejście: wklejony tekst (JSON `{ transcript }`) LUB plik (multipart, pole `file`:
 * .docx parsowany przez mammoth, .txt jako UTF-8). Model Claude Haiku wyciąga pola
 * do szkicu (tool-use / wymuszony schemat). Sugestia programu dopasowywana do
 * biblioteki `alt_programs` (po realnych ID z bazy).
 *
 * RODO: transkryptu ani pliku NIE zapisujemy — parsujemy w pamięci, nic nie trafia
 * do bazy ani do audit_log. Efektem jest wyłącznie draft zwracany do formularza;
 * dane utrwala dopiero świadomy zapis oferty przez konsultanta.
 */
import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { z } from 'zod';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_SIZES, VOIVODESHIPS, buildDraftData } from '@/lib/offers/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 50_000;
const MIN_CHARS = 20;

const SYSTEM_PROMPT = `Jesteś asystentem konsultanta dotacyjnego firmy K2Biznes. Na podstawie transkrypcji spotkania z klientem wyekstrahuj dane do WSTĘPNEGO szkicu oferty doradczej.

ZASADY (bezwzględne):
1. Wyciągaj WYŁĄCZNIE informacje, które jawnie padły w transkrypcie. Nie zgaduj, nie uzupełniaj własną wiedzą, nie dedukuj na siłę.
2. Jeśli czegoś nie ma w transkrypcie — użyj null.
3. projectValue (wartość/zakres inwestycji w PLN) podawaj TYLKO gdy klient wprost wskazał kwotę lub budżet. Zawsze dopisz do "warnings", że kwotę trzeba potwierdzić.
4. recommendationBasis pisz zwięzłą prozą po polsku (1-2 akapity, max 1500 znaków): realnie zdiagnozowane potrzeby/problemy klienta ORAZ merytoryczną podstawę rekomendacji. Tekst ma być gotowy do wklejenia do oferty.
5. Program sugeruj WYŁĄCZNIE z dostarczonej listy biblioteki, wskazując jej ID. Jeśli żaden nie pasuje albo brak podstaw — użyj null i dopisz to do "warnings".
6. W "warnings" (po polsku, krótko) zaznacz: czego nie udało się ustalić, co wymaga weryfikacji, przyjęte założenia.

Odpowiadasz zawsze wywołaniem narzędzia "zapisz_pola_oferty".`;

const TextInput = z.object({ transcript: z.string() });

function buildTool(libIds: string[]): Anthropic.Tool {
  return {
    name: 'zapisz_pola_oferty',
    description: 'Zapisuje pola wyekstrahowane z transkrypcji do wstępnego szkicu oferty.',
    input_schema: {
      type: 'object',
      properties: {
        clientName: { type: ['string', 'null'], description: 'Pełna nazwa podmiotu/firmy klienta. null jeśli nie padła.' },
        clientNip: { type: ['string', 'null'], description: 'NIP klienta — dokładnie 10 cyfr, bez spacji i myślników. null jeśli nie padł.' },
        clientIndustry: { type: ['string', 'null'], description: 'Branża/sektor klienta w kilku słowach. null jeśli brak.' },
        clientCompanySize: { type: ['string', 'null'], enum: [...COMPANY_SIZES, null], description: 'Wielkość firmy: micro (<10 osób), small (10-49), medium (50-249), large (250+). null jeśli nie wynika jednoznacznie.' },
        clientVoivodeship: { type: ['string', 'null'], enum: [...VOIVODESHIPS, null], description: 'Województwo siedziby klienta (wartość z listy). null jeśli nie padło.' },
        recommendationBasis: { type: ['string', 'null'], description: 'Proza, max 1500 znaków: zdiagnozowane potrzeby klienta + merytoryczna podstawa rekomendacji. null jeśli brak podstaw.' },
        projectValue: { type: ['number', 'null'], description: 'Wartość/zakres inwestycji w PLN jako liczba (bez formatowania). TYLKO gdy padła wprost. null w przeciwnym razie.' },
        suggestedProgramId: { type: ['string', 'null'], enum: [...libIds, null], description: 'ID programu z dostarczonej listy biblioteki, który najlepiej pasuje do potrzeb klienta. null jeśli żaden nie pasuje.' },
        warnings: { type: 'array', items: { type: 'string' }, description: 'Krótkie ostrzeżenia po polsku. Pusta lista jeśli brak.' },
      },
      required: ['warnings'],
    } as Anthropic.Tool.InputSchema,
  };
}

/** Wyciąga czysty tekst z wejścia: multipart (plik .docx/.txt) lub JSON `{ transcript }`. */
async function readTranscript(req: NextRequest): Promise<string> {
  const ctype = req.headers.get('content-type') ?? '';

  if (ctype.includes('multipart/form-data')) {
    const fd = await req.formData();
    const pasted = fd.get('transcript');
    if (typeof pasted === 'string' && pasted.trim()) return pasted;

    const file = fd.get('file');
    if (!(file instanceof File)) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pliku ani tekstu transkrypcji.', 422);
    }
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (name.endsWith('.docx')) {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    if (name.endsWith('.txt')) {
      return buffer.toString('utf8');
    }
    throw new ApiError('VALIDATION_ERROR', 'Obsługiwane formaty pliku: .docx, .txt. PDF wklej jako tekst.', 422);
  }

  const body = TextInput.parse(await req.json());
  return body.transcript;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ApiError(
        'SERVICE_UNAVAILABLE',
        'Funkcja wypełniania z transkrypcji jest niedostępna: brak ANTHROPIC_API_KEY w konfiguracji środowiska.',
        503,
      );
    }

    let transcript = (await readTranscript(req)).trim();
    if (transcript.length < MIN_CHARS) {
      throw new ApiError('VALIDATION_ERROR', 'Transkrypcja jest zbyt krótka do analizy.', 422);
    }

    const serverWarnings: string[] = [];
    if (transcript.length > MAX_CHARS) {
      transcript = transcript.slice(0, MAX_CHARS);
      serverWarnings.push('Transkrypcja była bardzo długa — przeanalizowano tylko początkowy fragment.');
    }

    // Biblioteka programów — realne ID z bazy (model dopasowuje wyłącznie do nich).
    const sb = createAdminClient();
    const { data: lib, error: libErr } = await sb
      .from('alt_programs')
      .select('id, name, program, nabor, desc')
      .eq('is_active', true)
      .order('display_order')
      .order('name');
    if (libErr) throw new ApiError('INTERNAL_ERROR', libErr.message, 500);
    const library = lib ?? [];
    const libIds = library.map((p) => p.id);

    const libraryBlock = library.length
      ? library
          .map((p) => `- ID: ${p.id} | ${p.name}${p.program ? ` | program: ${p.program}` : ''}${p.nabor ? ` | nabór: ${p.nabor}` : ''}${p.desc ? ` | opis: ${String(p.desc).slice(0, 160)}` : ''}`)
          .join('\n')
      : '(biblioteka pusta — suggestedProgramId zawsze null)';

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [buildTool(libIds)],
      tool_choice: { type: 'tool', name: 'zapisz_pola_oferty' },
      messages: [
        {
          role: 'user',
          content: `Biblioteka programów wsparcia (dopasuj po ID):\n${libraryBlock}\n\nTranskrypcja spotkania:\n"""\n${transcript}\n"""`,
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      throw new ApiError('INTERNAL_ERROR', 'Model nie zwrócił ustrukturyzowanej odpowiedzi.', 502);
    }
    const raw = toolUse.input as Record<string, unknown>;
    const data = buildDraftData(raw, library, serverWarnings);
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}
