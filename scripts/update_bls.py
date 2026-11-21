"""Import BLS May 2025 metropolitan OEWS estimates into the common dataset."""
from __future__ import annotations
import io, json, urllib.robotparser, urllib.request, zipfile
from datetime import datetime, timezone
from pathlib import Path
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parents[1]
URL="https://www.bls.gov/oes/special.requests/oesm25ma.zip"
UA="SalaryMapResearchBot/1.0 (public labor statistics; https://github.com/fansing-wong/salary-map)"
SOC={"15-1252":"软件开发人员","29-1141":"注册护士","15-2051":"数据科学家","41-2031":"零售销售员"}

def write_json_atomic(path: Path, value: object) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)

def download():
    robots_url="https://www.bls.gov/robots.txt"
    rp=urllib.robotparser.RobotFileParser(robots_url)
    robots_request=urllib.request.Request(robots_url,headers={"User-Agent":UA})
    try:
        with urllib.request.urlopen(robots_request,timeout=20) as response:
            rp.parse(response.read().decode("utf-8","replace").splitlines())
    except Exception as exc:
        if getattr(exc,"code",None)==403:
            print("BLS refresh skipped: robots.txt access is denied; preserving the last snapshot without requesting salary data.")
            return 3
        raise RuntimeError(f"Cannot verify BLS robots.txt within the network timeout: {exc}") from exc
    if not rp.can_fetch(UA,URL): raise RuntimeError("BLS robots.txt disallows this dataset")
    req=urllib.request.Request(URL,headers={"User-Agent":UA,"Accept":"application/zip"})
    with urllib.request.urlopen(req,timeout=90) as response: return response.read()

def main():
    try:
        payload=download()
    except RuntimeError as exc:
        if "robots.txt disallows this dataset" in str(exc):
            print("BLS refresh skipped: robots.txt disallows this dataset; preserving the last snapshot.")
            return 3
        raise
    archive=zipfile.ZipFile(io.BytesIO(payload))
    xlsx_name=next((n for n in archive.namelist() if n.lower().endswith(".xlsx")),None)
    if not xlsx_name: raise RuntimeError("BLS archive did not contain an XLSX workbook")
    workbook=load_workbook(io.BytesIO(archive.read(xlsx_name)),read_only=True,data_only=True)
    sheet=workbook[workbook.sheetnames[0]]
    rows=sheet.iter_rows(values_only=True)
    header_row=None
    for row in rows:
        normalized=[str(v).strip().upper() if v is not None else "" for v in row]
        if "AREA_TITLE" in normalized and "OCC_CODE" in normalized:
            header_row=normalized; break
    if header_row is None: raise RuntimeError("Cannot find BLS workbook header row")
    index={name:i for i,name in enumerate(header_row)}
    required={"AREA_TITLE","OCC_CODE","OCC_TITLE","O_GROUP","A_MEDIAN"}
    if not required.issubset(index): raise RuntimeError(f"BLS workbook lacks expected columns: {sorted(required-set(index))}")
    output=[]; now=datetime.now(timezone.utc).isoformat()
    for row in rows:
        if len(row)<len(header_row): continue
        area=str(row[index["AREA_TITLE"]] or "").strip()
        code=str(row[index["OCC_CODE"]] or "").strip()
        group=str(row[index["O_GROUP"]] or "").strip().lower()
        naics=str(row[index["NAICS"]] or "").strip() if "NAICS" in index else "000000"
        if code not in SOC or group not in {"detailed","detail"} or naics not in {"000000","0",""}: continue
        raw=row[index["A_MEDIAN"]]
        try: annual=float(str(raw).replace(",",""))
        except (TypeError,ValueError): continue
        if annual<=0 or not area: continue
        output.append({"country":"美国","iso3":"USA","city":area,"admin1":None,"geo_level":"metro","role":SOC[code],"occupation_code":code,"occupation_taxonomy":"SOC 2018","currency":"USD","salary_monthly":round(annual/12,2),"cost_monthly":None,"contract_hours_weekly":40,"overtime_hours_weekly":0,"commute_hours_weekly":0,"intensity":None,"source_url":URL,"source_name":"U.S. Bureau of Labor Statistics (BLS) OEWS","reference_period":"May 2025","retrieved_at":now,"data_type":"official_statistic","statistic":"median_annual_wage","gross_net":"gross","source_note":"年薪按年薪/12换算月薪；实际时薪仅为40小时标准周、无加班/通勤的基线估算。BLS表不提供城市生活成本、通勤、加班或岗位强度。"})
    workbook.close()
    if not output: raise RuntimeError("BLS import produced zero records; refusing to replace published data")
    path=ROOT/"data"/"bls_metro_2025.json"
    if path.exists():
        old=json.loads(path.read_text(encoding="utf-8"))
        old_by_key={(r.get("city"),r.get("occupation_code")):r for r in old}
        for row in output:
            prior=old_by_key.get((row["city"],row["occupation_code"]))
            if prior and prior.get("salary_monthly")==row["salary_monthly"]:
                row["retrieved_at"]=prior.get("retrieved_at",now)
    write_json_atomic(path, output)
    print(f"Imported {len(output)} BLS metro occupation rows")

if __name__=="__main__": raise SystemExit(main() or 0)
