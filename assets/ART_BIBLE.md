# Dare Dorm – Elves: ART BIBLE (v2, college direction)
**User art direction (2026-10-23, LOCKED): "These are sexy college elves. Not strippers."** Sexy through fit, pose and attitude, never club glam. No sequins, latex, stripper heels, pole/club staging or heavy glam makeup.
Content ceiling: `design/CONTENT_RULES.md` (Rack City Baddies precedent; **clearly adult women; never visible nipples or genitals**). Concepts: `assets/concepts/` (see §7).

## 1. Style guide
- **Who:** sexy **college elf women, early 20s and clearly adult**: adult faces, adult bodies and proportions, adult height. Youthful energy is fine; childlike is never fine (no chibi, big-eye/kawaii, petite/childlike bodies, braces, stuffed toys, school uniforms or plaid uniform skirts).
- **Wardrobe (casual, flirty college wear):** crop tops, cutoff denim shorts, oversized varsity jerseys or hoodies slipping off a shoulder, sorority/Greek-letter tees (fictional letters), tied-up flannel shirts, pajama-party shorts sets, a bikini under an open hoodie (pool party), knee socks, scrunchies, messy buns, sneakers or bare feet. Sexy comes from fit (cropped, off-shoulder, short shorts) and pose (selfie, wink, hair flip, over-the-shoulder look), not from glam.
- **Makeup/hair:** natural, fresh, playful: light blush, freckles welcome, glossy lips, a little liner. Messy buns, ponytails, scrunchies, beachy waves. Neon hair colours are fine (pink, teal, violet, platinum).
- **Setting/props:** dorm party: warm string lights, posters (fictional), red cups, bunk bed, mini fridge, fairy-light curtains, LED strip glow, a pizza box, beanbags. Fictional school names only (e.g. "Arcane U"); no real university names, crests or trademarks.
- **Look:** glossy stylized cartoon illustration (premium slot style), clean bold ink outlines (3–4 px at 512 px), cel shading with soft gradients, warm string-light key light plus **soft neon rim light** (pink left / teal right).
- **Palette:** Neon Pink `#FF2E9A`, Electric Purple `#7B2CFF`, Neon Teal `#00E5D4`, Deep Navy `#0B0620` (shadows/UI), Warm string-light amber `#FFB45C`, Gold accent `#FFC94A` (frames, big wins), Off-white `#FFF3FA`.
- **Prompt suffix (append to every character prompt):** `flirty adult college woman in her early twenties, clearly an adult with an adult face and adult proportions, natural fresh makeup, casual college party wear, dorm party with string lights in the background, glossy stylized cartoon illustration, bold clean outlines, soft neon pink and teal rim light, not childlike, no club glam, no nudity, no visible nipples or genitals, no text`
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
| L1 | DARE bottle | 256² | yes | idle/land/win/replace | Glossy unbranded neon-pink glass bottle with a label reading DARE, glowing liquid, sparkles, thick outline, purple glow, icon style |
| L2 | Lips | 256² | yes | same | Glossy pink lips with a shine highlight and a small sparkle, icon style |
| L3 | GOOD VIBES neon | 256² | yes | same (win: flicker on) | Small dorm-wall neon tube sign reading GOOD VIBES in teal script with a pink heart, icon style |
| L4 | Red cup | 256² | yes | same | Classic red plastic party cup, unbranded, with a foam splash, icon style |
| L5 | Cannabis leaf **(flagged)** | 256² | yes | same | Stylized neon-green leaf icon. **Default ship art = L5 alt:** neon purple gaming controller icon with teal buttons |
| W | Single wild: two college elves hugging, selfie | 256² | yes | idle/land/win/lock/grow | Two elves hugging cheek to cheek and posing for a selfie with a phone held up, laughing: one with a messy bun and pink scrunchie in a white crop top with fictional Greek letters, one with long teal hair in an oversized purple varsity jersey off one shoulder; string lights and posters behind; square gold-and-neon frame with a WILD plate (plate text added in UI). Badge slot bottom-right |

### Full-reel and merged wilds: the escalation (each step sexier, always college wear)
| id | Asset | Size (1×) | Alpha | States | Prompt (+ suffix) |
|---|---|---|---|---|---|
| WM-ladder | Escalation rule | – | – | – | 2-wide **hoodie** → 3-wide **crop top + shorts** → 4-wide **sleepshirt** → 5-wide **towel after a shower** → full-reel stack and the 5-wide finale centre = **the covering pose**. Ceiling never moves: no nipples, no genitals, any frame. |
| WF | Full-reel stack elf, **covering pose (ASSUMED – user to confirm)** | 256×1024 | yes | stack (0.8 s fuse/reveal), idle, win, grow | Full-body elf with long messy pink-purple hair, standing by a bunk bed under string lights, topless with both forearms and her long hair fully covering her chest, low-rise cutoff denim shorts unbuttoned at the top, knee socks, shy-flirty over-the-shoulder smile, soft neon rim light, WILD plate at the bottom |
| WM2 | Merged 2-wide: **hoodie** | 512×1024 | yes | merge (0.9 s), idle, win, grow | Two elves sharing one giant oversized hoodie pulled over both of them, bare legs and knee socks, cheek to cheek, playful pose on a beanbag, string lights |
| WM3 | Merged 3-wide: **crop top + shorts** | 768×1024 | yes | same | Three elves dancing on a dorm bed in crop tops and cutoff denim shorts, red cups raised, hair flips, fairy lights, confetti |
| WM4 | Merged 4-wide: **sleepshirt** | 1024×1024 | yes | same | Four elves at a late-night pajama party, oversized sleepshirts slipping off shoulders and riding up, pillow fight feathers mid-air, one looking back over her shoulder, bunk beds and LED strips |
| WM5 | Merged 5-wide: **towel after a shower** + covering-pose centre | 1280×1024 | yes | same + max-win loop | Five elves in a steamy dorm bathroom hallway after showers: four wrapped in short towels with wet hair and towel turbans, playful poses; the centre elf in the covering pose (arms and hair covering her chest, towel around her hips); steam, string lights, glowing tiles |
| MB | Multiplier badges | 96×96 single, 192×96 merged | yes | tick (+1 pop), stack-sum count-up, merge "x6 × x5 = x30" morph | Rounded neon pill badge, gold rim, pink fill, white bold numerals; merged badge "x6 × x5 = x30" with the result larger; pink ≤x9, purple x10–99, gold x100+ |

