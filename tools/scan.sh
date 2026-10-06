#!/bin/bash
# فحص قبل الرفع: ملفات + تاريخ الفرعين + ميتاداتا الصور
cd "$(dirname "$0")/.."
PAT='claude|anthropic|\bAI\b|GPT|generated|assistant|\bbot\b|co-authored|openai|copilot'
echo "== files"; grep -rniE "$PAT" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist . | grep -v "tools/scan.sh" | head
for br in $(git branch --format='%(refname:short)'); do
  echo "== history $br"; git log $br --format='%an <%ae>%n%cn <%ce>%n%B' | grep -iE "$PAT" | head
  git log $br --format='%H' | while read c; do git grep -iIE "$PAT" $c -- . ':!tools/scan.sh' 2>/dev/null | head -2; done | head
done
echo "== authors"; git log --all --format='%an <%ae> | %cn <%ce>' | sort | uniq -c
echo "== image metadata"; for f in $(find . -name '*.png' -not -path './.git/*' -not -path './node_modules/*'); do python3 - "$f" <<'PY'
import sys
from PIL import Image
im=Image.open(sys.argv[1]); extra={k:v for k,v in im.info.items() if k not in('dpi',)}
print(sys.argv[1], 'META:'+str(extra) if extra else 'clean')
PY
done
echo "== done"
