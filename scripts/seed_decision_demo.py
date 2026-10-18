"""Generate isolated synthetic CSV inputs from a Fabric PySpark notebook.

Attach a default Lakehouse, upload this script under Files, then run:
    import runpy
    seed = runpy.run_path('/lakehouse/default/Files/seed_decision_demo.py')
    seed['run'](as_of='2026-10-15')

CSV-backed import semantic models must be connected/refreshed separately.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any


DEMO_AS_OF_DATE = "2026-10-15"
DATASET_VERSION = "v1"
FABRIC_FILES_ROOT = Path("/lakehouse/default/Files")
TERRITORIES = (
    ("Central", "Enterprise", "Marcus Cole", 300000, 350000),
    ("South", "Mid-Market", "Priya Nandan", 110000, 210000),
    ("West", "Mid-Market", "Dana Whitfield", 210000, 200000),
)


def iso_utc(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("A timezone-aware generation timestamp is required")
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def allocate_money(total: int, count: int) -> list[Decimal]:
    cents, remainder = divmod(total * 100, count)
    return [Decimal(cents + (1 if index < remainder else 0)) / 100 for index in range(count)]


def build_dataset(as_of: str, version: str = DATASET_VERSION, generated_at: datetime | None = None) -> dict[str, Any]:
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,39}", version):
        raise ValueError("Version must be a short lowercase identifier, not a path")
    generated_at = generated_at if generated_at is not None else datetime.now(timezone.utc)
    generated_timestamp = iso_utc(generated_at)
    demo_date = date.fromisoformat(as_of)
    if demo_date > generated_at.astimezone(timezone.utc).date():
        raise ValueError("The demo date cannot be in the future")
    end = demo_date - timedelta(days=1)
    start = max(end.replace(day=1), end - timedelta(days=13))
    dates = [start + timedelta(days=index) for index in range((end - start).days + 1)]
    effective = iso_utc(datetime.combine(end, time(23, 59, 59), timezone.utc))
    source_id = f"decision-demo:{version}:{demo_date.isoformat()}"
    period_label = f"{start.isoformat()} through {end.isoformat()} (synthetic complete {len(dates)}-day window)"
    common = {
        "datasetVersion": version, "isSynthetic": True, "dataClassification": "SYNTHETIC_DEMO",
        "reportingPeriodStart": start.isoformat(), "reportingPeriodEnd": end.isoformat(),
        "reportingPeriodLabel": period_label, "effectiveAt": effective, "generatedAt": generated_timestamp,
    }
    sales = []
    for territory, segment, seller, revenue, quota in TERRITORIES:
        revenues, quotas = allocate_money(revenue, len(dates)), allocate_money(quota, len(dates))
        for index, business_date in enumerate(dates):
            fiscal_month = (business_date.month - 7) % 12
            sales.append({
                "fiscalYear": f"FY{(business_date.year + (business_date.month >= 7)) % 100:02d}",
                "fiscalQuarter": f"Q{fiscal_month // 3 + 1}",
                "month": ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")[business_date.month - 1],
                "territory": territory, "segment": segment, "seller": seller,
                "revenue": revenues[index], "quota": quotas[index],
                "variancePct": ((revenues[index] - quotas[index]) / quotas[index] * 100).quantize(Decimal("0.1")),
                "recordId": f"SALES-{territory.upper()}-{business_date.isoformat()}",
                "businessDate": business_date.isoformat(), "sourceId": f"{source_id}:sales:{territory}:{business_date.isoformat()}",
                **common,
            })
    cases = (
        ("001", "Apex Design & Build", "West", 76000, True, False, "verified", None,
         "Buyer requested a crew-dispatch demo this week; existing project-management suite stays in place."),
        ("002", "Coastal Grade & Pave", "South", 158000, True, False, "verified", demo_date + timedelta(days=7),
         "Customer explicitly paused sales contact. Territory shortfall does not override this request."),
        ("003", "Summit Ridge Builders", "Central", 210000, False, True, "verified", None,
         "Buyer requires climate-aware scheduling and full enterprise project-management replacement; current fit is not established."),
        ("004", "Apex Construction Services", "West", None, None, None, "unverified", None,
         "Similar-name permit applicant only. No verified customer match, software budget, or buying intent."),
        ("005", "Harbor Works", "Central", 145000, False, None, "verified", None,
         "Multi-site rollout under discussion; budget owner, required integrations, and purchasing date remain unconfirmed."),
        ("006", "Cedar Field Services", "South", 42000, True, False, "verified", None,
         "Smaller dispatch-only expansion; operations buyer requested a remote meeting. No documented contact restriction."),
    )
    opportunities = []
    for suffix, name, territory, amount, meeting, unavailable, match, pause, context in cases:
        opportunities.append({
            "opportunityId": f"DEMO-OPP-{suffix}", "accountId": f"DEMO-ACCOUNT-{suffix}" if match == "verified" else None,
            "accountName": f"{name} (synthetic)", "territory": territory,
            "opportunityAmount": amount, "meetingRequested": meeting,
            "requiresUnavailableCapability": unavailable, "entityMatch": match,
            "outreachPauseUntil": iso_utc(datetime.combine(pause, time.min, timezone.utc)) if pause else None,
            "buyingContext": context, "sourceId": f"{source_id}:opportunity:{suffix}", **common,
        })
    manifest = {
        "schemaVersion": 1, "datasetVersion": version, "isSynthetic": True, "asOfDate": demo_date.isoformat(),
        "generatedAt": generated_timestamp, "effectiveAt": effective, "reportingPeriodLabel": period_label,
        "reportingPeriodStart": start.isoformat(), "reportingPeriodEnd": end.isoformat(),
        "fiscalCalendar": "Fiscal year ends June 30; July 2026 is FY27 Q1. This is an explicit demo calendar.",
        "grain": "One sales row per territory per calendar day, including zero/non-working days; SUM revenue and quota once per reporting window.",
        "territoryTotals": [{"territory": territory, "revenue": revenue, "quota": quota, "days": len(dates)}
                            for territory, _, _, revenue, quota in TERRITORIES],
        "limitations": [
            "All companies, seller activity, financial amounts, and buying signals are synthetic scenarios, not customer records.",
            "generatedAt is file generation time, NOT a semantic-model refresh or independent verification timestamp.",
            "The reporting window is complete; it is not a complete fiscal quarter or necessarily a full month.",
            "Opportunity records are not consumed by the current territory-only live adapter.",
            "Web hazards, account geography, and product-document dates are not fabricated by this generator.",
        ],
    }
    return {"sales_performance": sales, "decision_opportunities": opportunities, "manifest": manifest}


def csv_text(rows: list[dict[str, Any]]) -> str:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    for row in rows:
        writer.writerow({name: str(value).lower() if type(value) is bool else value for name, value in row.items()})
    return output.getvalue()


def write_bundle(dataset: dict[str, Any], output_dir: Path) -> Path:
    output_dir = Path(output_dir)
    payloads = {f"{name}.csv": csv_text(dataset[name]).encode("utf-8") for name in ("sales_performance", "decision_opportunities")}
    manifest = {**dataset["manifest"], "files": {
        name: {"rows": len(dataset[Path(name).stem]), "sha256": hashlib.sha256(content).hexdigest()}
        for name, content in payloads.items()
    }}
    output_dir.mkdir(parents=True, exist_ok=False)
    for name, content in payloads.items():
        with (output_dir / name).open("xb") as handle:
            handle.write(content)
    with (output_dir / "manifest.json").open("x", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    return output_dir


def run(as_of: str = DEMO_AS_OF_DATE, version: str = DATASET_VERSION) -> Path:
    if not FABRIC_FILES_ROOT.is_dir():
        raise FileNotFoundError("Attach a default Lakehouse to this Fabric PySpark notebook and restart its session before running.")
    dataset = build_dataset(as_of, version)
    output_dir = FABRIC_FILES_ROOT / "decision_demo" / version / dataset["manifest"]["asOfDate"]
    try:
        write_bundle(dataset, output_dir)
    except FileExistsError as error:
        raise FileExistsError(f"Refusing to overwrite {output_dir}. Choose a new version for a new bundle.") from error
    print(f"Wrote synthetic demo bundle: {output_dir}")
    print(dataset["manifest"]["reportingPeriodLabel"])
    for item in dataset["manifest"]["territoryTotals"]:
        print(f"{item['territory']}: revenue ${item['revenue']:,}; quota ${item['quota']:,}; {item['days']} complete days")
    print("Import/reconnect the CSVs into a separate semantic model, verify field types and totals, then configure the Data agent.")
    print("Existing files, tables, semantic models, and agents have NOT been modified.")
    return output_dir


if __name__ == "__main__":
    run()