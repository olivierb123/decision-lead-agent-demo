"""One-off script: export src/data/raw/salesPerformance.js's 5 rows (hand-ported
below, same rationale as scripts/seed_search_index.py — not worth a build step
for this little data) to a CSV for manual upload into the Fabric Lakehouse.

Run manually, once, after the Fabric workspace + Lakehouse exist:

    python scripts/export_sales_performance_csv.py

Then in the Fabric portal: open the Lakehouse -> Get data -> Upload files,
upload the generated sales_performance.csv, and use "Load to tables" to create
a `SalesPerformance` Delta table from it.
"""

from __future__ import annotations

import csv
import os

# Hand-ported from src/data/raw/salesPerformance.js — keep the two files in sync if rows change.
SALES_PERFORMANCE_ROWS = [
    {
        "fiscalYear": "FY26",
        "fiscalQuarter": "Q1",
        "month": "Jul",
        "territory": "West",
        "segment": "Mid-Market",
        "seller": "Dana Whitfield",
        "revenue": 152000,
        "quota": 175000,
        "variancePct": -13.1,
    },
    {
        "fiscalYear": "FY26",
        "fiscalQuarter": "Q1",
        "month": "Jul",
        "territory": "Central",
        "segment": "Enterprise",
        "seller": "Marcus Cole",
        "revenue": 398000,
        "quota": 380000,
        "variancePct": 4.7,
    },
    {
        "fiscalYear": "FY26",
        "fiscalQuarter": "Q1",
        "month": "Aug",
        "territory": "South",
        "segment": "Mid-Market",
        "seller": "Priya Nandan",
        "revenue": 61000,
        "quota": 90000,
        "variancePct": -32.2,
    },
    {
        "fiscalYear": "FY26",
        "fiscalQuarter": "Q1",
        "month": "Aug",
        "territory": "West",
        "segment": "Mid-Market",
        "seller": "Dana Whitfield",
        "revenue": 168000,
        "quota": 175000,
        "variancePct": -4.0,
    },
    {
        "fiscalYear": "FY26",
        "fiscalQuarter": "Q1",
        "month": "Sep",
        "territory": "Central",
        "segment": "Enterprise",
        "seller": "Marcus Cole",
        "revenue": 405000,
        "quota": 380000,
        "variancePct": 6.6,
    },
]

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "sales_performance.csv")


def main() -> None:
    fieldnames = list(SALES_PERFORMANCE_ROWS[0].keys())
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(SALES_PERFORMANCE_ROWS)
    print(f"Wrote {len(SALES_PERFORMANCE_ROWS)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
