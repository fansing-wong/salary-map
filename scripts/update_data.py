"""Fetch explicitly configured public CSV sources and normalize rows.

This intentionally does not discover targets or scrape social-network pages.
"""
from __future__ import annotations
import csv, json, os, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "scripts" / "sources.json"
OUTPUT = ROOT / "data" / "latest.json"
UA = "SalaryMapResearchBot/1.0 (+https://github.com; contact repository maintainers)"
REQUIRED = {"country", "city", "role", "currency", "salary_monthly", "cost_monthly", "contract_hours_weekly", "overtime_hours_weekly", "commute_hours_weekly", "intensity"}

def can_fetch(url: str) -> bool:
    parts = urlparse(url)
    robots = f"{parts.scheme}://{parts.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots)
    try:
        req = Request(robots, headers={"User-Agent": UA})
        with urlopen(req, timeout=20) as res:
            parser.parse(res.read().decode("utf-8", "replace").splitlines())
        return parser.can_fetch(UA, url)
    except Exception as exc:
        raise RuntimeError(f"Cannot verify robots.txt for {parts.netloc}: {exc}") from exc

def fetch(source: dict) -> list[dict]:
    url = source["url"]
    if not can_fetch(url):
        raise RuntimeError(f"robots.txt disallows source: {url}")
    headers = {"User-Agent": UA, "Accept": "text/csv,application/octet-stream;q=0.9,*/*;q=0.1"}
    cache_file = ROOT / "data" / ".http-cache.json"
    cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
    prior = cache.get(url, {})
    if prior.get("etag"): headers["If-None-Match"] = prior["etag"]
    if prior.get("last_modified"): headers["If-Modified-Since"] = prior["last_modified"]
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as res:
            body = res.read().decode("utf-8-sig")
            cache[url] = {"etag": res.headers.get("ETag"), "last_modified": res.headers.get("Last-Modified")}
    except Exception as exc:
        if getattr(exc, "code", None) == 304 and prior.get("rows"):
            return prior["rows"]
        raise
    time.sleep(max(1, float(source.get("delay_seconds", 2))))
    rows = list(csv.DictReader(body.splitlines()))
    mapping = source.get("columns", {})
    out = []
    for raw in rows:
        row = {target: raw.get(mapping.get(target, target), "").strip() for target in REQUIRED}
        if not row["role"] or not row["currency"]: continue
        for key in REQUIRED - {"country", "city", "role", "currency"}:
            row[key] = float(row[key] or 0)
        if not 1 <= row["intensity"] <= 5: raise ValueError("intensity must be 1..5")
        row.update({"source_url": url, "source_name": source["name"], "reference_period": source["reference_period"], "retrieved_at": datetime.now(timezone.utc).isoformat(), "data_type": source.get("data_type", "official_statistic"), "statistic": source.get("statistic", "median"), "gross_net": source.get("gross_net", "gross")})
        out.append(row)
    cache[url]["rows"] = out
    cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return out

def main():
    sources = json.loads(REGISTRY.read_text(encoding="utf-8"))
    rows = []
    for source in sources:
        rows.extend(fetch(source))
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {OUTPUT}")

if __name__ == "__main__": main()
