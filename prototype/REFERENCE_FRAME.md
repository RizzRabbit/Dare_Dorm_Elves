# Dare Dorm – Elves: REFERENCE FRAME (layout spec for the web-sdk build)
Captured from `prototype/` with headless Chrome (`./shoot.sh`). Screens: `reference_frames/{desktop|mobile}_{state}.png`, desktop **1920×1080**, mobile **390×844** (portrait; DPR 1). The real build should match the **layout, hierarchy and states**; art is placeholder. Palette from ART_BIBLE §1: pink `#FF2E9A`, purple `#7B2CFF`, teal `#00E5D4`, navy `#0B0620`, amber `#FFB45C`, gold `#FFC94A`, off-white `#FFF3FA`.

## 1. Sizing rule
`cell` (one symbol, square) drives everything; `gap = round(cell × 0.04)`.
- **Landscape:** `cell = min((H − 330) / 4, (W − 560) / 5)` → 1920×1080: **cell 187, gap 7**, board 963×769, frame padding 14 → framed board ≈ 991×797, centred in the space above the HUD.
- **Portrait** (H > 1.1 W): `cell = min((W − 50) / 5, (H − 380) / 4.2)` → 390×844: **cell 68, gap 3**, board 352×281, frame padding 7.
- Min cell 48. All symbol text/badges scale with cell (badge font 0.15 cell, plate 0.10 cell).

## 2. Elements (z-order low → high)
| # | Element | Desktop position / size | Mobile position / size | States |
|---|---|---|---|---|
| 1 | Background (`background.png`) | full-bleed cover | full-bleed cover | base; **in-bonus**: hue −35°, sat 1.4, brightness 0.8 |
| 2 | Logo | top-left, x 24 y 8, h 110 (screen-blend) | top centre, h 96 | static |
| 3 | PROTOTYPE tag | top centre y 10 | under logo | prototype only (remove in real build) |
| 4 | DEV button | top-right 16/12 | top-right 6/6 | prototype only |
| 5 | Free-spin bar | centred above frame, pill 2 px teal: `TIER` (pink) · `FREE SPIN n / total` · `max 18` | same, 15 px | hidden in base; shown from `updateFreeSpin` to `freeSpinEnd`; total updates on `freeSpinRetrigger` |
| 6 | Banner | centred, ~70 px above board top, pink→purple pill | max-width 94 vw, wraps | transient (1–2 s): RESPIN n/3, NEW WILD LANDS, STACK BUILT (parts sum), INSTANT STACK x4, MERGE (N elves, product), RESPINS END (reason), MYSTERY odds, MYSTERY RESULT, EGW pattern, BOUGHT tier, +N SPINS |
| 7 | Board frame | 14 px gradient pink→purple→teal, radius 22, glow | 7 px, radius 14 | — |
| 8 | Cells 5×4 | at `(reel × (cell+gap), row × (cell+gap))` | same | **drop** (0.32 s, stagger 70 ms/reel), **win** (white ring + gold glow, pulse ×2), **dim** (non-winning, brightness .45), **replace** (pink veil "RESPIN"), **out** (fade 0.2 s), **locked** (teal ring + "LOCKED" tag bottom-left) |
| 9 | Single wild | cell, gold border, `wild_single` art, WILD plate bottom centre | same | **badge** top-right "xN" (pink pill, white 2 px); **grow**: badge scale 1.5 + "+1" float-up 0.8 s |
| 10 | Full-reel wild | covers one reel column (cell × board height), 4 px gold border | same | **fuse** 0.6 s (scaleY .2 → 1, bright flash); badge "xN" bottom centre at 0.35 cell above plate; WILD plate bottom; grows like a single |
| 11 | Merged wide wild | spans the adjacent group (n × cell + (n−1) × gap), white border, pink+teal glow | same | label top "N ELVES – merged N-wide scene" (placeholder for WM2–WM5 art); **combined badge** "x6 × x5 = x30"; plate "WILD × N"; values update live on `wildGrow` |
| 12 | Paylines | SVG polylines through cell centres of the full 5-cell line, 5 px, 8-colour cycle | same | shown on `winInfo`, cleared on `respinStart` |
| 13 | Step toast | board centre, gold 2 px, `+$amount` (0.26 cell) + "step s · n lines · best Lx k×SYM ×mult" | same | per `winInfo` |
| 14 | HUD meters | bottom, max-width 1300, 3 panels (BALANCE teal · WIN pink · BET teal), max 340 w each, value 24 px | 3 panels, value 16 px | WIN counts the round total (step running win + previous spins) |
| 15 | Button row | left: MENU, BUY BONUS, ANTE 1.25x (86×64) · centre: AUTO SPIN, **SPIN** (104 Ø circle, pink, gold 4 px), TURBO · right: −, + | row 1: AUTO / SPIN (92 Ø) / TURBO; row 2: MENU, BUY, ANTE, −, + (64×50) | disabled (40 %) while a round plays (except SPIN/AUTO); ANTE & TURBO toggle (pink when on); SPIN glows while busy; AUTO shows STOP + count |
| 16 | Bonus intro | centred card, gold 4 px, tier name 64 px gold, "N FREE SPINS" 34 px, carried wilds list (teal), rules note, PRESS TO CONTINUE | tier 40 px | on `freeSpinTrigger`; auto-continues 2.6 s |
| 17 | Big win | full-screen dim, tier 96 px gold (BIG ≥10x, MEGA ≥25x, SUPER ≥50x, EPIC ≥100x, LEGENDARY ≥1000x, MAX WIN on `wincap`), count-up amount 64 px, "Nx bet" | 56 / 40 px | on `setWin` ≥ 10x and `wincap` |
| 18 | Buy menu | modal max 1100 w, 5 cards in a row (Dare, Double Dare, Triple Dare, Mystery Spin, Elves Gone Wild): name, description, price (cost × bet), "Nx bet", BUY → confirm row | 2-column grid, EGW full width | confirm text "Buy X for $Y?"; Mystery card must show odds 50/37/10/3 and "decided before the reveal" |
| 19 | Rules (MENU) | modal: rules, paytable (x total bet), disclaimer ending **"TM and © 2026 Engine."** | scrolls | — |
| 20 | Dev panel | right 380 w | full width | prototype only |

