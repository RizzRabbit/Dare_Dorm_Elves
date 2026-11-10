// Plain TypeScript UI state. This is the source of truth for HUD values, control
// visibility, and overlay open/content flags. Pixi chrome reads this object; game
// logic writes it. It replaces the hidden #uiHostTree document store.
export type OverlayId =
	| 'buyMenu' | 'bmConfirm' | 'autoMenu' | 'popMenu' | 'settings' | 'menu'
	| 'msg' | 'resumeCard' | 'intro' | 'outro' | 'bigwin' | 'cardFlip'
	| 'maxwin' | 'fsMore' | 'banner' | 'stepToast' | 'fsBar' | 'replayBar';

export type UiState = {
	balance: string;
	bet: string;
	win: string;
	autoN: string;
	turbo: boolean;
	armed: { on: boolean; title: string; short: string };
	replay: boolean;
	hidden: Partial<Record<'spin' | 'auto' | 'turbo' | 'buy' | 'betDown' | 'betUp', boolean>>;
	overlay: Partial<Record<OverlayId, { open: boolean; text?: string }>>;
};

const state: UiState = {
	balance: '—', bet: '—', win: '—', autoN: '',
	turbo: false,
	armed: { on: false, title: '', short: '' },
	replay: false,
	hidden: {},
	overlay: {},
};

const listeners = new Set<(s: UiState) => void>();
const emit = () => { for (const fn of listeners) fn(state); };

export const uiState = () => state;
export const onUiState = (fn: (s: UiState) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function setHudField(k: 'balance' | 'bet' | 'win' | 'autoN', v: string) { state[k] = v; emit(); }
export function setTurbo(on: boolean) { state.turbo = on; emit(); }
export function setArmed(on: boolean, title = '', short = '') { state.armed = { on, title, short }; emit(); }
export function setReplay(on: boolean) { state.replay = on; emit(); }
export function setControlHidden(k: keyof NonNullable<UiState['hidden']>, on: boolean) { state.hidden[k] = on; emit(); }
export function setOverlay(id: OverlayId, open: boolean, text?: string) { state.overlay[id] = { open, text }; emit(); }
