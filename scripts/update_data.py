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
STATUS_FILE = ROOT / "data" / "status.json"
TEMP_SOURCE_STATUS = ROOT / "data" / ".csv-status.tmp.json"
BLS_DATA = ROOT / "data" / "bls_metro_2025.json"
CHINA_DATA = ROOT / "data" / "china_nbs_2025.json"
CHINA_LOCAL_DATA = ROOT / "data" / "china_local_wages_2025.json"
SHENZHEN_MARKET_DATA = ROOT / "data" / "shenzhen_market_wages_2024.json"
CHINA_EAST_DATA = ROOT / "data" / "china_east_regions_2025.json"
CANADA_DATA = ROOT / "data" / "canada_wages.json"
AUSTRALIA_DATA = ROOT / "data" / "australia_abs_2025.json"
UA = "SalaryMapResearchBot/1.0 (+https://github.com; contact repository maintainers)"
REQUIRED = {"country", "city", "role", "currency", "salary_monthly", "cost_monthly", "contract_hours_weekly", "overtime_hours_weekly", "commute_hours_weekly", "intensity"}
OPTIONAL = {"iso3", "admin1", "geo_level", "occupation_code", "occupation_taxonomy", "source_note"}
TEXT_FIELDS = {"country", "city", "role", "currency", "iso3", "admin1", "geo_level", "occupation_code", "occupation_taxonomy", "source_note"}

def write_json_atomic(path: Path, value: object) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)

def cached_rows(url: str) -> list[dict]:
    cache_file = ROOT / "data" / ".http-cache.json"
    try:
        cache = json.loads(cache_file.read_text(encoding="utf-8"))
        rows = cache.get(url, {}).get("rows", [])
        return rows if isinstance(rows, list) else []
    except (OSError, json.JSONDecodeError, AttributeError):
        return []

def previously_published_rows(url: str) -> list[dict]:
    try:
        published = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return [row for row in published if isinstance(row, dict) and row.get("source_url") == url]
    except (OSError, json.JSONDecodeError, TypeError):
        return []

def prior_source_status() -> dict:
    try:
        status = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
        sources = status.get("csv_sources", {})
        return sources if isinstance(sources, dict) else {}
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}

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
        row = {target: (raw.get(mapping.get(target, target), "") or "").strip() for target in REQUIRED | OPTIONAL}
        if not row["role"] or not row["currency"]: continue
        for key in (REQUIRED | OPTIONAL) - TEXT_FIELDS:
            row[key] = float(row[key]) if row[key] else None
        if row["salary_monthly"] is None: continue
        if row["intensity"] is not None and not 1 <= row["intensity"] <= 5: raise ValueError("intensity must be 1..5")
        row.update({"source_url": url, "source_name": source["name"], "reference_period": source["reference_period"], "retrieved_at": datetime.now(timezone.utc).isoformat(), "data_type": source.get("data_type", "official_statistic"), "statistic": source.get("statistic", "median"), "gross_net": source.get("gross_net", "gross")})
        out.append(row)
    cache[url]["rows"] = out
    cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return out

