// Feature-intro and buy-menu elves: existing transparent cutouts, seated on the cream card.
// No new image files. Powder Day has no existing arms-up / snow cutout, so it uses the same
// standing five as Elves Gone Wild.
import roxy from '../assets/maxwin/maxwin_elf_roxy.webp';
import jade from '../assets/maxwin/maxwin_elf_jade.webp';
import vi from '../assets/maxwin/maxwin_elf_vi.webp';
import coco from '../assets/maxwin/maxwin_elf_coco.webp';
import delilah from '../assets/maxwin/maxwin_elf_delilah.webp';

export const ELF_CUTOUT = { roxy, jade, vi, coco, delilah } as const;
export type ElfId = keyof typeof ELF_CUTOUT;

/** Which standing cutouts appear on each mode's card. */
export const MODE_ELVES: Record<string, ElfId[]> = {
	dare: ['roxy'],
	double_dare: ['roxy', 'jade'],
	triple_dare: ['roxy', 'jade', 'vi'],
	egw: ['roxy', 'jade', 'vi', 'coco', 'delilah'],
	hidden: ['roxy', 'jade', 'vi', 'coco', 'delilah'],
};

const SHADOW = 'assets/rig/roxy_ground_shadow.webp';

export function elvesHTML(mode: string): string {
	const ids = MODE_ELVES[mode] || [];
	if (!ids.length) return '';
	const imgs = ids.map((id) => `<img class="elfCut" data-elf="${id}" src="${ELF_CUTOUT[id]}" alt="" draggable="false">`).join('');
	return `<span class="elfRow" data-n="${ids.length}" aria-hidden="true"><img class="elfShadow" src="${SHADOW}" alt="" draggable="false">${imgs}</span>`;
}
