#!/usr/bin/env python3
"""Portrait board bottom rail (v3.7, gate F2): a straight crop of the approved B2 portrait crown's beam moulding (the lit
edge + dark reveal + rail under the string lights, png rows 246-294, a clean stretch between the bulbs), so the board
frame closes at the bottom in the same style as the crown and pilasters. No new art. alcove.ts stretches it between the
pilaster centres right under the board.
Run from frontend/apps/elfhaus:  python3 scripts/gen-alcove-rail.py
"""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
D = os.path.join(ROOT, 'assets/final/webp/frame')
im = Image.open(os.path.join(D, 'b2_crown_portrait.webp')).convert('RGBA')
rail = im.crop((560, 246, 1040, 294))
rail.save(os.path.join(D, 'b2_rail_portrait.webp'), 'WEBP', quality=90, alpha_quality=95, method=6)
print('b2_rail_portrait', rail.size)
