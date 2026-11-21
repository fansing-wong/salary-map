"""Import the latest published NOC wage aggregates from Statistics Canada's WDS."""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "canada_wages.json"
TABLE_ID = 14100426
WDS = "https://www150.statcan.gc.ca/t1/wds/rest"
TABLE_URL = "https://www150.statcan.gc.ca/n1/en/catalogue/1410042601"
UA = "SalaryMapResearchBot/1.0 (+https://github.com/fansing-wong/salary-map)"
GEO_NAMES = {
    "canada", "newfoundland and labrador", "prince edward island", "nova scotia",
    "new brunswick", "quebec", "ontario", "manitoba", "saskatchewan", "alberta",
    "british columbia",
}


def request_json(url: str, payload: list[dict] | None = None) -> object:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def dimension(metadata: dict, fragment: str) -> dict:
    matches = [item for item in metadata.get("dimension", []) if fragment in item.get("dimensionNameEn", "").lower()]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one Statistics Canada dimension containing {fragment!r}; found {len(matches)}")
    return matches[0]


def member_label(member: dict) -> str:
    return str(member.get("memberNameEn", "")).strip()


def choose_member(members: list[dict], *, exact: str | None = None, patterns: tuple[str, ...] = ()) -> dict:
    labels = [(member, member_label(member).lower()) for member in members]
    if exact:
        matches = [member for member, label in labels if label == exact.lower()]
        if len(matches) == 1:
            return matches[0]
    for pattern in patterns:
        matches = [member for member, label in labels if re.search(pattern, label)]
        if len(matches) == 1:
            return matches[0]
    available = sorted(label for _, label in labels)
    raise RuntimeError(f"Cannot safely select Statistics Canada dimension member; candidates: {available[:40]}")


def occupation_members(dim: dict) -> list[dict]:
    members = dim.get("member", [])
    parent_ids = {str(item.get("parentMemberId")) for item in members if item.get("parentMemberId") is not None}
    selected = []
    for item in members:
        label = member_label(item)
        code = str(item.get("classificationCode") or "")
        if not code:
            match = re.search(r"\[([0-9]+)\]\s*$", label)
            code = match.group(1) if match else ""
        if str(item.get("memberId")) in parent_ids or not code.isdigit():
            continue
        if not label or label.lower().startswith(("total", "all occupations")):
            continue
        item["_salary_map_code"] = code
        selected.append(item)
    if not selected:
        raise RuntimeError("Statistics Canada NOC metadata has no terminal occupation groups")
    return selected


def coordinates(metadata: dict) -> list[dict]:
    geo = dimension(metadata, "geography")
    wages = dimension(metadata, "wage")
    work = dimension(metadata, "type of work")
    gender = dimension(metadata, "gender")
    age = dimension(metadata, "age group")
    occupation = dimension(metadata, "occupation")
    geo_members = [item for item in geo.get("member", []) if member_label(item).lower() in GEO_NAMES]
    if len(geo_members) != len(GEO_NAMES):
        raise RuntimeError(f"Statistics Canada geography metadata coverage changed; expected {len(GEO_NAMES)}, found {len(geo_members)}")
    wage_member = choose_member(wages.get("member", []), exact="Average weekly wage rate")
    work_member = choose_member(work.get("member", []), patterns=(r"^both full- and part-time employees$", r"^total employees, all wages$", r"^total employees.*all wages"))
    gender_member = choose_member(gender.get("member", []), patterns=(r"^both sexes$", r"^total\s*-?\s*gender$", r"^total$"))
    age_member = choose_member(age.get("member", []), patterns=(r"^15 years and over$", r"^15 years and older$", r"^total\s*-?\s*age group$"))
    occupations = occupation_members(occupation)
    dims = metadata.get("dimension", [])
    fixed = {
        int(wages["dimensionPositionId"]): wage_member,
        int(work["dimensionPositionId"]): work_member,
        int(gender["dimensionPositionId"]): gender_member,
        int(age["dimensionPositionId"]): age_member,
    }
    geo_pos = int(geo["dimensionPositionId"])
    occupation_pos = int(occupation["dimensionPositionId"])
    result = []
    for geo_member in geo_members:
        for occ_member in occupations:
            values = {**fixed, geo_pos: geo_member, occupation_pos: occ_member}
            coord = ".".join(str(values[position]["memberId"]) if position in values else "0" for position in range(1, 11))
            result.append({
                "productId": TABLE_ID,
                "coordinate": coord,
                "latestN": 1,
                "geo": member_label(geo_member),
                "occupation": member_label(occ_member),
                "occupation_code": occ_member["_salary_map_code"],
            })
    return result


