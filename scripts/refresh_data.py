"""Run independent refresh jobs and publish a machine-readable status report."""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_FILE = ROOT / "data" / "status.json"
TEMP_SOURCE_STATUS = ROOT / "data" / ".csv-status.tmp.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_previous_status() -> dict:
    try:
        value = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def latest_retrieval(path: Path) -> str | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload if isinstance(payload, list) else [payload]
        dates = [str(row["retrieved_at"]) for row in rows if isinstance(row, dict) and row.get("retrieved_at")]
        return max(dates, key=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00"))) if dates else None
    except (OSError, json.JSONDecodeError, TypeError, ValueError, KeyError):
        return None


def write_status(value: dict) -> None:
    temp_file = STATUS_FILE.with_suffix(".json.tmp")
    temp_file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_file.replace(STATUS_FILE)


def print_process_output(text: str, stream) -> None:
    for line in text.rstrip().splitlines():
        # Prevent fetched-page text from being interpreted as a GitHub Actions command.
        print((" " if line.startswith("::") else "") + line, file=stream)


def main() -> int:
    now = utc_now()
    previous = read_previous_status()
    components = previous.get("components", {})
    if not isinstance(components, dict):
        components = {}
    for key, snapshot in {
        "bls": ROOT / "data" / "bls_metro_2025.json",
        "macro": ROOT / "data" / "macro.json",
        "canada": ROOT / "data" / "canada_wages.json",
    }.items():
        component = components.get(key)
        if not isinstance(component, dict):
            component = {}
            components[key] = component
        if not component.get("last_success"):
            component["last_success"] = latest_retrieval(snapshot)

    jobs = [
        ("bls", "Refresh U.S. BLS salary snapshot", "scripts/update_bls.py", True),
        ("canada", "Refresh Statistics Canada occupation wages", "scripts/update_canada.py", True),
        ("salary_csv", "Merge official salary snapshots and refresh configured public CSV sources", "scripts/update_data.py", True),
        ("macro", "Refresh FX and purchasing power data", "scripts/update_macro.py", True),
    ]
    failed = False
    blocked = False
    csv_sources = {}
    for key, label, script, configured in jobs:
        prior = components.get(key, {}) if isinstance(components.get(key), dict) else {}
        state = {**prior, "checked_at": now}
        if not configured:
            state.update({"status": "not_configured", "message": "No public CSV sources are configured."})
            components[key] = state
            csv_sources = {}
            print(f"{label}: no sources configured")
            continue

        if key == "salary_csv":
            TEMP_SOURCE_STATUS.unlink(missing_ok=True)
        print(f"::group::{label}")
        result = subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT, text=True, capture_output=True)
        if key == "salary_csv" and TEMP_SOURCE_STATUS.exists():
            try:
                parsed = json.loads(TEMP_SOURCE_STATUS.read_text(encoding="utf-8"))
                csv_sources = parsed if isinstance(parsed, dict) else {}
            except (OSError, json.JSONDecodeError):
                csv_sources = {}
            finally:
                TEMP_SOURCE_STATUS.unlink(missing_ok=True)
        if result.stdout:
            print_process_output(result.stdout, sys.stdout)
        if result.stderr:
            print_process_output(result.stderr, sys.stderr)
        print("::endgroup::")
        state["last_attempt"] = now
        if result.returncode == 0:
            state.update({"status": "success", "last_success": now, "message": "Refresh completed."})
            print(f"{label}: success")
        elif key == "bls" and result.returncode == 3:
            blocked = True
            state.update({"status": "blocked", "message": "Robots policy disallows this dataset; the previous snapshot was retained."})
            print(f"::warning title={label}::Robots policy disallows this dataset; the previous snapshot was retained.")
        else:
            failed = True
            state.update({"status": "failed", "message": "Refresh failed; see the GitHub Actions run log."})
            print(f"::error title={label}::Refresh failed; see this GitHub Actions run log.")
        components[key] = state

    all_configured_succeeded = all(
        components.get(key, {}).get("status") in {"success", "not_configured"}
        for key, _, _, _ in jobs
    )
    last_successful_run = previous.get("last_successful_run")
    if all_configured_succeeded:
        last_successful_run = now
    status = {
        "schema_version": 1,
        "checked_at": now,
        "last_successful_run": last_successful_run,
        "run_status": "partial_failure" if failed else "completed_with_warnings" if blocked else "success",
        "components": components,
        "csv_sources": csv_sources,
    }
    write_status(status)
    print(f"Refresh status written to {STATUS_FILE.relative_to(ROOT)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
