/**
 * Pure helpers for the Formal Quotation & Estimation Report.
 * Kept free of React so the money math and document identity are testable.
 */

/** Indian/Nepali numbering helpers: 1 = One, 21 = Twenty One, 105 = One Hundred Five. */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');

const threeDigits = (n: number): string => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
};

/**
 * Integer → words in the Nepali/Indian crore/lakh/thousand system.
 * Supports up to crores (e.g. 1234567 → "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven").
 */
export const numberToWordsIndian = (value: number): string => {
  let n = Math.floor(Math.abs(value));
  if (!Number.isFinite(n)) return 'Zero';
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${numberToWordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
};

const CURRENCY_WORDS: Record<string, string> = {
  NPR: 'Nepalese Rupees',
  INR: 'Indian Rupees',
  USD: 'US Dollars',
  EUR: 'Euros',
  GBP: 'Pounds Sterling',
  AUD: 'Australian Dollars',
  CAD: 'Canadian Dollars'
};

/**
 * Grand total in words, e.g.
 * amountInWords(1234567.89, 'NPR')
 *   → "Nepalese Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and 89/100 Only"
 */
export const amountInWords = (amount: number, currency = 'NPR'): string => {
  const cur = (currency || 'NPR').trim().toUpperCase();
  const label = CURRENCY_WORDS[cur] || cur;
  const abs = Math.abs(amount) || 0;
  let rupees = Math.floor(abs);
  let paisa = Math.round((abs - rupees) * 100);
  if (paisa === 100) { rupees += 1; paisa = 0; }
  const body = numberToWordsIndian(rupees) || 'Zero';
  const tail = paisa > 0 ? ` and ${paisa}/100` : '';
  const sign = amount < 0 ? 'Minus ' : '';
  return `${sign}${label} ${body}${tail} Only`;
};

/**
 * Stable document reference for the quotation, derived from the project so
 * re-prints on the same day carry the same number: e.g. PROJ-1-Q-20261013.
 */
export const quotationRef = (project: { id?: string; createdAt?: string }): string => {
  const prefix = (project.id || 'PROJ').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'PROJ';
  const date = (project.createdAt || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `${prefix}-Q-${date}`;
};

/** Standard terms printed on every quotation (project-specific note kept in App). */
export const DEFAULT_QUOTATION_TERMS: string[] = [
  'Rates are firm for the validity period of this quotation and cover labour, scaffolding and site supervision unless expressly excluded in an item description.',
  'Payment schedule: 30% advance with work order, 40% on completion of the structural frame, 25% on completion of finishing works, 5% retention released after 30 days of handover.',
  'Any variation in scope, design or specification will be re-measured at these rates or at mutually agreed rates before execution.',
  'Quantities are derived from the drawings/BOQ provided; measurement sheets are available on request. Taxes (VAT) and contingency are charged as shown in the summary.',
  'Materials: rates assume standard locally available materials conforming to NBC 205 unless an item description states a specific brand or grade.',
  'This quotation is valid for 30 days from the date of issue; thereafter rates are subject to revision.',
  'Disputes, if any, shall be settled amicably between the parties as per prevailing construction contract practice in Nepal.'
];
