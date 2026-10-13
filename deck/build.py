"""Inline the SVG logos in deck/icons into deck/src.html and write deck/index.html.

Usage: python3 deck/build.py
"""

import re
from pathlib import Path

HERE = Path(__file__).parent


def icon(match: re.Match) -> str:
    svg = (HERE / "icons" / f"{match.group(1)}.svg").read_text().strip()
    svg = re.sub(r"<title>.*?</title>", "", svg)
    return svg.replace("<svg ", '<svg class="ico" fill="currentColor" aria-hidden="true" ', 1)


src = (HERE / "src.html").read_text()
out = re.sub(r"\{\{icon:([a-z0-9]+)\}\}", icon, src)
(HERE / "index.html").write_text(out)
print(f"wrote {HERE / 'index.html'} ({len(out) // 1024} KB)")
