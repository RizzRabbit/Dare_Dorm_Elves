// Offline mock RGS for development, testing, and fixture playback (?mock=true or local dev).
// Supports ?book=<name> to play a specific fixture book from src/mock/books/*.json.
import type { BookEvent } from '../game/typesBookEvent';
import { MODES } from '../game/config';

// Mode price multipliers come from the math index (modes.generated.json): ante 3x as of math 6a1be1b.
export const mockModeCost = (mode?: string) => (mode && (MODES as any)[mode]?.cost) || 1;

export interface MockBook {
	id: string;
	mode: string;
	payoutMultiplier: number;
	events: BookEvent[];
}

const bookModules = import.meta.glob('./books/*.json', { eager: true }) as Record<string, any>;
const books: Record<string, MockBook> = {};

for (const [path, mod] of Object.entries(bookModules)) {
	const filename = path.split('/').pop()?.replace('.json', '');
	if (filename) {
		const data = mod.default || mod;
		books[filename] = data;
	}
}

export const AVAILABLE_BOOKS = Object.keys(books);

let mockBalance = 10000000; // 100,000.00
let mockCurrency = 'USD';

export function setMockBalance(amount: number) {
	mockBalance = amount;
}

export function setMockCurrency(currency: string) {
	mockCurrency = currency;
}

export function getMockBook(name: string): MockBook | undefined {
	return books[name];
}

const MODE_DEFAULTS: Record<string, string[]> = {
	base: ['base_win', 'base_respin', 'base_zero', 'base_wincap'],
	ante: ['ante_win', 'ante_trigger'],
	dare: ['dare_buy'],
	double_dare: ['double_buy'],
	triple_dare: ['triple_buy'],
	mystery: ['mystery_double', 'mystery_none', 'mystery_triple', 'mystery_hidden'],
	egw: ['egw_adjacent', 'egw_nonadjacent', 'egw_wincap'],
};

const modeCounters: Record<string, number> = {};

export async function mockAuthenticate(params: { language?: string; currency?: string }) {
	if (params.currency) {
		mockCurrency = params.currency;
	}
	return {
		balance: {
			amount: mockBalance,
			currency: mockCurrency,
		},
		config: {
			minBet: 20,
			maxBet: 10000,
			betLevels: [20, 50, 100, 200, 500, 1000, 2000, 5000],
			defaultBetLevel: 100,
			jurisdiction: {},
		},
		round: null,
	};
}

export async function mockBet(params: { currency: string; amount: number; mode: string; forcedBook?: string }) {
	const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
	const bookName = params.forcedBook || q?.get('book');

	let book: MockBook | undefined;
	if (bookName && books[bookName]) {
		book = books[bookName];
	} else {
		const list = MODE_DEFAULTS[params.mode] || ['base_win'];
		const idx = (modeCounters[params.mode] ?? 0) % list.length;
		modeCounters[params.mode] = idx + 1;
		book = books[list[idx]];
	}

	if (!book) {
		book = books[Object.keys(books)[0]];
	}

	// payoutMultiplier is in 100x units (cents of x bet)
	const winAmount = ((book.payoutMultiplier ?? 0) / 100) * params.amount;
	mockBalance += winAmount - params.amount * mockModeCost(params.mode);

	return {
		balance: {
			amount: mockBalance,
			currency: mockCurrency,
		},
		round: {
			id: book.id || 'mock_round',
			mode: book.mode || params.mode,
			amount: params.amount,
			payoutMultiplier: book.payoutMultiplier,
			payout: winAmount,
			state: book.events,
			active: false,
		},
	};
}

export async function mockEndRound(_params: any) {
	return {
		balance: {
			amount: mockBalance,
			currency: mockCurrency,
		},
	};
}

export async function mockReplay(params: { mode?: string; event?: string; forcedBook?: string }) {
	const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
	const bookName = params.forcedBook || params.event || q?.get('book');
	let book: MockBook | undefined;
	if (bookName && books[bookName]) {
		book = books[bookName];
	} else if (params.mode && MODE_DEFAULTS[params.mode]) {
		book = books[MODE_DEFAULTS[params.mode][0]];
	} else {
		book = books['base_win'] || books[Object.keys(books)[0]];
	}

	return {
		state: book?.events || [],
		costMultiplier: mockModeCost(book?.mode || params.mode),
	};
}
