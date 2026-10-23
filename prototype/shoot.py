#!/usr/bin/env python3
"""Capture reference frames with Playwright (fallback when headless Chrome hangs). Usage: python3 shoot.py  (needs: pip install playwright && playwright install chromium-headless-shell; server on :8765)"""
import os, sys
from playwright.sync_api import sync_playwright
states = os.environ.get('STATES', 'base respin fullreel merged intro bonus mystery buy bigwin wincap upgrade dev').split()
here = os.path.dirname(os.path.abspath(__file__))
with sync_playwright() as p:
    b = p.chromium.launch()
    for st in states:
        for name, (w, h) in {'desktop': (1920, 1080), 'mobile': (390, 844)}.items():
            pg = b.new_page(viewport={'width': w, 'height': h})
            pg.goto(f'http://localhost:8765/index.html?frame={st}', wait_until='networkidle')
            pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(2500)
            pg.screenshot(path=os.path.join(here, 'reference_frames', f'{name}_{st}.png'))
            pg.close()
    b.close()
print('ok', len(states) * 2, 'frames')
