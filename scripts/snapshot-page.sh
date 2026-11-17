#!/bin/bash
# Saves a rendered page with its CSS and images into a folder you can open offline.
# Usage: ./scripts/snapshot-page.sh <url> [folder]
set -e

URL="${1:?usage: snapshot-page.sh <url> [folder]}"
OUT="${2:-snapshot}"
BASE="$(printf '%s' "$URL" | sed -E 's#(https?://[^/]+).*#\1#')"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"

mkdir -p "$OUT/assets"
curl -s -A "$UA" "$URL" -o "$OUT/index.html"
echo "page:  $OUT/index.html ($(wc -c < "$OUT/index.html" | tr -d ' ') bytes)"

# every same-origin asset the page asks for
python3 - "$OUT/index.html" "$BASE" > "$OUT/assets.txt" <<'PY'
import re, sys
html = open(sys.argv[1]).read()
base = sys.argv[2]
urls = set()
for pattern in (r'(?:href|src)="(/[^"#?]+\.(?:css|png|jpg|jpeg|svg|ico|webp|js))(?:\?[^"#]*)?"',
                r'srcset="([^"]+)"'):
    for match in re.findall(pattern, html):
        for part in match.split(","):
            path = part.strip().split(" ")[0]
            if path.startswith("/"):
                urls.add(path)
for path in sorted(urls):
    print(path.split("?")[0])
PY

while read -r path; do
  [ -z "$path" ] && continue
  mkdir -p "$OUT/assets/$(dirname "${path#/}")"
  curl -s -A "$UA" "$BASE$path" -o "$OUT/assets/${path#/}" || true
done < "$OUT/assets.txt"

# rewrite absolute paths (and drop the cache-busting query) so the folder works from disk
python3 - "$OUT/index.html" <<'PY'
import re, sys
path = sys.argv[1]
html = open(path).read()
html = re.sub(r'(href|src)="/', r'\1="assets/', html)
html = re.sub(r'(assets/[^"]*?)\?v=[^"]*"', r'\1"', html)
open(path, "w").write(html)
PY

echo "assets: $(wc -l < "$OUT/assets.txt" | tr -d ' ') files in $OUT/assets"
rm -f "$OUT/assets.txt"
echo "open:  open $OUT/index.html"
