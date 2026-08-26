"""Cosonova web pre-launch smoke suite (public + soft-token + data presence)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "http://127.0.0.1:8000"
FRONT = "http://127.0.0.1:3000"
OUT = Path(__file__).resolve().parent / "_smoke_api_report.json"


def call(method: str, path: str, *, token: str | None = None, data=None, timeout: float = 30.0):
    url = path if path.startswith("http") else f"{BASE}/api/{path.lstrip('/')}"
    headers = {"Accept": "application/json", "User-Agent": "cosonova-smoke/1.0"}
    if token:
        headers["Authorization"] = f"Token {token}"
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            ms = int((time.perf_counter() - t0) * 1000)
            try:
                payload = json.loads(raw.decode() or "null")
            except Exception:
                payload = raw[:240].decode(errors="replace")
            return {
                "area": "api",
                "method": method,
                "path": path,
                "status": resp.status,
                "ms": ms,
                "ok": 200 <= resp.status < 300,
                "error": None,
                "hint": _hint(payload),
            }
    except urllib.error.HTTPError as e:
        ms = int((time.perf_counter() - t0) * 1000)
        raw = e.read()
        try:
            payload = json.loads(raw.decode() or "null")
        except Exception:
            payload = raw[:240].decode(errors="replace")
        return {
            "area": "api",
            "method": method,
            "path": path,
            "status": e.code,
            "ms": ms,
            "ok": False,
            "error": str(e.reason),
            "hint": _hint(payload),
        }
    except Exception as e:
        ms = int((time.perf_counter() - t0) * 1000)
        return {
            "area": "api",
            "method": method,
            "path": path,
            "status": 0,
            "ms": ms,
            "ok": False,
            "error": str(e),
            "hint": None,
        }


def front(path: str, timeout: float = 20.0):
    url = f"{FRONT}{path}"
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cosonova-smoke/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(4000)
            ms = int((time.perf_counter() - t0) * 1000)
            text = raw.decode(errors="replace")
            bad = any(x in text.lower() for x in ("internal server error", "application error"))
            return {
                "area": "ui",
                "method": "GET",
                "path": path,
                "status": resp.status,
                "ms": ms,
                "ok": (200 <= resp.status < 400) and not bad,
                "error": "error page content" if bad else None,
                "hint": f"bytes={len(raw)}",
            }
    except Exception as e:
        ms = int((time.perf_counter() - t0) * 1000)
        return {
            "area": "ui",
            "method": "GET",
            "path": path,
            "status": 0,
            "ms": ms,
            "ok": False,
            "error": str(e),
            "hint": None,
        }


def _hint(payload):
    if isinstance(payload, list):
        return f"items={len(payload)}"
    if isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            total = payload.get("count")
            return f"results={len(payload['results'])}" + (f",count={total}" if total is not None else "")
        keys = list(payload.keys())[:8]
        detail = payload.get("detail") or payload.get("error")
        if detail:
            return f"detail={str(detail)[:120]}"
        return f"keys={keys}"
    if payload is None:
        return None
    return str(payload)[:120]


PUBLIC_API = [
    ("GET", "health/system/"),
    ("GET", "posts/?limit=5&offset=0&feed=for_you"),
    ("GET", "posts/trending/"),
    ("GET", "posts/trending_tags/"),
    ("GET", "stories/"),
    ("GET", "stories/spotlight/"),
    ("GET", "reels/?limit=5"),
    ("GET", "bottles/map/"),
    ("GET", "bottles/recent/"),
    ("GET", "challenges/daily/"),
    ("GET", "challenges/archive/?page=1&page_size=6"),
    ("GET", "challenges/stats/"),
    ("GET", "ideas/?limit=5"),
    ("GET", "ideas/featured/"),
    ("GET", "questions/daily/?period=morning&lang=en"),
    ("GET", "questions/next/?lang=en"),
    ("GET", "users/suggestions/"),
    ("GET", "chat/config/"),
    ("GET", "communities/"),
    ("GET", "shop/items/"),
    ("GET", "notifications/"),
    ("GET", "users/me/"),
    ("GET", "capsules/"),
    ("GET", "collab/projects/"),
    ("GET", "subscriptions/plans/"),
]

# Endpoints that may legitimately require auth (401/403 = expected without token)
AUTH_EXPECTED = {
    "notifications/",
    "users/me/",
    "questions/daily/?period=morning&lang=en",
}

UI_PAGES = [
    "/",
    "/lab",
    "/bazaar",
    "/bottles",
    "/reels",
    "/login",
    "/settings",
    "/terms",
    "/privacy",
]


def main():
    rows = []
    for method, path in PUBLIC_API:
        rows.append(call(method, path))

    soft_map = call("GET", "bottles/map/", token="invalid-token-after-aws-migration")
    soft_map["path"] = "bottles/map/ [invalid token]"
    soft_posts = call("GET", "posts/?limit=3&feed=for_you", token="invalid-token-after-aws-migration")
    soft_posts["path"] = "posts/for_you [invalid token]"
    rows.extend([soft_map, soft_posts])

    for path in UI_PAGES:
        rows.append(front(path))

    def classify(row):
        if row["ok"]:
            return "pass"
        if row["area"] == "api" and row["path"] in AUTH_EXPECTED and row["status"] in (401, 403):
            return "expected_auth"
        if "[invalid token]" in row["path"] and row["status"] in (200, 201):
            return "pass"
        if "[invalid token]" in row["path"] and row["status"] == 401:
            return "soft_token_fail"
        return "fail"

    for row in rows:
        row["verdict"] = classify(row)

    summary = {
        "pass": sum(1 for r in rows if r["verdict"] == "pass"),
        "expected_auth": sum(1 for r in rows if r["verdict"] == "expected_auth"),
        "fail": sum(1 for r in rows if r["verdict"] in ("fail", "soft_token_fail")),
        "soft_token_ok": soft_map["status"] in (200, 201) and soft_posts["status"] in (200, 201),
        "total": len(rows),
    }

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": BASE,
        "frontend_base": FRONT,
        "summary": summary,
        "failures": [r for r in rows if r["verdict"] in ("fail", "soft_token_fail")],
        "rows": rows,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"summary": summary, "failures": report["failures"], "out": str(OUT)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
