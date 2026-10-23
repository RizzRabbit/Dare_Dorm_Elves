// Currency display (carried over from the Vault Breakers approval fixes, utils-shared/amount.ts):
// Intl currency with the currency's own decimals, sub-unit amounts up to 6 places, social currencies
// (XGC/XSC/XEC) as a suffix with no "$".
const SOCIAL: Record<string, string> = { XGC: 'GC', XSC: 'SC', XEC: 'SC' };
const MAX_DIGITS = 6;
let currency = 'USD';
let locale = 'en';
export const setCurrency = (c: string) => (currency = (c || 'USD').toUpperCase());
export const setLocale = (l: string) => (locale = l || 'en');
export const getCurrency = () => currency;
export const isSocialCurrency = () => currency in SOCIAL;
const decimalsOf = (c: string) => {
	try { return new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; }
};
const digitsFor = (v: number, base: number) => {
	const t = Number(Math.abs(v).toFixed(MAX_DIGITS));
	for (let d = base; d <= MAX_DIGITS; d++) if (Number(t.toFixed(d)) === t) return d;
	return MAX_DIGITS;
};
const nf = (o: Intl.NumberFormatOptions) => { try { return new Intl.NumberFormat(locale, o); } catch { return new Intl.NumberFormat('en', o); } };
export const money = (value: number) => {
	const v = Number(value) || 0;
	if (currency in SOCIAL) return `${nf({ minimumFractionDigits: 2, maximumFractionDigits: digitsFor(v, 2) }).format(v)} ${SOCIAL[currency]}`;
	const base = decimalsOf(currency);
	try { return nf({ style: 'currency', currency, minimumFractionDigits: base, maximumFractionDigits: digitsFor(v, base) }).format(v); }
	catch { return `${v.toFixed(base)} ${currency}`; }
};
export const mult = (x: number) => `${nf({ maximumFractionDigits: 2 }).format(x)}x`;
