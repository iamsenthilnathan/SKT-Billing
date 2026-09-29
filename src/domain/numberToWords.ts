/**
 * Converts numbers to formal Indian Currency words (Lakhs, Crores, Thousands, Hundreds).
 * Standard accounting format for Indian business invoices.
 */

const ONES: readonly string[] = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS: readonly string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertTwoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? ' ' + ONES[one] : '');
}

function convertThreeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = '';
  if (hundred > 0) {
    str += ONES[hundred] + ' Hundred';
  }
  if (rest > 0) {
    str += (str ? ' ' : '') + convertTwoDigits(rest);
  }
  return str;
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'Rupees Zero Only';
  }

  // Handle negative amounts if any
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let result = '';

  if (rupees === 0) {
    result = 'Zero';
  } else {
    // Indian numbering format:
    // Split into: Crores (> 1,00,00,000), Lakhs (1,00,000 to 99,99,999),
    // Thousands (1,000 to 99,999), and Hundreds/Tens (1 to 999)
    const crores = Math.floor(rupees / 10000000);
    let remainder = rupees % 10000000;

    const lakhs = Math.floor(remainder / 100000);
    remainder = remainder % 100000;

    const thousands = Math.floor(remainder / 1000);
    remainder = remainder % 1000;

    const parts: string[] = [];

    if (crores > 0) {
      parts.push(convertThreeDigits(crores) + ' Crore');
    }
    if (lakhs > 0) {
      parts.push(convertTwoDigits(lakhs) + ' Lakh');
    }
    if (thousands > 0) {
      parts.push(convertTwoDigits(thousands) + ' Thousand');
    }
    if (remainder > 0) {
      parts.push(convertThreeDigits(remainder));
    }

    result = parts.join(' ');
  }

  let finalWords = (isNegative ? 'Minus ' : '') + 'Rupees ' + result;

  if (paise > 0) {
    finalWords += ' and ' + convertTwoDigits(paise) + ' Paise';
  }

  return finalWords.trim() + ' Only';
}
