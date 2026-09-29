/**
 * Specialized Textile Weight Parser
 * Preserves Dad's exact entered string while extracting high-precision normalized kilograms.
 */

export interface ParsedWeight {
  raw: string;
  kg: number;
}

export function parseTextileWeight(input: string | number | undefined | null): ParsedWeight {
  if (input === undefined || input === null) {
    return { raw: '', kg: 0 };
  }

  if (typeof input === 'number') {
    return {
      raw: input.toString(),
      kg: isNaN(input) ? 0 : input,
    };
  }

  const raw = input.trim();
  if (!raw) {
    return { raw: '', kg: 0 };
  }

  // 1. Check for compound patterns like "125 KG 500 GMS", "125kgs 500g", "125 kg 500 grams"
  const compoundRegex = /^(?:(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kg))\s*(?:and\s*)?(?:(\d+(?:\.\d+)?)\s*(?:gms?|grams?|g))?$/i;
  const compoundMatch = raw.match(compoundRegex);
  if (compoundMatch) {
    const kgs = parseFloat(compoundMatch[1]) || 0;
    const gms = compoundMatch[2] ? parseFloat(compoundMatch[2]) || 0 : 0;
    const totalKg = Math.round((kgs + gms / 1000) * 1000) / 1000;
    return { raw, kg: totalKg };
  }

  // 2. Check for grams-only pattern like "500 GMS", "750g"
  const gramsRegex = /^(\d+(?:\.\d+)?)\s*(?:gms?|grams?|g)$/i;
  const gramsMatch = raw.match(gramsRegex);
  if (gramsMatch) {
    const gms = parseFloat(gramsMatch[1]) || 0;
    const totalKg = Math.round((gms / 1000) * 1000) / 1000;
    return { raw, kg: totalKg };
  }

  // 3. Check for standard numeric string, optionally with commas: "1,661.800", "103.000", "994.4"
  // Also tolerate a trailing "kg" or "kgs": "103.000 kg"
  const sanitized = raw.replace(/,/g, '').replace(/\s*(?:kgs?|kilos?)$/i, '').trim();
  const parsedFloat = parseFloat(sanitized);

  if (!isNaN(parsedFloat) && isFinite(parsedFloat)) {
    return { raw, kg: parsedFloat };
  }

  // Fallback for non-standard input
  return { raw, kg: 0 };
}