def fetch_latest(series: list[dict]) -> list[dict]:
    result = []
    for offset in range(0, len(series), 50):
        batch = series[offset:offset + 50]
        requests = [{"productId": row["productId"], "coordinate": row["coordinate"], "latestN": row["latestN"]} for row in batch]
        response = request_json(f"{WDS}/getDataFromCubePidCoordAndLatestNPeriods", requests)
        if not isinstance(response, list):
            raise RuntimeError("Statistics Canada WDS returned an unexpected coordinate response")
        for item in response:
            if item.get("status") != "SUCCESS" or not isinstance(item.get("object"), dict):
                continue
            obj = item["object"]
            points = obj.get("vectorDataPoint", [])
            if not points:
                continue
            point = points[-1]
            try:
                weekly_wage = float(str(point.get("value", "")).replace(",", ""))
            except ValueError:
                continue
            if weekly_wage <= 0:
                continue
            requested = next((row for row in batch if row["coordinate"] == obj.get("coordinate")), None)
            if requested is None:
                continue
            result.append({**requested, "weekly_wage": weekly_wage, "date": point.get("refPer") or point.get("refPerRaw")})
    return result


def write_json_atomic(rows: list[dict]) -> None:
    temporary = OUT.with_suffix(OUT.suffix + ".tmp")
    temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUT)


def main() -> None:
    metadata_response = request_json(f"{WDS}/getCubeMetadata", [{"productId": TABLE_ID}])
    if not isinstance(metadata_response, list) or not metadata_response or metadata_response[0].get("status") != "SUCCESS":
        raise RuntimeError("Statistics Canada WDS did not return table metadata")
    metadata = metadata_response[0].get("object")
    if not isinstance(metadata, dict):
        raise RuntimeError("Statistics Canada WDS metadata has no table object")
    raw_rows = fetch_latest(coordinates(metadata))
    if not raw_rows:
        raise RuntimeError("Statistics Canada WDS returned no usable occupation wage observations; preserving the last snapshot")
    now = datetime.now(timezone.utc).isoformat()
    output = []
    for item in raw_rows:
        geo = item["geo"]
        is_country = geo.lower() == "canada"
        output.append({
            "country": "加拿大", "iso3": "CAN", "city": "全国" if is_country else geo,
            "admin1": None if is_country else geo, "geo_level": "country" if is_country else "admin1",
            "role": item["occupation"], "occupation_code": item["occupation_code"],
            "occupation_taxonomy": "NOC 2021 (Statistics Canada LFS aggregate)", "currency": "CAD",
            "salary_monthly": round(item["weekly_wage"] * 52 / 12, 2), "cost_monthly": None,
            "contract_hours_weekly": None, "overtime_hours_weekly": None, "commute_hours_weekly": None,
            "intensity": None, "source_url": TABLE_URL,
            "source_name": "Statistics Canada · Employee wages by occupation",
            "reference_period": item["date"], "retrieved_at": now, "data_type": "official_statistic",
            "statistic": "mean_weekly_wage_monthly_equivalent", "gross_net": "gross",
            "source_note": f"官方平均周工资按 52/12 折算月等值；职业为劳动调查 NOC 汇总组（{item['occupation_code']}），并非细分职业工资。统计表未提供本行的合同工时、生活成本或劳动强度。",
        })
    write_json_atomic(output)
    print(f"Imported {len(output)} Statistics Canada latest occupation-region observations")


if __name__ == "__main__":
    main()
