#!/bin/bash
# Capture reference frames with headless Chrome. Usage: ./shoot.sh  (serves on :8765 if not already)
cd "$(dirname "$0")"
curl -s -o /dev/null http://localhost:8765/index.html || (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
CH=$(command -v google-chrome || command -v chromium)
for st in ${STATES:-base respin fullreel merged intro bonus mystery buy bigwin wincap upgrade dev}; do
  for vp in desktop:1920,1080 mobile:390,844; do
    n=${vp%%:*}; sz=${vp#*:}
    "$CH" --user-data-dir=/tmp/dde-shoot-$$ --disk-cache-size=1 --headless=new --disable-gpu --hide-scrollbars --no-sandbox --window-size=$sz --virtual-time-budget=4000 \
      --screenshot=reference_frames/${n}_${st}.png "http://localhost:8765/index.html?frame=$st" >/dev/null 2>&1
  done
done
ls reference_frames
