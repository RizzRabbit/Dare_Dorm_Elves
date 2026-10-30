// The ONE swap point for Roxy. v7 = the lightweight in-game rig (rigV7.ts); rigV6.ts stays for rollback (its sheet
// assets/rig/roxy_rig.* is left out of the release package unless this line points back at it). Nothing else in the
// game imports a rig file directly.
export { createRoxy } from './rigV7';
export type { RoxyAdapter, RoxyFace, RoxyGrade } from './types';
