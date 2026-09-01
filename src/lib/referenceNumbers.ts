export const DEFAULT_REFERENCE_DESCRIPTIONS: Record<string, string> = {
  '04_104_0125_6_1': 'Assistance with Personal Activities',
  '04_102_0125_6_1': 'Personal Care Support',
  '04_104_0115_6_1': 'Assistance with Personal Activities (High)',
  '04_210_0125_6_1': 'Assistance with Personal Activities — Standard — Weeknight',
  '04_104_0125_6_3': 'Assistance with Personal Activities — Standard — Saturday',
  '04_104_0125_6_4': 'Assistance with Personal Activities — Standard — Sunday',
  '04_104_0125_6_5': 'Assistance with Personal Activities — Standard — Public Holiday',
  '04_103_0125_6_1': 'Assistance with Personal Activities — High — Weekday',
  '04_399_0125_6_1': 'House and/or Yard Maintenance',
  '01_011_0107_1_3': 'Daily Activities — Standard — Saturday',
  '04_104_0125_6_2': 'Assistance with Personal Activities — Evening',
  '04_210_0125_6_3': 'Assistance with Personal Activities — Evening — Saturday',
};

export interface ReferencePreset {
  reference_number: string;
  reference_description: string;
}

export function descriptionForReference(
  referenceNumber: string | null | undefined,
  customDescription?: string | null,
  fallback?: string | null,
): string {
  if (customDescription?.trim()) return customDescription.trim();
  if (referenceNumber && DEFAULT_REFERENCE_DESCRIPTIONS[referenceNumber]) {
    return DEFAULT_REFERENCE_DESCRIPTIONS[referenceNumber];
  }
  return fallback?.trim() ?? '';
}

function addPreset(map: Map<string, ReferencePreset>, number?: string | null, description?: string | null) {
  const num = (number ?? '').trim();
  const desc = (description ?? '').trim();
  if (!num && !desc) return;
  const key = `${num}|${desc}`;
  if (!map.has(key)) {
    map.set(key, { reference_number: num, reference_description: desc });
  }
}

export function collectReferencePresets(sources: {
  clientRef?: string | null;
  clientDescription?: string | null;
  rates?: { reference_number?: string | null; reference_description?: string | null }[];
  fixedShifts?: { reference_number?: string | null; reference_description?: string | null }[];
  invoiceShifts?: { reference_number?: string | null; reference_description?: string | null }[];
}): ReferencePreset[] {
  const map = new Map<string, ReferencePreset>();
  addPreset(map, sources.clientRef, sources.clientDescription);
  sources.rates?.forEach(r => addPreset(map, r.reference_number, r.reference_description));
  sources.fixedShifts?.forEach(s => addPreset(map, s.reference_number, s.reference_description));
  sources.invoiceShifts?.forEach(s => addPreset(map, s.reference_number, s.reference_description));
  return [...map.values()];
}
