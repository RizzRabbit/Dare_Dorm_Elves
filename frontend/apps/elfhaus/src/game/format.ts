// Currency display (carried over from the Vault Breakers approval fixes, utils-shared/amount.ts):
// Intl currency with the currency's own decimals, sub-unit amounts up to 6 places, social currencies
// (XGC/XSC/XEC) as a suffix with no "$".
// Decimals rule (v3.16h, #273): the exact value at every magnitude. At least the currency's own decimals (USD 2, JPY 0,
// KWD 3: Intl data, the web-sdk passes only the ISO code); extra places only when they are nonzero, up to 6 (the RGS
// integer precision): $1.212, $2.225, $1,234.5675, $50,400.00, $0.0025. Float noise is removed first (rounded at 6
// places), then trailing zeros are trimmed back to the currency minimum, so 0.1+0.2 shows $0.30.
const SOCIAL: Record<string, string> = { XGC: 'GC', XSC: 'SC', XEC: 'SC' };
const MAX_DIGITS = 6;
let currency = 'USD';
let locale = 'en';
export const setCurrency = (c: string) => (currency = (c || 'USD').toUpperCase());
export const setLocale = (l: string) => (locale = l || 'en');
export const getCurrency = () => currency;
export const isSocialCurrency = () => currency in SOCIAL;
const decCache = new Map<string, number>();
const decimalsOf = (c: string) => {
	if (c in SOCIAL) return 2;
	let d = decCache.get(c);
	if (d === undefined) { try { d = new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits ?? 2; } catch { d = 2; } decCache.set(c, d); }
	return d;
};
/** Number of decimals `money()` uses for v in the current currency. */
export const moneyDigits = (value: number) => {
	const base = decimalsOf(currency), t = Number(Math.abs(Number(value) || 0).toFixed(MAX_DIGITS));
	if (t === 0) return base; // v3.16h (#273): amounts >= 1 unit keep their nonzero places too (no rounding to the currency decimals)
	for (let d = base; d <= MAX_DIGITS; d++) if (Number(t.toFixed(d)) === t) return d;
	return MAX_DIGITS;
};
// formatters are cached (count-ups format every frame; building an Intl.NumberFormat is expensive)
const nfCache = new Map<string, Intl.NumberFormat>();
const nf = (o: Intl.NumberFormatOptions) => {
	const key = locale + JSON.stringify(o); let f = nfCache.get(key);
	if (!f) { try { f = new Intl.NumberFormat(locale, o); } catch { f = new Intl.NumberFormat('en', o); } nfCache.set(key, f); }
	return f;
};
/** Format an amount; `digits` forces a fixed number of places (count-ups use the final value's places so the width holds). */
export const money = (value: number, digits?: number) => {
	const v = Number(value) || 0, d = digits ?? moneyDigits(v);
	// v3.16f: a no-break space (U+00A0) between amount and code/symbol, so '22.80 GC' never wraps as '22.80 / GC'
	if (currency in SOCIAL) return `${nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v)}\u00a0${SOCIAL[currency]}`;
	try { return nf({ style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/ /g, '\u00a0'); }
	catch { return `${v.toFixed(d)}\u00a0${currency}`; }
};
/** Plain number for inputs (no symbol, no grouping), same decimals rule as money(). */
export const amountStr = (v: number) => (Number(v) || 0).toFixed(moneyDigits(v));
export const mult = (x: number) => `${nf({ maximumFractionDigits: 2 }).format(x)}x`;
