"""Refresh FX rates and World Bank household consumption price levels."""
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "macro.json"
UA = "SalaryMapResearchBot/1.0 (+https://github.com/fansing-wong/salary-map)"
COUNTRIES = {"SGP": "SGD", "USA": "USD", "GBR": "GBP", "CAN": "CAD"}
WB_URL = "https://api.worldbank.org/v2/country/{}/indicator/PA.NUS.PRVT.PLI?format=json&per_page=100"
ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,application/xml"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()

def main():
    xml = ET.fromstring(get(ECB_URL))
    ns = {"gesmes": "http://www.gesmes.org/xml/2002-08-01", "e": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"}
    day = xml.find(".//e:Cube/e:Cube", ns)
    if day is None:
        raise RuntimeError("ECB response did not contain daily rates")
    eur_rates = {node.attrib["currency"]: float(node.attrib["rate"]) for node in day.findall("e:Cube", ns)}
    eur_rates["EUR"] = 1.0
    if "USD" not in eur_rates:
        raise RuntimeError("ECB response missing USD rate")
    # Convert one local-currency unit into USD through the EUR reference rates.
    fx_to_usd = {currency: eur_rates["USD"] / eur_rates[currency] for currency in set(COUNTRIES.values()) if currency in eur_rates}
    fx_to_usd["EUR"] = eur_rates["USD"]
    price_levels = {}
    for iso3 in COUNTRIES:
        payload = json.loads(get(WB_URL.format(iso3)))
        observations = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
        latest = next((row for row in observations if row.get("value") is not None), None)
        if latest:
            price_levels[iso3] = {"value": latest["value"], "year": latest["date"], "source_url": f"https://api.worldbank.org/v2/country/{iso3}/indicator/PA.NUS.PRVT.PLI"}
    if not price_levels:
        raise RuntimeError("World Bank returned no household consumption price levels")
    OUT.write_text(json.dumps({"retrieved_at": datetime.now(timezone.utc).isoformat(), "fx_date": day.attrib.get("time"), "fx_source": ECB_URL, "fx_to_usd": fx_to_usd, "price_level_base": "USA=100", "price_level_indicator": "PA.NUS.PRVT.PLI", "price_levels": price_levels, "price_level_source": "https://data.worldbank.org/indicator/PA.NUS.PRVT.PLI"}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote macro indicators for {len(price_levels)} countries to {OUT}")

if __name__ == "__main__": main()
