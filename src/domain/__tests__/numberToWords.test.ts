import { describe, it, expect } from 'vitest';
import { numberToIndianWords } from '../numberToWords';

describe('Indian Currency Number to Words', () => {
  it('converts zero', () => {
    expect(numberToIndianWords(0)).toBe('Rupees Zero Only');
  });

  it('converts simple amounts', () => {
    expect(numberToIndianWords(50)).toBe('Rupees Fifty Only');
    expect(numberToIndianWords(121)).toBe('Rupees One Hundred Twenty One Only');
    expect(numberToIndianWords(780)).toBe('Rupees Seven Hundred Eighty Only');
  });

  it('converts thousands and lakhs correctly', () => {
    expect(numberToIndianWords(1000)).toBe('Rupees One Thousand Only');
    expect(numberToIndianWords(15400)).toBe('Rupees Fifteen Thousand Four Hundred Only');
    expect(numberToIndianWords(100000)).toBe('Rupees One Lakh Only');
    expect(numberToIndianWords(149625)).toBe('Rupees One Lakh Forty Nine Thousand Six Hundred Twenty Five Only');
    expect(numberToIndianWords(264044)).toBe('Rupees Two Lakh Sixty Four Thousand Forty Four Only');
  });

  it('converts crores correctly', () => {
    expect(numberToIndianWords(10000000)).toBe('Rupees One Crore Only');
    expect(numberToIndianWords(20500000)).toBe('Rupees Two Crore Five Lakh Only');
  });

  it('handles paise if present', () => {
    expect(numberToIndianWords(121.50)).toBe('Rupees One Hundred Twenty One and Fifty Paise Only');
    expect(numberToIndianWords(0.75)).toBe('Rupees Zero and Seventy Five Paise Only');
  });
});