def china_east_rows() -> list[dict]:
    """Normalize East China region, city and industry wage snapshots for latest.json."""
    if not CHINA_EAST_DATA.exists():
        return []
    data = json.loads(CHINA_EAST_DATA.read_text(encoding="utf-8"))
    rows = []
    existing_headline = set()
    if CHINA_LOCAL_DATA.exists():
        try:
            local_rows = json.loads(CHINA_LOCAL_DATA.read_text(encoding="utf-8"))
            existing_headline = {
                (row.get("city"), row.get("role")) for row in local_rows
                if isinstance(row, dict) and str(row.get("role", "")).startswith("所有行业单位平均工资（")
            }
        except (OSError, json.JSONDecodeError, TypeError):
            pass

    def append_wage(location: str, admin1: str | None, geo_level: str, population: str,
                    annual: int, source_url: str, source_name: str, source_note: str,
                    role_prefix: str = "所有行业单位平均工资") -> None:
        code = {
            "城镇非私营单位": "URBAN_NON_PRIVATE",
            "城镇私营单位": "URBAN_PRIVATE",
            "全口径城镇单位（社保缴费基数口径）": "FULL_COVERAGE_SOCIAL_INSURANCE_BASE",
        }.get(population, "")
        rows.append({
            "country": "中国", "city": location, "admin1": admin1, "geo_level": geo_level,
            "role": f"{role_prefix}（{population}）", "currency": "CNY",
            "salary_monthly": round(annual / 12, 2), "salary_annual": annual,
            "cost_monthly": None, "contract_hours_weekly": None,
            "overtime_hours_weekly": None, "commute_hours_weekly": None, "intensity": None,
            "iso3": "CHN", "occupation_code": code or "INDUSTRY_AVERAGE",
            "occupation_taxonomy": "中国国家统计局劳动工资统计分类",
            "source_url": source_url, "source_name": source_name,
            "source_note": source_note + " 月等值为年工资/12，不是个人到手月薪或实际时薪。",
            "reference_period": str(data.get("reference_period", "2025")),
            "retrieved_at": data.get("retrieved_at"), "data_type": "official_statistic",
            "statistic": "mean", "gross_net": "gross",
        })

    for item in data.get("headline_wages", []):
        role = f"所有行业单位平均工资（{item['population']}）"
        if (item["location"], role) in existing_headline:
            continue
        append_wage(item["location"], item["location"], item.get("geo_level", "admin1"),
                    item["population"], int(item["salary_annual_2025"]), item["source_url"],
                    item["source_name"], item.get("source_note", ""))
    for item in data.get("anhui_city_wages", []):
        append_wage(item["location"], "安徽省", "city", "城镇非私营单位",
                    int(item["salary_annual_2025"]),
                    "https://tjj.huainan.gov.cn/public/118319859/1261028126.html",
                    "安徽省统计局《2025年安徽省城镇非私营单位就业人员年平均工资》",
                    "地级市城镇非私营单位税前人均均值；不代表具体岗位。")
    for item in data.get("jiangsu_focus_city_wages", []):
        append_wage(item["location"], item.get("admin1", "江苏省"), "city", item["population"],
                    int(item["salary_annual_2025"]), item["source_url"], item["source_name"],
                    item.get("source_note", "江苏重点城市单位工资税前均值；不代表具体岗位。"))
    for item in data.get("guangdong_subregions", []):
        append_wage(item["location"], "广东省", "macroregion", item["salary_population"],
                    int(item["salary_annual_2025"]),
                    "https://stats.gd.gov.cn/tjkx185/content/post_4917310.html",
                    "广东省统计局《2025年广东城镇单位就业人员年平均工资情况》",
                    "片区为多市合并的统计区域，税前人均均值；不代表片区内任一城市或岗位。")
    for table in data.get("industry_tables", []):
        for industry, groups in table.get("values", {}).items():
            for population, annual in groups.items():
                if annual is None:
                    continue
                append_wage(table["location"], table["location"], "admin1", population,
                            int(annual), table["source_url"], table["source_name"],
                            f"{table['location']} {industry}行业税前人均均值；按行业门类统计，不等于具体职业offer。",
                            role_prefix=industry)
    return rows

def main():
    sources = json.loads(REGISTRY.read_text(encoding="utf-8"))
    rows = []
    for snapshot in (BLS_DATA, CHINA_DATA, CHINA_LOCAL_DATA, SHENZHEN_MARKET_DATA, CHINA_EAST_DATA, CANADA_DATA, AUSTRALIA_DATA):
        if snapshot.exists():
            if snapshot == CHINA_EAST_DATA:
                rows.extend(china_east_rows())
            else:
                rows.extend(json.loads(snapshot.read_text(encoding="utf-8")))
    source_status = {}
    previous_sources = prior_source_status()
    any_failed = False
    for source in sources:
        key = str(source.get("id") or source["name"])
        prior = previous_sources.get(key, {})
        checked_at = datetime.now(timezone.utc).isoformat()
        try:
            source_rows = fetch(source)
            if not source_rows:
                raise RuntimeError("Source produced no valid records; retaining the previous snapshot")
            rows.extend(source_rows)
            source_status[key] = {"name": source["name"], "status": "success", "last_attempt": checked_at, "last_success": checked_at, "records": len(source_rows)}
        except Exception as exc:
            any_failed = True
            fallback_rows = cached_rows(source["url"]) or previously_published_rows(source["url"])
            rows.extend(fallback_rows)
            source_status[key] = {"name": source["name"], "status": "failed", "last_attempt": checked_at, "last_success": prior.get("last_success"), "records": len(fallback_rows), "message": "Refresh failed; previous cached records were retained."}
            print(f"Source {source['name']} failed; retained {len(fallback_rows)} cached records: {exc}")
    TEMP_SOURCE_STATUS.write_text(json.dumps(source_status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not rows and OUTPUT.exists():
        print("No sources returned rows; keeping previous published salary data")
        if any_failed:
            raise RuntimeError("One or more configured salary sources failed")
        return
    write_json_atomic(OUTPUT, rows)
    print(f"Wrote {len(rows)} rows to {OUTPUT}")
    if any_failed:
        raise RuntimeError("One or more configured salary sources failed")

if __name__ == "__main__": main()
