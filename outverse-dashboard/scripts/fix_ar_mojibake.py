import re
from pathlib import Path

import ftfy

path = Path(__file__).resolve().parents[1] / 'lib' / 'i18n' / 'ar.ts'
content = path.read_text(encoding='utf-8')


def fix(s: str) -> str:
    if not re.search(r'[\u00c0-\u00ff]|â|ðŸ', s):
        return s
    return ftfy.fix_text(s)


def repl(m: re.Match) -> str:
    q = m.group(1)
    inner = m.group(2)
    return q + fix(inner) + q


new = re.sub(r"('|\")((?:\\.|(?!\1).)*)\1", repl, content)
changed = sum(1 for a, b in zip(content.splitlines(), new.splitlines()) if a != b)
path.write_text(new, encoding='utf-8', newline='\n')
print('lines changed:', changed)
print('remaining Ø count:', new.count('Ø'))
