import csv
import hashlib
import io
import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import seed_decision_demo as seed


class DecisionDemoSeedTests(unittest.TestCase):
    def dataset(self, as_of="2026-10-15"):
        return seed.build_dataset(as_of, generated_at=datetime(2026, 10, 15, 12, tzinfo=timezone.utc))

    def test_complete_comparable_sales_window_and_exact_totals(self):
        dataset = self.dataset()
        rows = dataset["sales_performance"]
        self.assertEqual(len(rows), 42)
        self.assertEqual(len({row["recordId"] for row in rows}), 42)
        for territory, _, _, revenue, quota in seed.TERRITORIES:
            selected = [row for row in rows if row["territory"] == territory]
            self.assertEqual(len({row["businessDate"] for row in selected}), 14)
            self.assertEqual(sum(row["revenue"] for row in selected), Decimal(revenue))
            self.assertEqual(sum(row["quota"] for row in selected), Decimal(quota))
            self.assertEqual({row["reportingPeriodStart"] for row in selected}, {"2026-10-01"})
            self.assertEqual({row["reportingPeriodEnd"] for row in selected}, {"2026-10-14"})
        self.assertEqual({row["fiscalYear"] for row in rows}, {"FY27"})
        self.assertEqual({row["fiscalQuarter"] for row in rows}, {"Q2"})

    def test_effective_date_is_not_generation_time_and_all_rows_are_labelled(self):
        dataset = self.dataset()
        for row in dataset["sales_performance"] + dataset["decision_opportunities"]:
            self.assertTrue(row["isSynthetic"])
            self.assertEqual(row["dataClassification"], "SYNTHETIC_DEMO")
            self.assertEqual(row["effectiveAt"], "2026-10-14T23:59:59Z")
            self.assertEqual(row["generatedAt"], "2026-10-15T12:00:00Z")
            self.assertTrue(row["sourceId"].startswith("decision-demo:"))
        self.assertEqual(dataset, self.dataset())

    def test_opportunities_preserve_unknowns_and_contact_pause(self):
        rows = self.dataset()["decision_opportunities"]
        self.assertEqual(len(rows), 6)
        self.assertEqual(len({row["opportunityId"] for row in rows}), 6)
        self.assertTrue(all(row["accountName"].endswith("(synthetic)") for row in rows))
        unknown = next(row for row in rows if row["entityMatch"] == "unverified")
        self.assertIsNone(unknown["accountId"])
        self.assertIsNone(unknown["opportunityAmount"])
        self.assertIsNone(unknown["meetingRequested"])
        pause = next(row for row in rows if row["outreachPauseUntil"])
        self.assertGreater(datetime.fromisoformat(pause["outreachPauseUntil"]), datetime(2026, 10, 15, tzinfo=timezone.utc))

    def test_month_boundaries_and_leap_days_do_not_create_future_rows(self):
        for as_of in ("2026-10-01", "2026-10-02", "2026-07-05", "2024-03-01", "2026-01-01"):
            with self.subTest(as_of=as_of):
                dataset = self.dataset(as_of)
                rows = dataset["sales_performance"]
                expected_days = dataset["manifest"]["territoryTotals"][0]["days"]
                self.assertEqual(len(rows), expected_days * 3)
                self.assertEqual(len({row["month"] for row in rows}), 1)
                self.assertTrue(all(date.fromisoformat(row["businessDate"]) < date.fromisoformat(as_of) for row in rows))
        self.assertEqual(self.dataset("2024-03-01")["manifest"]["reportingPeriodEnd"], "2024-02-29")

    def test_future_dates_invalid_versions_and_naive_timestamps_are_rejected(self):
        with self.assertRaises(ValueError):
            self.dataset("2026-10-16")
        for version in ("../existing", "/tmp/other", "", "not a version"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                seed.build_dataset("2026-10-15", version)
        with self.assertRaises(ValueError):
            seed.build_dataset("2026-10-15", generated_at=datetime(2026, 10, 15))

    def test_csv_round_trip_and_manifest_hashes(self):
        dataset = self.dataset()
        with tempfile.TemporaryDirectory() as temporary:
            folder = seed.write_bundle(dataset, Path(temporary) / "new_bundle")
            manifest = json.loads((folder / "manifest.json").read_text())
            for filename, info in manifest["files"].items():
                content = (folder / filename).read_bytes()
                self.assertEqual(hashlib.sha256(content).hexdigest(), info["sha256"])
                rows = list(csv.DictReader(io.StringIO(content.decode("utf-8"))))
                self.assertEqual(len(rows), info["rows"])
                self.assertTrue(all(row["isSynthetic"] == "true" for row in rows))
            fields = list(csv.DictReader(io.StringIO((folder / "sales_performance.csv").read_text())).fieldnames)
            self.assertEqual(fields[:9], ["fiscalYear", "fiscalQuarter", "month", "territory", "segment", "seller", "revenue", "quota", "variancePct"])
            unknown = next(row for row in csv.DictReader(io.StringIO((folder / "decision_opportunities.csv").read_text())) if row["entityMatch"] == "unverified")
            self.assertEqual(unknown["meetingRequested"], "")
            self.assertEqual(unknown["opportunityAmount"], "")

    def test_existing_output_and_legacy_files_are_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            existing = root / "sales_performance.csv"
            existing.write_text("Existing demo data\n")
            folder = root / "decision_demo" / "v1"
            seed.write_bundle(self.dataset(), folder)
            before = (folder / "sales_performance.csv").read_bytes()
            with self.assertRaises(FileExistsError):
                seed.write_bundle(self.dataset(), folder)
            self.assertEqual((folder / "sales_performance.csv").read_bytes(), before)
            self.assertEqual(existing.read_text(), "Existing demo data\n")

    def test_missing_lakehouse_fails_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            missing = Path(temporary) / "missing"
            with patch.object(seed, "FABRIC_FILES_ROOT", missing), self.assertRaises(FileNotFoundError):
                seed.run()
            self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()