"""Import selected occupations from Statistics Canada's monthly wage table."""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "canada_wages.json"
TABLE_ID = "14100426"
API_URL = f"https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/{TABLE_ID}/en"
TABLE_URL = "https://www150.statcan.gc.ca/n1/en/catalogue/1410042601"
UA = "SalaryMapResearchBot/1.0 (+https://github.com/fansing-wong/salary-map)"

OCCUPATIONS = [
    ("软件开发人员", "21232", re.compile(r"software developers? and programmers?", re.I)),
    ("注册护士", "31301", re.compile(r"registered nurses? and registered psychiatric nurses?", re.I)),
    ("数据科学家", "21211", re.compile(r"data scientists?", re.I)),
    ("零售销售员", "64100", re.compile(r"retail salespersons?", re.I)),
]


def get_bytes(url: str, accept: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def write_json_atomic(path: Path, rows: list[dict]) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def find_column(headers: list[str], key: str) -> str | None:
    normalized = {header.strip().lower(): header for header in headers}
    if key in normalized:
        return normalized[key]
    if key == "occupation":
        return next((header for header in headers if "occupational classification" in header.strip().lower()), None)
    return next((header for header in headers if header.strip().lower().startswith(key)), None)


def choose_work_type(values: set[str]) -> str | None:
    normalized = {value.strip().lower(): value for value in values}
    preferences = (
        "total employees (all wages)",
        "all employees (all wages)",
        "full-time and part-time",
        "total employees",
        "total",
    )
    for preferred in preferences:
        for normalized_value, original in normalized.items():
            if preferred == normalized_value:
                return original
    if len(values) == 1:
        return next(iter(values))
    return None


def parse_table(payload: bytes) -> list[dict]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv") and "meta" not in name.lower()]
        if not csv_names:
            raise RuntimeError("Statistics Canada archive did not contain a data CSV")
        text = archive.read(csv_names[0]).decode("utf-8-sig", "replace")

    records = list(csv.reader(io.StringIO(text)))
    header_index = next((i for i, row in enumerate(records) if {cell.strip().upper() for cell in row}.issuperset({"REF_DATE", "GEO", "VALUE"})), None)
    if header_index is None:
        raise RuntimeError("Cannot find the expected REF_DATE/GEO/VALUE columns in the Statistics Canada CSV")
    headers = [cell.strip() for cell in records[header_index]]
    columns = {key: find_column(headers, key) for key in ("ref_date", "geo", "occupation", "wages", "type of work", "gender", "age group", "value", "status")}
    required = ("ref_date", "geo", "occupation", "wages", "value")
    missing = [key for key in required if not columns[key]]
    if missing:
        raise RuntimeError(f"Statistics Canada table is missing expected fields: {missing}")

    candidates: dict[tuple[str, str], list[dict]] = {}
    work_types: set[str] = set()
    for raw in records[header_index + 1:]:
        if len(raw) < len(headers):
            continue
        row = dict(zip(headers, raw))
        wage_label = row.get(columns["wages"], "").strip().lower()
        if "average weekly wage rate" not in wage_label:
            continue
        if columns["gender"] and row.get(columns["gender"], "").strip().lower() not in {"both sexes", "total - gender", "total"}:
            continue
        if columns["age group"] and row.get(columns["age group"], "").strip().lower() not in {"15 years and over", "15 years and older", "total - age group"}:
            continue
        occupation_text = row.get(columns["occupation"], "").strip()
        match = next((item for item in OCCUPATIONS if item[2].search(occupation_text)), None)
        if not match:
            continue
        geo = row.get(columns["geo"], "").strip()
        if not geo:
            continue
        work_type = row.get(columns["type of work"], "").strip() if columns["type of work"] else ""
        if work_type:
            work_types.add(work_type)
        raw_value = row.get(columns["value"], "").strip().replace(",", "")
        try:
            weekly_wage = float(raw_value)
        except ValueError:
            continue
        if weekly_wage <= 0:
            continue
        status = row.get(columns["status"], "").strip().lower() if columns["status"] else ""
        if status and status not in {"a", "e"}:
            continue
        candidates.setdefault((geo, match[0]), []).append({
            "date": row.get(columns["ref_date"], "").strip(),
            "geo": geo,
            "role": match[0],
            "code": match[1],
            "weekly_wage": weekly_wage,
            "work_type": work_type,
        })

    selected_type = choose_work_type(work_types)
    if work_types and selected_type is None:
        raise RuntimeError(f"Cannot safely select one total-work category from: {sorted(work_types)}")

    now = datetime.now(timezone.utc).isoformat()
    output = []
    for (_, _), options in candidates.items():
        if selected_type:
            options = [item for item in options if item["work_type"] == selected_type]
        if not options:
            continue
        latest_date = max(item["date"] for item in options)
        item = next(record for record in options if record["date"] == latest_date)
        geo = item["geo"]
        is_country = geo.strip().lower() in {"canada", "total, canada"}
        output.append({
            "country": "加拿大",
            "iso3": "CAN",
            "city": "全国" if is_country else geo,
            "admin1": None if is_country else geo,
            "geo_level": "country" if is_country else "admin1",
            "role": item["role"],
            "occupation_code": item["code"],
            "occupation_taxonomy": "NOC 2021",
            "currency": "CAD",
            "salary_monthly": round(item["weekly_wage"] * 52 / 12, 2),
            "cost_monthly": None,
            "contract_hours_weekly": None,
            "overtime_hours_weekly": None,
            "commute_hours_weekly": None,
            "intensity": None,
            "source_url": TABLE_URL,
            "source_name": "Statistics Canada · Employee wages by occupation",
            "reference_period": item["date"],
            "retrieved_at": now,
            "data_type": "official_statistic",
            "statistic": "mean_weekly_wage_monthly_equivalent",
            "gross_net": "gross",
            "source_note": f"官方平均周工资按 52/12 折算月等值，保留原平均周工资口径；不代表调查直接发布的月薪。筛选口径：{selected_type or '官方表格唯一工作类别'}。",
        })
    if not output:
        raise RuntimeError("Statistics Canada import produced zero matching records; refusing to replace the last snapshot")
    return output


def main() -> None:
    api = json.loads(get_bytes(API_URL, "application/json").decode("utf-8"))
    if api.get("status") != "SUCCESS" or not isinstance(api.get("object"), str):
        raise RuntimeError("Statistics Canada WDS did not return a CSV download link")
    rows = parse_table(get_bytes(api["object"], "application/zip,text/csv;q=0.9,*/*;q=0.1"))
    write_json_atomic(OUT, rows)
    print(f"Imported {len(rows)} Statistics Canada occupation-region records")


if __name__ == "__main__":
    main()
