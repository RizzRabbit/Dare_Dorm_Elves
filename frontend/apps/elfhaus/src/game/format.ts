// Currency display (carried over from the Vault Breakers approval fixes, utils-shared/amount.ts):
// Intl currency with the currency's own decimals, sub-unit amounts up to 6 places, social currencies
// (XGC/XSC/XEC) as a suffix with no "$".
// Decimals rule: the currency's own decimals by default (USD 2, JPY 0, KWD 3: Intl data, the web-sdk passes only the
// ISO code). More places only for amounts below one unit whose value really has significance past the default
// ($0.0025 -> 4, $0.025 -> 3), trailing zeros trimmed back to the default; anything >= 1 unit is rounded to the
// default ($1,234.5678 -> $1,234.57). Float noise is removed first (rounded at 6 places), so 0.1+0.2 shows $0.30.
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
	if (t >= 1 || t === 0) return base;
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
/** v3.16f: an amount at the currency's own decimals, normal (half-up) rounding: the resume card's win, which can come
 *  from an off-level stake ($0.975 -> $0.98, $0.5625 -> $0.56). Float noise is removed first, like moneyDigits(). */
export const moneyStd = (value: number) => money(Number((Number(value) || 0).toFixed(MAX_DIGITS)), decimalsOf(currency));
/** Plain number for inputs (no symbol, no grouping), same decimals rule as money(). */
export const amountStr = (v: number) => (Number(v) || 0).toFixed(moneyDigits(v));
export const mult = (x: number) => `${nf({ maximumFractionDigits: 2 }).format(x)}x`;
