import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'outverse.settings_test')
if not os.environ.get('DJANGO_SECRET_KEY'):
    os.environ['DJANGO_SECRET_KEY'] = 'test-secret-key'

# Load repo-root .env so Postgres-backed test runs pick up credentials when enabled.
_env_path = ROOT / '.env'
if _env_path.is_file():
    for line in _env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)

import django
django.setup()