## 3. State frames
| State | File | Book / moment |
|---|---|---|
| Base idle | `*_base.png` | seeded random board |
| Mid-respin, locked growing wilds | `*_respin.png` | E3 at `respinStart` step 3: 4 locked wilds (x4,x4,x3,x2), replace veils |
| Full-reel wild | `*_fullreel.png` | E3 after step-3 growth: reel 3 = 4+4+3+1 = x12 → x13 |
| Merged wild + combined badge | `*_merged.png` | E5 step 0: R1×R2 merged "x6 × x5 = x30" + isolated R4 x7; 2,440.15x |
| Bonus intro | `*_intro.png` | E3 → TRIPLE DARE, 12 free spins, carried R3 x13 + singles x5/x3 |
| In-bonus | `*_bonus.png` | E10 Double Dare free spin 3/10, R3 locked x14 after growth, respin 1 win |
| Mystery reveal | `*_mystery.png` | E8 respin 2: R3 completes 2+3+3+1 = x9 |
| Buy menu | `*_buy.png` | 5 buy cards at $1 bet |
| Big win | `*_bigwin.png` | E4 350.1x → EPIC WIN |
| Wincap | `*_wincap.png` | E12 Hidden free spin, x8×x7×x9 = x504 → MAX WIN 50,000x |
| Dev panel | `*_dev.png` | E5 match + 5,000-spin base autoplay |

## 4. Event → visual timing (normal speed; turbo × 0.35)
reveal 650 ms · stackComplete 900 · mergeGroups 900 (only when a group appears) · winInfo 1100 · wildGrow 650 · respinStart 700 + 250 fade · respinReveal 500 · respinEnd 450 · freeSpinTrigger 2600 · updateFreeSpin 250 · freeSpinRetrigger 900 · freeSpinEnd 1600 · big win ~1350 count-up + 1500 hold.
