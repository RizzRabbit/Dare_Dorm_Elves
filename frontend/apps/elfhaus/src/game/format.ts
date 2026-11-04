// Currency display (carried over from the Vault Breakers approval fixes, utils-shared/amount.ts):
// Stake currency table (symbol, decimals, placement), Intl grouping, with the currency's own decimals, sub-unit amounts up to 6 places, social currencies
// (XGC/XSC/XEC) as a suffix with no "$".
// v3.16i (James): two formatters.
// - money(): balance, bet / PLAY, prices, limits, inputs: always the currency's standard decimals (USD 2, JPY 0, KWD 3:
//   Intl data, the web-sdk passes only the ISO code), normal rounding: $1,001.21, never $1,001.212.
// - moneyWin(): win amounts only (HUD WIN, resume card, TOTAL WIN, FS totals, big / max win and their count-ups, line
//   wins): the exact value (#273): at least the currency decimals, extra places only when nonzero, up to 6 (the RGS
//   integer precision): $1.212, $2.225, $0.0025, $50,400.00.
// Float noise is removed first in both (rounded at 6 places), so 0.1+0.2 shows $0.30.
// Stake Engine currency table (the web-sdk / docs CurrencyMeta: symbol, default decimals, placement), so every currency
// the RGS can send shows its own symbol: $ / € / ₹ / R$ / MX$ before, kr / zł / ₫ / CLP after (with a no-break space).
// A code not in the table shows the code after the amount ('12.50 XYZ'), as the Stake docs do.
type Meta = { s: string; d: number; a?: true };
const META: Record<string, Meta> = {
	USD: { s: '$', d: 2 }, CAD: { s: 'CA$', d: 2 }, JPY: { s: '¥', d: 0 }, EUR: { s: '€', d: 2 }, RUB: { s: '₽', d: 2 }, CNY: { s: 'CN¥', d: 2 },
	PHP: { s: '₱', d: 2 }, INR: { s: '₹', d: 2 }, IDR: { s: 'Rp', d: 0 }, KRW: { s: '₩', d: 0 }, BRL: { s: 'R$', d: 2 }, MXN: { s: 'MX$', d: 2 },
	DKK: { s: 'kr', d: 2, a: true }, PLN: { s: 'zł', d: 2, a: true }, VND: { s: '₫', d: 0, a: true }, TRY: { s: '₺', d: 2 }, CLP: { s: 'CLP', d: 0, a: true },
	ARS: { s: 'ARS', d: 2, a: true }, PEN: { s: 'S/', d: 2 }, NGN: { s: '₦', d: 2 }, SAR: { s: 'SAR', d: 2, a: true }, ILS: { s: '₪', d: 2 },
	AED: { s: 'AED', d: 2, a: true }, TWD: { s: 'NT$', d: 2 }, NOK: { s: 'kr', d: 2, a: true }, KWD: { s: 'KD', d: 3 }, JOD: { s: 'JD', d: 3 },
	CRC: { s: '₡', d: 2 }, TND: { s: 'TND', d: 3, a: true }, SGD: { s: 'SG$', d: 2 }, MYR: { s: 'RM', d: 2 }, OMR: { s: 'OMR', d: 3, a: true },
	QAR: { s: 'QAR', d: 2, a: true }, BHD: { s: 'BD', d: 3 }, PKR: { s: '₨', d: 2 }, EGP: { s: 'EGP', d: 2, a: true }, NZD: { s: 'NZ$', d: 2 },
	BOB: { s: 'Bs', d: 2 }, GHS: { s: 'GH₵', d: 2 }, KES: { s: 'KSh', d: 2 }, MAD: { s: 'MAD', d: 2, a: true }, BAM: { s: 'KM', d: 2 },
	ISK: { s: 'kr', d: 0, a: true }, TZS: { s: 'TSh', d: 2 }, UGX: { s: 'USh', d: 0 }, XOF: { s: 'CFA', d: 0, a: true },
	// not in the Stake table but common operator currencies (James's list)
	GBP: { s: '£', d: 2 }, AUD: { s: 'A$', d: 2 }, HKD: { s: 'HK$', d: 2 }, ZAR: { s: 'R', d: 2 }, CHF: { s: 'CHF', d: 2, a: true },
	SEK: { s: 'kr', d: 2, a: true }, CZK: { s: 'Kč', d: 2, a: true }, HUF: { s: 'Ft', d: 0, a: true }, UAH: { s: '₴', d: 2 }, KZT: { s: '₸', d: 2 },
	THB: { s: '฿', d: 2 },
	// social / sweeps
	XGC: { s: 'GC', d: 2, a: true }, XSC: { s: 'SC', d: 2, a: true }, XEC: { s: 'SC', d: 2, a: true },
};
const SOCIAL: Record<string, string> = { XGC: 'GC', XSC: 'SC', XEC: 'SC' };
/** Currencies with a set symbol (tests / verification). */
export const CURRENCIES = Object.keys(META);
const MAX_DIGITS = 6;
let currency = 'USD';
let locale = 'en';
export const setCurrency = (c: string) => (currency = (c || 'USD').toUpperCase());
export const setLocale = (l: string) => (locale = l || 'en');
export const isSocialCurrency = () => currency in SOCIAL;
const decCache = new Map<string, number>();
const decimalsOf = (c: string) => {
	if (META[c]) return META[c].d;
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
	const m = META[currency], n = nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v)), neg = v < 0 && Number(n.replace(/[^0-9]/g, '')) > 0 ? '-' : '';
	if (!m) return `${neg}${n}\u00a0${currency}`;   // unknown code: '12.50 XYZ'
	return m.a ? `${neg}${n}\u00a0${m.s}` : `${neg}${m.s}${n}`;
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
