// Currency display (carried over from the Vault Breakers approval fixes, utils-shared/amount.ts):
// Intl currency with the currency's own decimals, sub-unit amounts up to 6 places, social currencies
// (XGC/XSC/XEC) as a suffix with no "$".
// v3.16i (James): two formatters.
// - money(): balance, bet / PLAY, prices, limits, inputs: always the currency's standard decimals (USD 2, JPY 0, KWD 3:
//   Intl data, the web-sdk passes only the ISO code), normal rounding: $1,001.21, never $1,001.212.
// - moneyWin(): win amounts only (HUD WIN, resume card, TOTAL WIN, FS totals, big / max win and their count-ups, line
//   wins): the exact value (#273): at least the currency decimals, extra places only when nonzero, up to 6 (the RGS
//   integer precision): $1.212, $2.225, $0.0025, $50,400.00.
// Float noise is removed first in both (rounded at 6 places), so 0.1+0.2 shows $0.30.
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
/** Number of decimals `moneyWin()` uses for v in the current currency. */
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
const fmt = (v: number, d: number) => {
	// v3.16f: a no-break space (U+00A0) between amount and code/symbol, so '22.80 GC' never wraps as '22.80 / GC'
	if (currency in SOCIAL) return `${nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v)}\u00a0${SOCIAL[currency]}`;
	try { return nf({ style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/ /g, '\u00a0'); }
	catch { return `${v.toFixed(d)}\u00a0${currency}`; }
};
const clean = (value: number) => Number((Number(value) || 0).toFixed(MAX_DIGITS));
/** Balance, bet / PLAY, prices: the currency's standard decimals, normal rounding (v3.16i). */
export const money = (value: number) => fmt(clean(value), decimalsOf(currency));
/** Win amounts: exact (nonzero places up to 6); `digits` fixes the places (count-ups use the final value's places so the
 *  width holds). */
export const moneyWin = (value: number, digits?: number) => { const v = clean(value); return fmt(v, digits ?? moneyDigits(v)); };
/** Plain number for inputs (no symbol, no grouping): standard decimals, like money() (v3.16i). */
export const amountStr = (v: number) => clean(v).toFixed(decimalsOf(currency));
export const mult = (x: number) => `${nf({ maximumFractionDigits: 2 }).format(x)}x`;
