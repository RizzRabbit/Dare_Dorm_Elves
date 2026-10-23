# Elfhaus: ART BIBLE (v3, college direction, Lilith's Curse rendering)
**User art direction (2026-10-23, LOCKED): "These are sexy college elves. Not strippers."** Sexy through fit, pose and attitude, never club glam. No sequins, latex, stripper heels, pole/club staging or heavy glam makeup.
**User style direction (2026-10-23, LOCKED): "It shouldn't be glossy artwork"; "the background image is way too dark".** Target rendering = **Lilith's Curse (Monolith, Stake Engine)**, user screenshot kept locally in `assets/reference/` (git-ignored, copyright). Keep its rendering; replace its dark gothic red with a **bright, warm, well-lit college dorm party**.
**Swimwear rule (user, 2026-10-23, LOCKED): NO swimwear unless it is a THONG BIKINI.** No regular bikinis, swimsuits, one-pieces or board shorts anywhere.
Content ceiling: `design/CONTENT_RULES.md` (Rack City Baddies precedent; **clearly adult women; never visible nipples or genitals**). Concepts: `assets/concepts/` (see §7).

## 1. Style guide
- **Who:** sexy **college elf women, early 20s and clearly adult**: adult faces, adult bodies and proportions, adult height. Youthful energy is fine; childlike is never fine (no chibi, big-eye/kawaii, petite/childlike bodies, braces, stuffed toys, school uniforms or plaid uniform skirts).
- **Wardrobe (casual, flirty college wear):** crop tops, cutoff denim shorts, oversized varsity jerseys or hoodies slipping off a shoulder, sorority/Greek-letter tees (fictional letters), tied-up flannel shirts, pajama-party shorts sets, a **thong bikini** under an open hoodie (pool party; the only swimwear allowed), knee socks, scrunchies, messy buns, sneakers or bare feet. Sexy comes from fit (cropped, off-shoulder, short shorts) and pose (selfie, wink, hair flip, over-the-shoulder look), not from glam.
- **Makeup/hair:** natural, fresh, playful: light blush, freckles welcome, soft tinted lips (matte, no wet shine), a little liner. Messy buns, ponytails, scrunchies, beachy waves. Neon hair colours are fine (pink, teal, violet, platinum).
- **Setting/props:** dorm party: warm string lights, posters (fictional), red cups, bunk bed, mini fridge, fairy-light curtains, LED strip glow, a pizza box, beanbags. Fictional school names only (e.g. "Arcane U"); no real university names, crests or trademarks.
- **Look (Lilith's Curse rendering):** **anime/manga illustration**, sharp anime faces with expressive eyes, adult anime proportions (long legs, adult bodies, mature faces). **Clean, crisp dark ink outlines** (3–4 px at 512 px, slightly heavier on the silhouette). **Cel shading** with 2–3 tone steps plus soft gradient shadows; **MATTE finish: no glossy, wet, plastic or airbrushed specular shine on skin, hair or clothes** (only tiny hard-edged highlights in eyes, gems and metal). Painterly illustrated backgrounds with softer outlines than characters.
- **Lighting/brightness:** **bright and warm**: daylight through windows or golden hour, warm lamps, bright string lights; mid-to-high key, readable rooms, no murky shadows. Optional subtle pink/teal accent light; never a dark club look.
- **Symbols:** outlined illustrated icons **inside ornate framed tiles** (rose-gold/pink filigree frames with small pink and teal gems), as Lilith's Curse frames its symbols. Reel frame ornate (rose-gold filigree, pink/teal gems, string lights draped over it). Full-reel character wild with a big **"NX"** multiplier numeral at the bottom, as in the reference.
- **Palette (bright):** Pink `#FF2E9A` (accents) and soft pink `#FFB3D6`, Purple `#7B2CFF` and lavender `#C9A8FF`, Teal `#00E5D4` and mint `#9FF3E8`, cream walls `#FFF1E0`, warm wood `#C98A55`, Deep Navy `#0B0620` (UI text panels and ink only, never the scene), Warm string-light amber `#FFB45C`, Gold accent `#FFC94A` (frames, big wins), Off-white `#FFF3FA`.
- **Prompt suffix (append to every character prompt):** `flirty adult college woman in her early twenties, clearly an adult with an adult face and adult proportions, natural fresh makeup, casual college party wear, bright warm well-lit dorm party with string lights in the background, anime manga illustration, sharp anime face, expressive eyes, clean crisp dark ink outlines, cel shading with soft gradient shadows, matte finish, no glossy or plastic shine, not childlike, no club glam, no swimwear unless a thong bikini, no nudity, no visible nipples or genitals, no text`
- **Delivery:** PNG (RGBA) masters at 2× listed size; frontend packs WebP atlases (`.json` + `.png`) or Spine for animated characters. sRGB. 6% safe margin. **No words baked into art** (UI text is live, for social mode); fictional poster text in backgrounds is OK if it holds no restricted words.

## 2. Grid geometry
Reel cell **256×256** (1×). Grid 5×4 = 1280×1024 + frame. Full-reel wild 256×1024. Merged wide wild N×256 × 1024.

## 3. Symbol list
States: **idle** (2 s loop), **land** (0.3 s squash/bounce), **win** (1.2 s loop: glow, pose shift, sparkles), **replace** (0.25 s pop for respun cells); wild-only **lock**, **grow** (+1 badge tick), **stack** (4 cells fuse to full reel), **merge** (combine into wide art).

| id | Asset | Size (1×) | Alpha | States | Prompt (+ suffix) |
|---|---|---|---|---|---|
| H1 | Elf "Roxy" | 256² | yes | idle/land/win/replace | Waist-up portrait of an elf with platinum-blonde hair with pink tips in a messy high ponytail and pink scrunchie, playful wink, cropped pink hoodie slipping off one shoulder over a white ribbed crop tank, cutoff denim shorts, holding a red party cup, bunk bed and string lights behind, square neon pink frame |
| H2 | Elf "Jade" | 256² | yes | same | Waist-up portrait of an elf with long wavy teal hair, oversized purple varsity football jersey (number 27, fictional "Arcane U") worn off one shoulder as a dress, knee socks, laughing and flashing a peace sign, teal neon frame |
| H3 | Elf "Vi" | 256² | yes | same | Waist-up portrait of an elf with a violet bob and bangs, red-and-black flannel shirt tied up above the waist over a black crop top, high-waisted cutoffs, blowing a kiss, posters behind, purple neon frame |
| H4 | Elf "Coco" | 256² | yes | same | Waist-up portrait of an elf with auburn curls in a messy bun, pastel pajama-party shorts set (cami + shorts) with a paper party crown, hugging a pillow and smirking, fairy lights, gold neon frame |
| L1 | DARE bottle | 256² | yes | idle/land/win/replace | Unbranded pink glass bottle (matte cel-shaded, ink outline) with a label reading DARE, glowing liquid, sparkles, thick outline, purple glow, icon style |
| L2 | Lips | 256² | yes | same | Pink lips with a small hard-edged highlight and a sparkle, matte cel-shaded, icon style |
| L3 | GOOD VIBES neon | 256² | yes | same (win: flicker on) | Small dorm-wall neon tube sign reading GOOD VIBES in teal script with a pink heart, icon style |
| L4 | Red cup | 256² | yes | same | Classic red plastic party cup, unbranded, with a foam splash, icon style |
| L5 | Cannabis leaf **(kept, user decision)** | 256² | yes | same | Stylized cel-shaded green cannabis leaf icon with a soft teal glow and sparkle, thick outline, icon style |
| W | Single wild: two college elves hugging, selfie | 256² | yes | idle/land/win/lock/grow | Two elves hugging cheek to cheek and posing for a selfie with a phone held up, laughing: one with a messy bun and pink scrunchie in a white crop top with fictional Greek letters, one with long teal hair in an oversized purple varsity jersey off one shoulder; string lights and posters behind; square gold-and-neon frame with a WILD plate (plate text added in UI). Badge slot bottom-right |

### Full-reel stacked wild and merged wilds (merges ADD ELVES to the scene)
Ceiling for all of these (CONTENT_RULES): clearly adult early-20s women; **never visible nipples or genitals in any frame** (incl. motion blur, hair gaps, transparency); covering pose OK; no sexual acts. College dorm style throughout. Badge: one combined badge bottom centre above the WILD plate (e.g. "x6 × x5 = x30").

| id | Asset | Size (1×; masters 2×) | Alpha | States | Prompt (+ suffix) |
|---|---|---|---|---|---|
| WF | Full-reel stacked wild: **ONE sexy elf, as revealing as the ceiling allows** | 256×1024 (master 512×2048) | yes | stack (0.8 s fuse/reveal), idle, win, grow | Full-body sexy adult college elf woman standing in a dorm room doorway under string lights, long messy pink-purple hair, topless in a **covering pose**: one forearm across her chest and her long hair fully covering it, the other hand tugging the waistband of tiny low-rise cutoff denim shorts unbuttoned at the top, knee socks, bare midriff and hips, confident flirty look over her shoulder, soft neon pink and teal rim light, WILD plate at the bottom; chest fully covered, nothing explicit |
| WM2 | Merged 2-wide: **2 elves together** | 512×1024 (master 1024×2048) | yes | merge (0.9 s), idle, win, grow | Two sexy adult college elves together on a bunk bed under string lights: one in a tiny cropped tank and cutoff shorts, one in an oversized varsity jersey slipping off both shoulders with bare legs, pressed cheek to cheek, one with an arm around the other's waist, flirty looks at the viewer, red cups, posters |
| WM3 | Merged 3-wide: **3 elves** | 768×1024 (master 1536×2048) | yes | same | Three sexy adult college elves dancing on a dorm bed: thong bikinis under open hoodies, micro cutoff shorts, hair flips, red cups raised, fairy lights, confetti, closer and more playful than WM2 |
| WM4 | Merged 4-wide: **4 elves** | 1024×1024 (master 2048×2048) | yes | same | Four sexy adult college elves at a late-night dorm pajama party: tiny sleep shorts and cropped camis, an oversized sleepshirt slipping off a shoulder, one in just a short towel with wet hair, a pillow fight with feathers in mid-air, crowded and playful, bunk beds and pink/purple LED strips |
| WM5 | Merged 5-wide: **5 elves, full-board party scene** | 1280×1024 (master 2560×2048) | yes | same + max-win loop | Five sexy adult college elves in a crowded full-width dorm party scene: in the centre the WF elf in her covering pose (arm and hair fully covering her chest, unbuttoned cutoffs), flanked by elves in a thong bikini under an open hoodie, a short towel after a shower, a tied-up flannel with a lace bralette peeking, and an off-shoulder jersey; string lights, confetti, red cups, steam from the shower doorway, the sexiest and busiest scene in the game, nothing explicit |
| MB | Multiplier badges | 96×96 single, 192×96 merged | yes | tick (+1 pop), stack-sum count-up, merge "x6 × x5 = x30" morph | Rounded pill badge, gold rim, pink fill, white bold numerals; merged badge "x6 × x5 = x30" with the result larger; pink ≤x9, purple x10–99, gold x100+ |

Single wild: badge bottom-right. Full-reel and merged wilds: one badge bottom centre above the WILD plate.

## 4. Scenes and UI
| Asset | Size | Alpha | States | Prompt |
|---|---|---|---|---|
| Background (base) | 1920×1080 + 1080×1920 portrait crop | no | parallax layers, string-light twinkle loop | A BRIGHT dorm room party in warm golden-hour daylight through a big window plus bright string lights and lamps, no people: cream/pastel walls, bunk bed with purple bedding, fictional posters, mini fridge, beanbags, red cups and a pizza box on a desk, balloons, a neon heart sign; centre slightly simpler for the reel grid (no darkening); anime painterly background style, matte; no text, no real school names. (Concept `background.png` v3 = this.) |
| Background (free spins) | same | no | same | Same room at sunset/evening, still bright and warm: fairy-light curtains, pillow-fight feathers, confetti, lavender light |
| Reel frame | 1360×1100 | yes | idle glow, win pulse | Ornate rose-gold filigree frame with pink and teal gems (Lilith's Curse-style ornate frame), string lights draped over the top edge |
| Logo | 1200×600 | yes | intro (neon flicker on), idle shimmer | ELFHAUS wordmark: "ELF" in chunky matte painted letters, "haus" in hand-lettered script, elf ear and sparkle; matte Lilith's Curse finish, no neon (old DARE DORM concept retired) |
| Bonus intro – Dare | 1920×1080 | panel alpha | 2.5 s + "8 SPINS" (live text) | Roxy (H1) holding up a truth-or-dare card, winking, dorm hallway |
| Bonus intro – Double Dare | 1920×1080 | panel alpha | same, 10 | Jade and Vi pointing at the viewer from a bunk bed |
| Bonus intro – Triple Dare | 1920×1080 | panel alpha | same, 12 | Three elves on a dorm couch spinning a bottle, confetti |
| Bonus intro – Hidden | 1920×1080 | panel alpha | same, 14 | A dorm door opening a crack, steam and pink light, the WF elf in her covering pose peeking out |
| Bonus end / total win | 1200×800 | yes | count-up | Coco (H4) cheering with a red cup, gold frame |
| Mystery Spin art | 600×400 | yes | idle shimmer, reveal | A care-package box with a big pink question mark, elf hands lifting the lid, string lights (odds as live text) |
| EGW art | 600×400 | yes | idle, hover | Five elves in college wear in a row taking a group selfie, wild glow (title as live text) |
| Buy menu cards | 420×560 ×5 | yes | idle/hover/disabled | Card frames per tier colour with the tier's elf portrait; text live |
| UI panels | 9-slice 64×64 | yes | normal/hover/pressed/disabled | Navy glass panel (UI only), 2 px pink stroke, 12 px radius |
| Spin button | 220×220 | yes | idle/press/spinning/disabled | Round neon pink button, white circular arrow |
| Ante toggle | 240×96 | yes | off/on | Pill toggle, teal on |
| Big-win banners | 1400×500 ×4 | yes | in/loop/out | BIG / MEGA / EPIC / MAX WIN neon banners (text live or approved words only) |
| Respin counter | 300×100 | yes | 3→2→1 | Neon "RESPIN" with three pips |
| Spins counter | 300×120 | yes | tick, +2 pop | "SPINS 7/12" neon display |

## 5. Animation notes
- **Respin:** the non-wild cells of every winning line flash, pop out and are replaced; wilds get a gold lock ring. Step win counts up per step and never drops.
- **Grow:** +1 badge tick with a pink pop on every connected wild after each step.
- **Stack:** 4 wilds slide together → flash → WF reveal; badge counts the sum (e.g. 4+4+3+1 → x12).
- **Merge:** adjacent WF reels fuse into WM2–WM5, a wider scene with one more elf per reel (2/3/4/5 elves); badge morphs to "x6 × x5 = x30".
- **Mystery:** partial-stack reel anticipates; each respin is a reveal beat; outcome banner after `mysteryResult`.
- **Fastplay:** shorter but legible.

## 6. Audio (brief)
House-party pop/EDM loop (base), bigger drop in free spins, respin whooshes, giggle/whistle stingers on wild land, riser on stack completion, crowd "ohhh" on merges. Original or properly licensed only.

## 7. Concept images in `assets/concepts/`
| File | Status |
|---|---|
| `logo.png` | generated, kept |
| `background.png` | **v3 (2026-10-23): bright dorm party, Lilith's Curse anime rendering** |
| `wild_single.png` | **v3: anime/matte**, two elves selfie in an ornate rose-gold gem tile. Baked Greek letters/jersey lettering are concept-only (no baked words in production). |
| `premium_H1_elf.png` | **v3: anime/matte**, Roxy (hoodie, crop tank, cutoffs, red cup) in an ornate pink gem tile. Baked "ROXY" sleeve text is concept-only. |
| `DO_NOT_USE_wild_fullreel_swimwear.png` | **DO NOT USE** (breaks the swimwear rule: one-piece swimsuit; also old glossy style). Production WF = one sexy elf in the covering pose (prompt above) in the v3 style. |
Concepts are direction only; production art must be redrawn at final sizes and pass CONTENT_RULES §4.

## UI style (locked 2026-10-23)
- **No glow anywhere on wilds** (cells, locked wilds, full-reel/merged overlays, badges). Wilds get only a subtle idle breathe (img scale 1.00→1.03, ~2.8s ease-in-out loop); LOCKED = small flat denim tag. Multiplier badge = painted rose pill, +1 grow pop kept.
- **Painted matte chrome like Lilith's Curse**: soft top-light→darker-bottom shading, inset edge darkening, faint paper/canvas grain (SVG feTurbulence data-URI), slightly uneven hand-cut corners, ink (#3B2A2A) 2px outlines. No neon, no specular gloss, no rainbow gradients. Palette from the dorm background: cream/paper, wood, soft pink, denim, one accent (rose #C8435F).
- **Gapless grid**: 5×4 cells are individual painted tiles (each respins on its own) butted edge-to-edge with a thin shared ink seam, square corners, zero gutters (`--gap:0`). Full-reel/merged overlays align exactly to the gapless columns.
- Reel window = painted wooden frame around a cream board. Fonts bundled locally (OFL): Lilita One (display/buttons), Caveat Brush (logo script), Nunito (UI/numbers, tabular). Logo is typeset HTML (no dark box); final logo art should follow the same matte painted look.

### UI style update (2026-10-23, 9:34 AM) — supersedes the font/logo/button lines above
- **Typography is sharp, not bubbly**: Cinzel (bold serif, OFL, bundled in `prototype/assets/fonts`) for the wordmark, headings, banners, fsBar, bonus intro and big-win tiers; Nunito for numbers, labels and buttons. Lilita One / Caveat Brush removed.
- **Wordmark**: ELF over HAUS in caps serif with a faked bevel (gradient fill + dark outline + hard drop): ELF light steel, HAUS warm rose-gold, on a simple matte starburst crest (inline SVG). Reference: `assets/reference/ui_ref_logo_waylanders.jpg`.
- **Controls follow `assets/reference/ui_ref_controls.jpg` (Waylanders-style, minimal)**: one dark translucent rounded bar [≡ menu | − | big round dark spin button with a white circular-arrow icon | + | autoplay icon], under it a dark translucent BALANCE / PLAY / WIN strip (small labels, bold sans values). Above the bar: round dark icon buttons, turbo (lightning) and a smaller ante toggle (double chevron, 1.25x) on the left, and **BONUS BUY as a simple round emblem icon** (gold elf-ear and sparkle) on the right. White line icons, no text on buttons, no glow. On mobile the bar spans the full width at the bottom.
- Panels, banners, modals, toasts: dark glass (about 70–82% opacity) with a thin 1px warm hairline border and small radii. The reel window stays the painted matte wooden frame with gapless separate cells, and wilds still have no glow, only the subtle breathe.
