import { describe, it, expect } from 'vitest';
import { parseTextileWeight } from '../weightParser';

describe('Textile Weight Parser', () => {
  it('faithfully preserves user entered decimal strings without modification', () => {
    expect(parseTextileWeight('103.000')).toEqual({ raw: '103.000', kg: 103 });
    expect(parseTextileWeight('314.000')).toEqual({ raw: '314.000', kg: 314 });
    expect(parseTextileWeight('1661.800')).toEqual({ raw: '1661.800', kg: 1661.8 });
    expect(parseTextileWeight('120.15')).toEqual({ raw: '120.15', kg: 120.15 });
    expect(parseTextileWeight('994.4')).toEqual({ raw: '994.4', kg: 994.4 });
  });

  it('correctly parses compound textile weights like "125 KG 500 GMS"', () => {
    const res = parseTextileWeight('125 KG 500 GMS');
    expect(res.raw).toBe('125 KG 500 GMS');
    expect(res.kg).toBe(125.5);

    const res2 = parseTextileWeight('40 kgs 250 gms');
    expect(res2.raw).toBe('40 kgs 250 gms');
    expect(res2.kg).toBe(40.25);
  });

  it('parses grams-only notation', () => {
    const res = parseTextileWeight('500 GMS');
    expect(res.raw).toBe('500 GMS');
    expect(res.kg).toBe(0.5);

    const res2 = parseTextileWeight('750g');
    expect(res2.raw).toBe('750g');
    expect(res2.kg).toBe(0.75);
  });

  it('tolerates numbers with commas and optional unit suffix', () => {
    expect(parseTextileWeight('1,450.500')).toEqual({ raw: '1,450.500', kg: 1450.5 });
    expect(parseTextileWeight('650.400 kg')).toEqual({ raw: '650.400 kg', kg: 650.4 });
  });

  it('handles empty, null, or zero gracefully', () => {
    expect(parseTextileWeight('')).toEqual({ raw: '', kg: 0 });
    expect(parseTextileWeight(null)).toEqual({ raw: '', kg: 0 });
    expect(parseTextileWeight(undefined)).toEqual({ raw: '', kg: 0 });
    expect(parseTextileWeight(0)).toEqual({ raw: '0', kg: 0 });
  });
});