Single wild: badge bottom-right. Full-reel and merged wilds: one badge bottom centre above the WILD plate.

## 4. Scenes and UI
| Asset | Size | Alpha | States | Prompt |
|---|---|---|---|---|
| Background (base) | 1920×1080 + 1080×1920 portrait crop | no | parallax layers, string-light twinkle loop | A big dorm common room / dorm-house party at night, no people: warm string lights, LED strip glow in pink/purple/teal, fictional posters, a bunk bed, beanbags, a couch, red cups and a pizza box on a table, balloons, soft haze; centre darker for the reel grid; no text, no real school names. (Current concept `background.png` is a loft party; it fits the palette but reads a bit "club": regenerate in this dorm version when convenient.) |
| Background (free spins) | same | no | same | Same room later in the night: fairy-light curtains, pillow-fight feathers, confetti, purple lighting |
| Reel frame | 1360×1100 | yes | idle glow, win pulse | Neon tube frame pink-to-teal with string lights draped over the top edge |
| Logo | 1200×600 | yes | intro (neon flicker on), idle shimmer | DARE DORM in chunky pink neon letters with purple outline, ELVES in teal neon script, elf ear and sparkle (concept OK as is) |
| Bonus intro – Dare | 1920×1080 | panel alpha | 2.5 s + "8 SPINS" (live text) | Roxy (H1) holding up a truth-or-dare card, winking, dorm hallway |
| Bonus intro – Double Dare | 1920×1080 | panel alpha | same, 10 | Jade and Vi pointing at the viewer from a bunk bed |
| Bonus intro – Triple Dare | 1920×1080 | panel alpha | same, 12 | Three elves on a dorm couch spinning a bottle, confetti |
| Bonus intro – Hidden | 1920×1080 | panel alpha | same, 14 | A dorm door opening a crack, steam and pink light, the covering-pose elf silhouette inside |
| Bonus end / total win | 1200×800 | yes | count-up | Coco (H4) cheering with a red cup, gold frame |
| Mystery Spin art | 600×400 | yes | idle shimmer, reveal | A care-package box with a big pink question mark, elf hands lifting the lid, string lights (odds as live text) |
| EGW art | 600×400 | yes | idle, hover | Five elves in college wear in a row taking a group selfie, wild glow (title as live text) |
| Buy menu cards | 420×560 ×5 | yes | idle/hover/disabled | Card frames per tier colour with the tier's elf portrait; text live |
| UI panels | 9-slice 64×64 | yes | normal/hover/pressed/disabled | Dark glass panel, 2 px neon pink stroke, 12 px radius |
| Spin button | 220×220 | yes | idle/press/spinning/disabled | Round neon pink button, white circular arrow |
| Ante toggle | 240×96 | yes | off/on | Pill toggle, teal on |
| Big-win banners | 1400×500 ×4 | yes | in/loop/out | BIG / MEGA / EPIC / MAX WIN neon banners (text live or approved words only) |
| Respin counter | 300×100 | yes | 3→2→1 | Neon "RESPIN" with three pips |
| Spins counter | 300×120 | yes | tick, +2 pop | "SPINS 7/12" neon display |

## 5. Animation notes
- **Respin:** connected non-wild cells flash, pop out and are replaced; wilds get a gold lock ring. Step win counts up per step and never drops.
- **Grow:** +1 badge tick with a pink pop on every connected wild after each step.
- **Stack:** 4 wilds slide together → flash → WF reveal; badge counts the sum (e.g. 4+4+3+1 → x12).
- **Merge:** adjacent WF reels fuse into WM2–WM5 (escalation ladder); badge morphs to "x6 × x5 = x30".
- **Mystery:** partial-stack reel anticipates; each respin is a reveal beat; outcome banner after `mysteryResult`.
- **Fastplay:** shorter but legible.

## 6. Audio (brief)
House-party pop/EDM loop (base), bigger drop in free spins, respin whooshes, giggle/whistle stingers on wild land, riser on stack completion, crowd "ohhh" on merges. Original or properly licensed only.

## 7. Concept images in `assets/concepts/`
| File | Status |
|---|---|
| `logo.png` | generated, kept |
| `background.png` | generated, kept (loft party; regenerate the dorm version in §4 if it reads too clubby) |
| `wild_single.png` | **regenerated in the college direction** (selfie, Greek-letter crop top + varsity jersey). The baked poster/jersey text is concept-only. |
| `premium_H1_elf.png` | **regenerated in the college direction** (Roxy: off-shoulder hoodie, crop tank, cutoffs, red cup) |
| `wild_fullreel_swimwear.png` | **pre-direction concept (superseded)**: swimsuit + heels reads club; use only as pose reference. Production WF follows the covering-pose prompt above (run in the user's own image tool) |
Concepts are direction only; production art must be redrawn at final sizes and pass CONTENT_RULES §4.
