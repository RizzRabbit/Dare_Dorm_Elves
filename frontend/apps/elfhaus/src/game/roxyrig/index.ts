// The ONE swap point for Roxy. v6 rig = placeholder until v7 is approved; to drop v7 in, add rigV7.ts implementing
// RoxyAdapter (types.ts) and change this line. Nothing else in the game imports a rig file directly.
export { createRoxy } from './rigV6';
export type { RoxyAdapter, RoxyFace, RoxyGrade } from './types';
