// Max-win cast sheet config (maxwin_elf_*), shared by maxwin.ts (all five) and bigwinElves.ts (the LEGENDARY WIN four).
// Moved out of maxwin.ts unchanged (v3.19) so the big-win layer can rig the same sheets without importing the max-win screen.
import type { ElfCfg } from './elfrig';

// Expression in-betweens (state, frames at 30 fps) for every change: anticipation squint/giggle ('ant'),
// half-rolled eyes + half-open mouth ('half'), half-lids ('blinkh'). Never a cross-fade of two faces.
export const TRANS: Record<string, [string, number][]> = {
	'gawk>blink': [['blinkh', 1]], 'blink>gawk': [['blinkh', 1]],
	'gawk>peak': [['blinkh', 1], ['ant', 2]], 'peak>ahe': [['ant', 2], ['half', 2]], 'ahe>peak': [['half', 2], ['ant', 1]],
	'peak>gawk': [['ant', 1], ['blinkh', 2]], 'ahe>gawk': [['half', 2], ['blinkh', 1]], 'gawk>ahe': [['ant', 2], ['half', 2]],
};
// Roxy's ecstatic face is her 'peak' layer, so her gawk<->peak runs through the ahegao in-betweens
export const TRANS_RX = { ...TRANS, 'gawk>peak': [['blinkh', 1], ['ant', 2], ['half', 2]], 'peak>gawk': [['half', 2], ['blinkh', 1]] } as typeof TRANS;
export const FX: ElfCfg['fx'] = { peak: ['squash', 'tilt', 'giggle'], ahe: ['squash', 'tilt', 'hop'], gawk: ['squash', 'tilt0'] };
export const BLUSH = { ant: 0.35, half: 0.8, ahe: 1, peak: 0.55 };
