import { describe, it, expect } from 'vitest';
import { extractTemplate, applyTemplate, TEMPLATE_FIELDS } from './template';

// Mock FormState — pola klienta + szablonowe.
const mockForm = {
  clientName: 'Aqustec',
  clientNip: '1234567890',
  clientIndustry: 'produkcja',
  clientCompanySize: 'small',
  clientVoivodeship: 'opolskie',
  projectValue: 4_000_000,
  fundingRate: 0.65,
  returningClient: true,
  projectCount: 2,
  programId: 'feng-smart',
  programLabel: 'FENG · Ścieżka SMART',
  programCustomName: '',
  offeredVariants: ['I', 'II', 'III'],
  selectedVariant: 'II',
  caseStudyId: 'cs-1',
  contactPersonId: 'cp-1',
  contentIntro: 'Wprowadzenie...',
  contentFooter: 'Stopka...',
  programDescription: '<p>opis</p>',
  altPrograms: [{ name: 'X', program: 'Y', nabor: '', desc: '', url: '' }],
  assignedConsultantId: 'u-1',
  pricingMode: 'manual',
  overrides: {},
  execFee: {},
};

const blank = {
  clientName: '',
  clientNip: '',
  clientIndustry: '',
  clientCompanySize: '',
  clientVoivodeship: '',
  projectValue: 3_000_000,
  fundingRate: 0.7,
  returningClient: false,
  projectCount: 1,
  programId: '',
  programLabel: '',
  programCustomName: '',
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
  overrides: {},
  execFee: {},
};

describe('extractTemplate', () => {
  it('pomija pola klienta', () => {
    const t = extractTemplate(mockForm);
    for (const k of [
      'clientName',
      'clientNip',
      'clientIndustry',
      'clientCompanySize',
      'clientVoivodeship',
      'projectValue',
      'fundingRate',
      'returningClient',
      'projectCount',
    ]) {
      expect(t).not.toHaveProperty(k);
    }
  });

  it('zachowuje pola szablonowe', () => {
    const t = extractTemplate(mockForm);
    expect(t.programLabel).toBe('FENG · Ścieżka SMART');
    expect(t.contentIntro).toBe('Wprowadzenie...');
    expect(t.selectedVariant).toBe('II');
    expect(t.altPrograms).toHaveLength(1);
  });

  it('TEMPLATE_FIELDS nie zawiera żadnego pola klienta', () => {
    const clientFields = ['clientName', 'projectValue', 'fundingRate', 'returningClient'];
    for (const cf of clientFields) {
      expect(TEMPLATE_FIELDS as readonly string[]).not.toContain(cf);
    }
  });
});

describe('applyTemplate', () => {
  it('nakłada szablon na blank, pola klienta zostają puste', () => {
    const t = extractTemplate(mockForm);
    const form = applyTemplate(blank, t);
    expect(form.programLabel).toBe('FENG · Ścieżka SMART');
    expect(form.selectedVariant).toBe('II');
    expect(form.clientName).toBe(''); // klient NIE z szablonu
    expect(form.projectValue).toBe(3_000_000); // domyślne blank, nie z mockForm
  });

  it('round-trip extract→apply odtwarza pola szablonowe', () => {
    const form = applyTemplate(blank, extractTemplate(mockForm));
    for (const k of TEMPLATE_FIELDS) {
      expect(form[k]).toEqual(mockForm[k as keyof typeof mockForm]);
    }
  });

  it('ignoruje nieznane klucze w template_data (odporność)', () => {
    const form = applyTemplate(blank, { programLabel: 'X', __obce: 'hack' } as Record<string, unknown>);
    expect(form.programLabel).toBe('X');
    expect(form).not.toHaveProperty('__obce');
  });
});
