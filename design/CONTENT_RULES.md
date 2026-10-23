# Dare Dorm – Elves: content and art rules
Checked 2026-10-23 CDT. Not legal advice. Final approval is always the Stake Engine reviewer's call.

## 1. What Stake Engine publishes (verbatim)
Source: https://stake-engine.com/docs/approval-guidelines ("General requirements → Key restrictions"), fetched 2026-10-23:
- "Approval is at the discretion of the reviewer. Games deemed offensive, explicit, in poor taste, or of insufficient quality may be rejected."
- "Games that promote, encourage, or are likely to appeal to underage persons are not permitted. This includes artistic depictions of children or child-like characters in any gambling context."
- "Team names, game titles, and assets must comply with intellectual property/copyright law. Infringement is grounds for rejection."
- "Game assets cannot include material with Stake™ branding or themes."
- "Games must be original designs."

Source: https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements (stake.us / social mode): restricts **words** only ("bet", "buy", "pay", "bonus buy", "rebet" → "respin" …), "This predominantly applies to game rules but also extends to images and UI elements." Images/UI must not show restricted words in social mode.

**No published rule found** on: nudity or partial nudity, lingerie/swimwear, sexual themes, alcohol, tobacco/cigars, cannabis or other drug imagery, or weapons. (Also checked by search: stakeengine.org mirror of the same page; no extra rules.) So these fall under the discretionary "offensive, explicit, in poor taste" line, which is judged against precedent.

## 2. Precedent (user-confirmed, 2026-10-23)
**Rack City Baddies** by **Donut Games**, a Stake Engine studio featured on the Stake Engine site, is **live on stake.com and stake.us**. It shows: thong bikinis; **bare buttocks** as the multiplier symbols; a **full-reel woman in a thong seen from behind**; guns, whiskey and cigars. A Stake Engine title at that level passed the same review route we use.

## 3. Verdicts for this game
| Item | Verdict | Why / guard rails |
|---|---|---|
| Suggestive adult elves in flirty college wear (crop tops, cutoffs, off-shoulder hoodies, sleepshirts, towels, bikini under a hoodie), incl. group scenes of 2–5 elves on merged wilds | **OK by precedent** (the precedent is more revealing) | Rack City Baddies. Sexy through fit and pose, not club glam; never pornographic. |
| Rear nudity (bare buttocks, thong from behind) | **OK by precedent** | Same as the precedent's full-reel symbol. |
| Alcohol (DARE bottle, red cup) | **Kept – user decision (2026-10-23)**; OK by precedent | Whiskey is shown in the precedent. Unbranded bottles and cups only. |
| **Full-reel stacked wild: one elf, as revealing as the ceiling allows; frontal covering pose** (arm/hair covering the chest) | **Locked by the user; likely OK if nipples and genitals are never visible** in any frame | Implied nudity is one step past the precedent (which is rear-view). Hard rule: opaque covering at every animation frame, incl. the 5-wide merged scene and win loops. No sexual acts, no touching of genitals/breasts beyond a covering hand, no explicit fluids. |
| Merged wilds that add elves (2/3/4/5 elves, sexier and more crowded as they grow) | **OK within the same ceiling** | The ceiling never moves: no nipples, no genitals, at any width or frame; every elf clearly adult. |
| **Every character clearly adult** | **ABSOLUTE RULE** | Adult women in their early 20s with unmistakably adult faces, bodies and proportions. Youthful energy OK, childlike never: no chibi, no big-eye/kawaii, no petite/childlike bodies, no school uniforms, no real school branding, no braces, no stuffed toys. Rules/description text: "All characters are adults." Elves are often drawn youthful, so review every asset for this. |
| College dorm party setting (user direction: "sexy college elves, not strippers") | **OK with care** | Characters are college-age **adults (early 20s, clearly adult)**; casual college wear (crop tops, cutoffs, jerseys, hoodies, pajama sets, towels). **Fictional** school names/Greek letters only (no real universities or crests). No school uniforms, no "freshman"/age words, no high-school cues. Drinking shown only with these adults; unbranded cups/bottles. |
| **Cannabis leaf (L5)** | **Kept – user decision (2026-10-23)** | Risk note: no published Engine rule either way; drug imagery is not in the precedent, and approval is at the reviewer's discretion. |
| Name "Elves Gone Wild" (EGW mode) | **User keeps it; risk noted** | From DECISIONS C-c: GIRLS GONE WILD is a live US registration (Reg. 4010741, entertainment services, GGW Group s.r.o., renewed Jan 2022); its owners successfully opposed "BOWLS GONE WILD" (TTAB 91180003, sustained 2008, by default). Engine rule: IP infringement "is grounds for rejection". Fallback names ready: "Wild Elf Night", "Elf Frenzy". Keep the mode id `egw` so a rename is label-only. |
| Social mode words | **Required** | Use "Get Bonus", "Mystery Spin", "Play", "wins" in `sweeps_en`; never "Buy"/"Bet"/"Pays" on art or UI (bake no restricted words into images). |

## 4. Art review checklist (do this for every asset and every animation frame)
1. Adult? (face, body, proportions, styling) 2. Nipples/genitals never visible, incl. motion blur, transparency, hair gaps? 3. No sexual act/explicit gesture? 4. No real brands, no Stake branding? 5. No restricted words baked into images? 6. Original (no traced/stock likeness of real people)? 7. Readable at 400×225 (popout) and mobile?

Ask Engine Support for a pre-check with the concept sheet before final production art.
