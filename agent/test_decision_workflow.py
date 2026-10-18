import json
import asyncio
import importlib.util
import hashlib
from pathlib import Path
import subprocess
import sys
import types
import unittest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, Mock, patch

from decision_workflow import run_comparison
from decision_policy import prepare_snapshot, rules_runner, validate_recommendations, validate_implementation_plan
from decision_models import HostedModels, token_cost, combine_chat_usage
from decision_sources import LiveSources, prepare_live_snapshot, read_response
from decision_records import StoredSnapshots, VARIANTS, build_record


def fixture(variant="base"):
    output = subprocess.check_output(
        ["node", "--input-type=module", "-e", "import {buildComparisonSnapshot} from './src/data/decisionScenarios.js'; console.log(JSON.stringify(buildComparisonSnapshot(process.argv[1])))", variant],
        cwd=Path(__file__).resolve().parents[1], text=True,
    )
    return json.loads(output)


class StoredSnapshotTests(unittest.IsolatedAsyncioTestCase):
    def test_original_versioned_records_are_unchanged(self):
        original = {
            "base": "19cb7df4a238c06a980753f9cc73b675561f8f04617f0f228af474ee0caa2ff5",
            "summit-fit": "766769ea8724e9ee5c5447e04fcd7403e9a59518fca73a469bc5d2e2c8144f7f",
            "coastal-remote": "dac52b5a1351e2bf1290514f7fd652d9bd2ce7713931455fde8d2cf6af1a18fd",
            "stale-context": "bc6dd8c67d9f86ca341c32c6baa6979a96a35c055114395ba37f9bf1ec1ba82b",
            "source-failure": "1bb05d252c15e3a60c0329607dbd42bdf49c6e0a2db3a3342dc1397a85c81bc1",
            "deadline-vs-value": "afd268f9140a9ecd09cd7f586cd88b1f207cdc7d8c66dd2739cd26322bf4bebc",
            "discovery-vs-readiness": "8a236cec501f857d253f601c285eb10599ee6eb72fe6d8f4ad8f37d89d59c411",
        }
        self.assertEqual({variant: build_record(variant)["sha256"] for variant in original}, original)

    def setUp(self):
        self.settings = {"DECISION_RECORDS_SEARCH_ENDPOINT": "https://demo.search.windows.net",
                         "DECISION_RECORDS_SEARCH_INDEX": "decision-demo-snapshots-v1"}

    async def test_every_retrieved_variant_is_identical_to_the_original_fixture(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant), patch.dict("os.environ", self.settings):
                record = build_record(variant)
                transport = AsyncMock(return_value=record)
                actual, provenance = await StoredSnapshots(transport).read(variant)
                expected = fixture(variant)
                self.assertEqual(actual, expected)
                self.assertEqual(prepare_snapshot(actual), prepare_snapshot(expected))
                self.assertEqual(await rules_runner(prepare_snapshot(actual)), await rules_runner(prepare_snapshot(expected)))
                self.assertNotIn("observedAt", actual)
                self.assertEqual(provenance["sha256"], record["sha256"])
                self.assertEqual(provenance["provider"], "Azure AI Search")
                transport.assert_awaited_once()

    async def test_corrupt_wrong_or_unlabeled_records_are_rejected(self):
        for field, value in (("content", "{}"), ("id", "other-record"), ("variant", "summit-fit"),
                             ("isSynthetic", False), ("dataClassification", "LIVE")):
            with self.subTest(field=field), patch.dict("os.environ", self.settings):
                record = {**build_record("base"), field: value}
                with self.assertRaises(ValueError):
                    await StoredSnapshots(AsyncMock(return_value=record)).read("base")

    async def test_retrieval_failure_never_substitutes_the_local_fixture(self):
        with patch.dict("os.environ", self.settings):
            with self.assertRaises(RuntimeError):
                await StoredSnapshots(AsyncMock(side_effect=RuntimeError("Unavailable"))).read("base")

    async def test_a_self_consistent_but_different_snapshot_is_rejected(self):
        record = build_record("base")
        snapshot = json.loads(record["content"])
        snapshot["candidates"][0]["opportunityAmount"] += 1
        record = {**record, "content": json.dumps(snapshot)}
        record["sha256"] = hashlib.sha256(record["content"].encode()).hexdigest()
        with patch.dict("os.environ", self.settings), self.assertRaisesRegex(ValueError, "canonical fixture"):
            await StoredSnapshots(AsyncMock(return_value=record)).read("base")

    async def test_unknown_variants_and_non_search_endpoints_are_rejected_before_retrieval(self):
        for endpoint, variant in ((self.settings["DECISION_RECORDS_SEARCH_ENDPOINT"], "../base"),
                                  ("https://example.test", "base"), ("http://demo.search.windows.net", "base")):
            with self.subTest(endpoint=endpoint, variant=variant), patch.dict("os.environ", {
                    **self.settings, "DECISION_RECORDS_SEARCH_ENDPOINT": endpoint}):
                transport = AsyncMock()
                with self.assertRaises(ValueError):
                    await StoredSnapshots(transport).read(variant)
                transport.assert_not_awaited()


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_readers_execute_once_and_feed_one_shared_snapshot(self):
        called = []

        async def read_source(state):
            called.append(state["question"])
            return {"status": "available", "text": "Retrieved from the configured source"}

        async def runner(state):
            self.assertEqual(len(state["sourceResults"]), 3)
            self.assertNotIn("synthetic", json.dumps(state))
            return {"status": "ok"}

        result = await run_comparison(
            {"evidenceMode": "live", "question": "Where should we prospect?"},
            dict.fromkeys(("rules", "llm", "decision1"), runner),
            source_readers=dict.fromkeys(("Fabric IQ", "Web IQ", "Foundry IQ"), read_source),
        )
        self.assertEqual(len(called), 3)
        self.assertEqual(result["evidenceMode"], "live")
        self.assertEqual(len({item["snapshotId"] for item in result["branches"].values()}), 1)
        self.assertEqual(result["snapshot"]["sourceResults"]["Fabric IQ"]["status"], "available")

    async def test_comparison_branches_execute_concurrently(self):
        ready, calls = asyncio.Event(), []

        async def runner(snapshot):
            calls.append(True)
            if len(calls) == 3:
                ready.set()
            await ready.wait()
            return {"status": "ok"}

        await asyncio.wait_for(run_comparison({}, dict.fromkeys(("rules", "llm", "decision1"), runner)), timeout=5)
        self.assertEqual(len(calls), 3)

    async def test_compare_uses_isolated_copies_of_one_snapshot(self):
        seen = []

        async def runner(snapshot):
            seen.append(snapshot["value"])
            snapshot["value"] = "changed"
            return {"status": "ok"}

        snapshot = {"value": "original"}
        result = await run_comparison(snapshot, dict.fromkeys(("rules", "llm", "decision1"), runner))
        self.assertEqual(seen, ["original"] * 3)
        self.assertEqual(snapshot, {"value": "original"})
        self.assertEqual(set(result["branches"]), {"rules", "llm", "decision1"})
        self.assertEqual(len({item["snapshotId"] for item in result["branches"].values()}), 1)

    async def test_selected_mode_runs_only_one_branch(self):
        called = []

        async def runner(snapshot):
            called.append("rules")
            return {"status": "ok"}

        result = await run_comparison({}, {"rules": runner}, "rules")
        self.assertEqual(called, ["rules"])
        self.assertEqual(list(result["branches"]), ["rules"])

    async def test_missing_config_and_errors_are_not_predictions(self):
        async def broken(snapshot):
            raise ValueError("secret details")

        result = await run_comparison({}, {"rules": broken})
        self.assertEqual(result["branches"]["rules"]["status"], "error")
        self.assertNotIn("secret details", str(result))
        self.assertEqual(result["branches"]["decision1"]["status"], "unavailable")


class PolicyTests(unittest.IsolatedAsyncioTestCase):
    async def test_deadline_evidence_is_invisible_to_the_fixed_formula(self):
        control = await rules_runner(prepare_snapshot(fixture("summit-fit")))
        tradeoff = await rules_runner(prepare_snapshot(fixture("deadline-vs-value")))
        self.assertEqual(tradeoff, control)
        self.assertEqual(tradeoff["selectedIds"], ["DEMO-SUMMIT", "DEMO-APEX"])

    async def test_discovery_invitation_is_not_a_readiness_check_in_the_rules(self):
        state = prepare_snapshot(fixture("discovery-vs-readiness"))
        result = await rules_runner(state)
        self.assertEqual(result["selectedIds"], ["DEMO-APEX", "DEMO-SUMMIT"])
        actions = {item["candidateId"]: item["action"] for item in result["suggestions"]}
        self.assertEqual(actions, {"DEMO-APEX": "outreach", "DEMO-SUMMIT": "outreach",
                                   "DEMO-COASTAL": "defer", "DEMO-UNVERIFIED": "cannot_tell"})
        self.assertEqual(state["rubric"], prepare_snapshot(fixture())["rubric"])

    async def test_graph_rejects_model_policy_violation_without_breaking_other_branches(self):
        async def violates_policy(state):
            result = await rules_runner(state)
            result["suggestions"][1]["action"] = "outreach"
            return result

        result = await run_comparison(fixture(), {"rules": rules_runner, "llm": violates_policy},
                                      prepare=prepare_snapshot, validate=validate_recommendations)
        self.assertEqual(result["branches"]["rules"]["status"], "ok")
        self.assertEqual(result["branches"]["llm"]["status"], "invalid")
        self.assertNotIn("selectedIds", result["branches"]["llm"])

    async def test_policy_is_applied_in_the_full_maf_graph(self):
        result = await run_comparison(fixture(), {"rules": rules_runner}, prepare=prepare_snapshot, validate=validate_recommendations)
        self.assertEqual(result["branches"]["rules"]["status"], "ok")
        self.assertEqual(result["policies"]["DEMO-COASTAL"]["allowedActions"], ["defer", "cannot_tell"])

    async def test_rules_respect_pause_and_entity_and_exclude_them_from_selection(self):
        result = await rules_runner(prepare_snapshot(fixture()))
        actions = {item["candidateId"]: item["action"] for item in result["suggestions"]}
        self.assertEqual(actions, {"DEMO-APEX": "outreach", "DEMO-COASTAL": "defer",
                                   "DEMO-SUMMIT": "research", "DEMO-UNVERIFIED": "cannot_tell"})
        self.assertEqual(result["selectedIds"], ["DEMO-APEX", "DEMO-SUMMIT"])

    async def test_changed_evidence_changes_rules_without_changing_weather(self):
        original, changed = fixture(), fixture("coastal-remote")
        self.assertEqual(original["candidates"][1]["evidence"][1], changed["candidates"][1]["evidence"][1])
        result = await rules_runner(prepare_snapshot(changed))
        self.assertEqual(result["selectedIds"][0], "DEMO-COASTAL")
        result = await rules_runner(prepare_snapshot(fixture("summit-fit")))
        self.assertEqual(result["selectedIds"][0], "DEMO-SUMMIT")

    async def test_failed_and_stale_sources_force_review(self):
        result = await rules_runner(prepare_snapshot(fixture("source-failure")))
        self.assertEqual(result["selectedIds"], [])
        self.assertTrue(all(item["action"] == "cannot_tell" for item in result["suggestions"]))
        state = prepare_snapshot(fixture("stale-context"))
        self.assertIn("STALE_EVIDENCE", state["candidates"][0]["policy"]["reasonCodes"])

    async def test_invalid_model_output_is_rejected_not_silently_repaired(self):
        state = prepare_snapshot(fixture())
        result = await rules_runner(state)
        result["suggestions"][1]["action"] = "outreach"
        checked = validate_recommendations(result, state)
        self.assertEqual(checked["status"], "invalid")
        self.assertNotIn("selectedIds", checked)

    async def test_bad_dates_labels_citations_and_duplicate_ids_are_rejected(self):
        for mutate in (
            lambda state: state.update(expectedAction="outreach"),
            lambda state: state.update(asOf="2026-10-15T12:00:00"),
            lambda state: state["candidates"][1].update(candidateId="DEMO-APEX"),
            lambda state: state["candidates"][0]["evidence"][0].update(effectiveAt="2027-01-01T00:00:00Z"),
        ):
            state = fixture()
            mutate(state)
            with self.assertRaises(ValueError):
                prepare_snapshot(state)
        state = prepare_snapshot(fixture())
        result = await rules_runner(state)
        result["suggestions"][0]["evidenceIds"] = ["invented"]
        self.assertEqual(validate_recommendations(result, state)["status"], "invalid")


class ModelAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_decision_api_contract_with_stubbed_transport(self):
        calls = []

        async def transport(endpoint, body):
            calls.append((endpoint, body))
            answers = {}
            for name, question in body["questions"].items():
                answers[name] = {"type": question["type"], **({"choice": "research"} if question["type"] == "choice" else {"score": 1.5})}
            return {"answers": answers, "model": "test-double", "usage": {"input_tokens": 200, "output_tokens": 0}}

        with patch.dict("os.environ", {"DECISION1_ENDPOINT": "https://example.services.ai.azure.com", "DECISION1_DEPLOYMENT": "deployment-name"}, clear=True):
            models = HostedModels(transport)
            self.assertEqual(list(models.configured_runners()), ["decision1"])
            state = prepare_snapshot(fixture())
            state["rubric"] = "Snapshot-specific research rubric"
            state["scope"] = "territory-prospecting"
            result = validate_recommendations(await models.decision1(state), state)
        self.assertEqual(result["status"], "ok")
        self.assertTrue(calls[0][0].endswith("/providers/microsoft/v1/systemone"))
        self.assertEqual(calls[0][1]["model"], "deployment-name")
        self.assertEqual(len(calls[0][1]["questions"]), 4)
        for question in calls[0][1]["questions"].values():
            self.assertIn(state["rubric"], question["instructions"])
            if question["type"] == "score":
                self.assertEqual(question["criteria"][-1], "High research priority")
        self.assertNotIn("expectedAction", json.dumps(calls))

    async def test_llm_contract_and_missing_config(self):
        state = prepare_snapshot(fixture())
        state["rubric"] = "Snapshot-specific research rubric"
        expected = await rules_runner(state)

        async def transport(endpoint, body):
            self.assertTrue(endpoint.endswith("/openai/v1/chat/completions"))
            self.assertEqual(body["response_format"]["type"], "json_schema")
            self.assertIn(state["rubric"], body["messages"][0]["content"])
            eligible = [item for item in expected["suggestions"] if item["action"] in ("outreach", "research")]
            return {"choices": [{"message": {"content": json.dumps({"suggestions": eligible})}}], "model": "test-double"}

        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(HostedModels().configured_runners(), {})
        with patch.dict("os.environ", {"LLM_ENDPOINT": "https://example.openai.azure.com", "LLM_DEPLOYMENT": "test"}, clear=True):
            result = await HostedModels(transport).llm(state)
        self.assertEqual(validate_recommendations(result, state)["status"], "ok")

    async def test_both_hosted_methods_skip_calls_when_all_candidates_are_gated(self):
        async def unexpected_call(endpoint, body):
            self.fail("No hosted call should be needed for a fully excluded snapshot")

        state = prepare_snapshot(fixture("source-failure"))
        models = HostedModels(unexpected_call)
        for runner in (models.llm, models.decision1):
            result = validate_recommendations(await runner(state), state)
            self.assertEqual(result["status"], "ok")
            self.assertEqual(result["selectedIds"], [])
            self.assertEqual(result["inferenceCostUsd"], 0)

    async def test_cost_is_unknown_without_the_required_rates(self):
        usage = {"prompt_tokens": 4000, "completion_tokens": 250}
        with patch.dict("os.environ", {}, clear=True):
            self.assertIsNone(token_cost(usage, "LLM"))
        with patch.dict("os.environ", {"LLM_INPUT_USD_PER_MILLION": "2.5", "LLM_OUTPUT_USD_PER_MILLION": "10"}, clear=True):
            self.assertEqual(token_cost(usage, "LLM"), 0.0125)
            usage["prompt_tokens_details"] = {"cached_tokens": 500}
            self.assertIsNone(token_cost(usage, "LLM"))

    async def test_cached_input_is_discounted_once_not_double_counted(self):
        settings = {"LLM_INPUT_USD_PER_MILLION": "2.5", "LLM_OUTPUT_USD_PER_MILLION": "10",
                    "LLM_CACHED_INPUT_USD_PER_MILLION": "1.25"}
        with patch.dict("os.environ", settings, clear=True):
            for input_key, output_key, details_key in (("prompt_tokens", "completion_tokens", "prompt_tokens_details"),
                                                       ("input_tokens", "output_tokens", "input_tokens_details")):
                usage = {input_key: 4000, output_key: 250, details_key: {"cached_tokens": 500}}
                self.assertEqual(token_cost(usage, "LLM"), 0.011875)
            self.assertEqual(token_cost({"prompt_tokens": 4000, "completion_tokens": 250,
                                         "prompt_tokens_details": {"cached_tokens": 4000}}, "LLM"), 0.0075)

    async def test_invalid_pricing_or_usage_does_not_break_model_results(self):
        settings = {"LLM_INPUT_USD_PER_MILLION": "2.5", "LLM_OUTPUT_USD_PER_MILLION": "10",
                    "LLM_CACHED_INPUT_USD_PER_MILLION": "1.25"}
        usage = {"prompt_tokens": 4000, "completion_tokens": 250}
        for invalid in ("invalid", "NaN", "inf", "-1", ""):
            with self.subTest(rate=invalid), patch.dict("os.environ", {**settings, "LLM_INPUT_USD_PER_MILLION": invalid}, clear=True):
                self.assertIsNone(token_cost(usage, "LLM"))
        with patch.dict("os.environ", settings, clear=True):
            for invalid in (-1, 4001, True, "500", None):
                with self.subTest(cached_tokens=invalid):
                    self.assertIsNone(token_cost({**usage, "prompt_tokens_details": {"cached_tokens": invalid}}, "LLM"))
            self.assertIsNone(token_cost({**usage, "completion_tokens": True}, "LLM"))
            self.assertIsNone(token_cost({**usage, "prompt_tokens_details": [500]}, "LLM"))

    async def test_decision_input_only_estimate_and_zero_usage(self):
        with patch.dict("os.environ", {"DECISION1_INPUT_USD_PER_MILLION": "0.20"}, clear=True):
            self.assertEqual(token_cost({"input_tokens": 2500, "output_tokens": 4}, "DECISION1"), 0.0005)
            self.assertEqual(token_cost({"input_tokens": 0, "output_tokens": 0}, "DECISION1"), 0)


class PlanningTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.state = prepare_snapshot(fixture("reasoned-rollout"))
        self.plan = {
            "candidateId": "DEMO-SUMMIT",
            "phases": [
                {"id": "security", "startDate": "2026-10-16", "finishDate": "2026-10-19"},
                {"id": "migration", "startDate": "2026-10-20", "finishDate": "2026-10-21"},
                {"id": "training", "startDate": "2026-10-22", "finishDate": "2026-10-22"},
            ],
            "totalCostUsd": 23200, "remainingBudgetUsd": 300, "meetsDeadline": True,
            "evidenceIds": ["DEMO-SUMMIT-BUYING", "DEMO-ROLLOUT-CONSTRAINTS"],
        }

    def test_valid_plan_is_independently_checked_without_entering_model_state(self):
        self.assertEqual(validate_implementation_plan(self.plan, self.state)["status"], "valid")
        self.assertTrue(validate_implementation_plan(self.plan, self.state)["feasible"])
        self.assertNotIn("implementationPlan", self.state)

    def test_honestly_infeasible_plan_is_distinct_from_incorrect_calculations(self):
        self.state["planningTask"]["deadline"] = "2026-10-21"
        self.state["planningTask"]["budgetUsd"] = 23000
        self.plan["remainingBudgetUsd"] = -200
        self.plan["meetsDeadline"] = False
        checked = validate_implementation_plan(self.plan, self.state)
        self.assertEqual(checked["status"], "valid")
        self.assertFalse(checked["feasible"])

    def test_invalid_costs_dates_order_and_citations_are_rejected(self):
        for field, value in (("totalCostUsd", 18000), ("remainingBudgetUsd", True), ("meetsDeadline", False),
                             ("evidenceIds", ["invented"]), ("candidateId", "DEMO-COASTAL"), ("phases", [])):
            with self.subTest(field=field):
                self.assertEqual(validate_implementation_plan({**self.plan, field: value}, self.state)["status"], "invalid")
        for field, value in (("startDate", "2026-10-17"), ("finishDate", "2026-10-16"),
                             ("startDate", "invalid-date"), ("id", "migration")):
            plan = json.loads(json.dumps(self.plan))
            plan["phases"][0][field] = value
            self.assertEqual(validate_implementation_plan(plan, self.state)["status"], "invalid")
        plan = json.loads(json.dumps(self.plan))
        plan["phases"][1]["startDate"] = "2026-10-19"
        self.assertEqual(validate_implementation_plan(plan, self.state)["status"], "invalid")

    async def test_decision_only_results_are_not_claimed_to_solve_the_plan(self):
        result = await rules_runner(self.state)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["planValidation"]["status"], "not_provided")
        result = validate_recommendations({**result, "implementationPlan": self.plan}, self.state)
        self.assertEqual(result["planValidation"]["status"], "valid")

    async def test_llm_requests_and_preserves_plan_only_for_the_planning_task(self):
        expected = await rules_runner(self.state)
        calls = []

        async def transport(endpoint, body):
            calls.append(body)
            if len(calls) == 1:
                self.assertEqual(body["tool_choice"]["function"]["name"], "implementation_budget")
                self.assertNotIn("response_format", body)
                return {"choices": [{"message": {"tool_calls": [{"id": "budget-test", "type": "function",
                         "function": {"name": "implementation_budget", "arguments": "{}"}}]}}],
                        "usage": {"prompt_tokens": 1000, "completion_tokens": 10, "prompt_tokens_details": {"cached_tokens": 100}}}
            schema = body["response_format"]["json_schema"]["schema"]
            self.assertIn("implementationPlan", schema["required"])
            fields = schema["properties"]["implementationPlan"]["properties"]
            self.assertIn("budget is a ceiling", fields["totalCostUsd"]["description"])
            self.assertIn("minus the calculated totalCostUsd", fields["remainingBudgetUsd"]["description"])
            self.assertIn("not private reasoning", body["messages"][0]["content"])
            self.assertEqual(json.loads(body["messages"][1]["content"]), self.state)
            self.assertEqual(body["messages"][-1]["role"], "tool")
            self.assertEqual(json.loads(body["messages"][-1]["content"])["totalCostUsd"], 23200)
            self.assertEqual(json.loads(body["messages"][-1]["content"])["remainingBudgetUsd"], 300)
            eligible = [item for item in expected["suggestions"] if item["action"] in ("research", "outreach")]
            return {"choices": [{"message": {"content": json.dumps({"suggestions": eligible, "implementationPlan": self.plan})}}],
                    "usage": {"prompt_tokens": 2000, "completion_tokens": 200, "prompt_tokens_details": {"cached_tokens": 500}}}

        with patch.dict("os.environ", {"LLM_ENDPOINT": "https://example.openai.azure.com", "LLM_DEPLOYMENT": "test",
                        "LLM_INPUT_USD_PER_MILLION": "2.5", "LLM_OUTPUT_USD_PER_MILLION": "10",
                        "LLM_CACHED_INPUT_USD_PER_MILLION": "1.25"}):
            result = validate_recommendations(await HostedModels(transport).llm(self.state), self.state)
        self.assertEqual(result["implementationPlan"], self.plan)
        self.assertEqual(result["planValidation"]["status"], "valid")
        self.assertEqual(result["toolsUsed"], ["implementation_budget"])
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["usage"]["prompt_tokens"], 3000)
        self.assertEqual(result["usage"]["completion_tokens"], 210)
        self.assertEqual(result["usage"]["prompt_tokens_details"]["cached_tokens"], 600)
        self.assertEqual(result["inferenceCostUsd"], 0.00885)

    def test_multi_call_usage_never_guesses_missing_counts(self):
        usage = {"prompt_tokens": 100, "completion_tokens": 20}
        for invalid in (None, {}, {**usage, "prompt_tokens": True},
                        {**usage, "prompt_tokens_details": {"cached_tokens": 101}}):
            self.assertIsNone(combine_chat_usage([usage, invalid]))


class LiveSourceTests(unittest.IsolatedAsyncioTestCase):
    async def test_product_prompt_requests_metadata_without_inventing_timezone(self):
        payload = {"text": "DOC-2 lastUpdated 2026-08-20 (date only; timezone unavailable).",
                   "effectiveAt": None, "references": ["DOC-2"]}

        async def transport(endpoint, body):
            prompt = body["input"]
            self.assertIn("docId, lastUpdated", prompt)
            self.assertIn("oldest verified effective timestamp", prompt)
            self.assertIn("does not establish a time or timezone", prompt)
            self.assertIn("Never infer dates from document IDs", prompt)
            return {"id": "product-date-protocol-test-double", "status": "completed", "output": [
                {"type": "message", "content": [{"type": "output_text", "text": json.dumps(payload)}]},
            ]}

        reading = await LiveSources(transport).read("Foundry IQ", "unused-test-endpoint", {"question": "What does FieldForge support?"})
        self.assertEqual(reading["data"], payload)

    async def test_synthetic_document_request_is_scoped_and_never_fills_missing_dates(self):
        for agent_name in ("foundryiq-docs-agent", "decision-foundryiq-docs-agent"):
            for source_date in (None, "2026-08-01T00:00:00Z"):
                with self.subTest(agent=agent_name, source_date=source_date):
                    endpoint = f"https://example.services.ai.azure.com/api/projects/test/agents/{agent_name}/endpoint/protocols/openai/responses?api-version=v1"
                    payload = {"text": "Original publication time is unknown.", "effectiveAt": source_date,
                               "references": ["retrieved-document-id"]}

                    async def transport(actual_endpoint, body):
                        self.assertEqual(actual_endpoint, endpoint)
                        self.assertFalse(body["stream"])
                        self.assertFalse(body["store"])
                        if agent_name == "decision-foundryiq-docs-agent":
                            for phrase in ("stored synthetic fixture effectiveAt", "unknown original publication timestamp",
                                           "both the time and timezone", "never infer UTC", "oldest stored fixture effectiveAt",
                                           "SYNTHETIC DEMO", "timestampProvenance", "Return null"):
                                self.assertIn(phrase, body["input"])
                        else:
                            self.assertNotIn("isolated synthetic decision-demo dataset", body["input"])
                        return {"id": "fixture-date-protocol-test-double", "status": "completed", "output": [
                            {"type": "message", "content": [{"type": "output_text", "text": json.dumps(payload)}]},
                        ]}

                    reading = await LiveSources(transport).read("Foundry IQ", endpoint, {"question": "What does FieldForge support?"})
                    self.assertEqual(reading["data"], payload)

    async def test_web_prompt_uses_policy_window_and_never_restamps_source_dates(self):
        from datetime import datetime, timedelta
        from decision_policy import FRESHNESS_DAYS

        for source_date in (None, "2025-02-18T17:38:16Z"):
            with self.subTest(source_date=source_date):
                async def transport(endpoint, body):
                    prompt = body["input"]
                    current = datetime.fromisoformat(prompt.split("Current UTC time: ", 1)[1].split("\n", 1)[0])
                    cutoff = datetime.fromisoformat(prompt.split("Freshness window starts: ", 1)[1].split("\n", 1)[0])
                    self.assertEqual(current - cutoff, timedelta(days=FRESHNESS_DAYS["Web IQ"]))
                    self.assertIsNotNone(current.tzinfo)
                    self.assertIn("Do not treat crawledAt", prompt)
                    self.assertIn("lastUpdatedAt", prompt)
                    self.assertIn("oldest verified source date", prompt)
                    self.assertIn("do not relabel historical information as current", prompt)
                    payload = {"text": "No verified current alert; historical background only.",
                               "effectiveAt": source_date, "references": ["https://example.test/historical"]}
                    return {"id": "web-date-protocol-test-double", "status": "completed", "output": [
                        {"type": "message", "content": [{"type": "output_text", "text": json.dumps(payload)}]},
                    ]}

                reading = await LiveSources(transport).read("Web IQ", "unused-test-endpoint", {"question": "Where should we prospect?"})
                self.assertEqual(reading["data"]["effectiveAt"], source_date)

    async def test_fabric_prompt_requests_stored_dates_and_preserves_utc_contract(self):
        payload = {
            "reportingPeriodLabel": "2026-10-01 through 2026-10-14 (synthetic complete 14-day window)",
            "territories": [{
                "territory": "South", "revenue": 110000, "quota": 210000,
                "text": "Synthetic October 1-14 coverage; stored source timestamp is UTC, displayed as 10/14/2026 11:59:59 PM.",
                "effectiveAt": "2026-10-14T23:59:59Z", "references": ["sales_performance", "decision-demo:v1:2026-10-15:sales:South"],
            }],
        }

        async def transport(endpoint, body):
            prompt = body["input"]
            for field in ("reportingPeriodStart", "reportingPeriodEnd", "reportingPeriodLabel", "businessDate", "effectiveAt", "sourceId", "isSynthetic"):
                self.assertIn(field, prompt)
            for measure in ("Total Revenue", "Total Quota", "Covered Days", "effectiveAtUTC", "First Source ID", "Last Source ID"):
                self.assertIn(measure, prompt)
            self.assertIn("Pass this question to the Fabric tool unchanged", prompt)
            self.assertIn("one summary row per territory", prompt)
            self.assertIn("Group only by territory and reporting window", prompt)
            self.assertIn("not individual sales records", prompt)
            self.assertIn("verbatim into references", prompt)
            self.assertIn("measure name alone does not verify UTC", prompt)
            self.assertIn("Never combine overlapping windows", prompt)
            self.assertIn("source's verified timezone", prompt)
            self.assertIn("Never use generatedAt", prompt)
            self.assertIn("effectiveAt null", prompt)
            self.assertIn("make a separate Fabric tool query", prompt)
            self.assertIn("MIN/MAX stored sourceId", prompt)
            self.assertIn("preserve a previously verified effectiveAt", prompt)
            self.assertIn("never fill a date that no tool result verified", prompt)
            self.assertIn("alone is not retrieved provenance", prompt)
            self.assertIn("If explicit reporting bounds are absent", prompt)
            return {"id": "source-date-protocol-test-double", "status": "completed", "output": [
                {"type": "message", "content": [{"type": "output_text", "text": json.dumps(payload)}]},
            ]}

        reading = await LiveSources(transport).read("Fabric IQ", "unused-test-endpoint", {"question": "Where should we prospect?"})
        self.assertEqual(reading["data"]["reportingPeriodLabel"], payload["reportingPeriodLabel"])
        self.assertEqual(reading["data"]["territories"][0]["effectiveAt"], "2026-10-14T23:59:59Z")
        self.assertEqual(reading["data"]["territories"][0]["references"], payload["territories"][0]["references"])

    async def test_response_contract_and_unknown_source_date_force_review(self):
        payloads = {
            "Fabric IQ": {"reportingPeriodLabel": "FY26 Q1", "territories": [{"territory": "South", "revenue": 61000, "quota": 90000,
                           "text": "Source period FY26 Q1; territory South", "effectiveAt": None, "references": ["sales_performance"]}]},
            "Web IQ": {"text": "County scope only; no verified sales-territory mapping", "effectiveAt": None, "references": ["https://example.test/alert"]},
            "Foundry IQ": {"text": "Current dispatch; roadmap is not a commitment", "effectiveAt": None, "references": ["DOC-1"]},
        }

        async def transport(endpoint, body):
            self.assertFalse(body["stream"])
            return {"id": "real-protocol-test-double", "status": "completed", "output": [{"type": "message", "content": [
                {"type": "output_text", "text": json.dumps(payloads[endpoint])}]}]}

        sources = LiveSources(transport)
        readings = {source: await sources.read(source, source, {"question": "Where should we prospect?"}) for source in payloads}
        state = prepare_live_snapshot({"question": "Where should we prospect?", "sourceResults": readings})
        self.assertEqual(state["evidenceMode"], "live")
        self.assertIsNone(state["candidates"][0]["opportunityAmount"])
        self.assertIsNone(state["candidates"][0]["buyingSignals"]["meetingRequested"])
        self.assertIn("MISSING_EFFECTIVE_DATE", state["candidates"][0]["policy"]["reasonCodes"])
        self.assertEqual((await rules_runner(state))["selectedIds"], [])
        for reading in readings.values():
            reading["data"]["effectiveAt"] = reading["observedAt"]
        readings["Fabric IQ"]["data"]["territories"][0]["effectiveAt"] = readings["Fabric IQ"]["observedAt"]
        state = prepare_live_snapshot({"question": "Where should we prospect?", "sourceResults": readings})
        self.assertEqual(state["candidates"][0]["policy"]["allowedActions"], ["research", "cannot_tell"])
        self.assertEqual((await rules_runner(state))["suggestions"][0]["action"], "research")
        self.assertAlmostEqual((await rules_runner(state))["suggestions"][0]["priority"], 0.9667)
        self.assertEqual(state["policyVersion"], "fieldforge-territory-research-v1")
        readings["Fabric IQ"]["data"]["territories"][0]["effectiveAt"] = "2026-09-30"
        state = prepare_live_snapshot({"question": "Where should we prospect?", "sourceResults": readings})
        self.assertIn("INVALID_EFFECTIVE_DATE", state["candidates"][0]["policy"]["reasonCodes"])
        self.assertEqual((await rules_runner(state))["selectedIds"], [])

    async def test_source_refusals_and_malformed_output_are_not_evidence(self):
        for response in ({"status": "failed"}, {"status": "completed", "output": []},
                         {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": "Cannot retrieve data"}]}]}):
            with self.assertRaises(ValueError):
                read_response(response)
        state = prepare_live_snapshot({"question": "Where should we prospect?", "sourceResults": dict.fromkeys(
            ("Fabric IQ", "Web IQ", "Foundry IQ"), {"status": "error", "message": "Unavailable"})})
        self.assertEqual(state["candidates"], [])
        self.assertEqual((await rules_runner(state))["selectedIds"], [])


class FabricDiagnosticTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.session = AsyncMock()
        self.session.__aenter__.return_value = self.session
        self.session.list_tools.return_value = types.SimpleNamespace(tools=[types.SimpleNamespace(
            name="query", inputSchema={"properties": {"question": {"type": "string"}}})])
        self.session.call_tool.return_value = types.SimpleNamespace(isError=False, content=[
            types.SimpleNamespace(type="text", text="sensitive retrieved data")])
        credential = Mock()
        credential.get_token.return_value = types.SimpleNamespace(token="sensitive-token")
        mcp_module = types.ModuleType("mcp")
        mcp_module.ClientSession = Mock(return_value=self.session)
        http_module = types.ModuleType("mcp.client.streamable_http")

        @asynccontextmanager
        async def transport(*args, **kwargs):
            yield None, None, None

        http_module.streamablehttp_client = transport
        spec = importlib.util.spec_from_file_location("fabric_tools", Path(__file__).with_name("fabric_tools.py"))
        self.module = importlib.util.module_from_spec(spec)
        settings = dict.fromkeys(("FABRIC_TENANT_ID", "FABRIC_CLIENT_ID", "FABRIC_CLIENT_SECRET",
                                  "FABRIC_WORKSPACE_ID", "FABRIC_DATA_AGENT_ID"), "sensitive-setting")
        with patch.dict("os.environ", settings), patch("azure.identity.ClientSecretCredential", return_value=credential), \
                patch.dict(sys.modules, {"mcp": mcp_module, "mcp.client": types.ModuleType("mcp.client"),
                                         "mcp.client.streamable_http": http_module}):
            spec.loader.exec_module(self.module)

    async def test_success_preserves_answer_without_logging_sensitive_values(self):
        with self.assertLogs("fabric_tools", level="WARNING") as logs:
            answer = await self.module.query_sales_performance("sensitive question")
        self.assertEqual(answer, "sensitive retrieved data")
        records = [json.loads(line.split("fabric_tool_diagnostic ", 1)[1]) for line in logs.output]
        self.assertEqual(len({item["diagnosticId"] for item in records}), 1)
        self.assertEqual(records[-1]["stage"], "close")
        self.assertTrue(all(item["elapsedMs"] >= 0 for item in records))
        self.assertNotIn("sensitive", "\n".join(logs.output))

    async def test_nested_timeout_returns_safe_stage_and_protocol_code(self):
        class McpTimeout(Exception):
            error = types.SimpleNamespace(code=-32001)

        self.session.call_tool.side_effect = ExceptionGroup("sensitive group", [McpTimeout("sensitive-token")])
        with self.assertLogs("fabric_tools", level="WARNING") as logs:
            failure = json.loads(await self.module.query_sales_performance("sensitive question"))
        self.assertEqual(failure["status"], "error")
        self.assertEqual(failure["stage"], "call_tool")
        self.assertEqual(failure["errorTypes"], ["McpTimeout"])
        self.assertEqual(failure["rpcCodes"], [-32001])
        self.assertNotIn("sensitive", json.dumps(failure) + "\n".join(logs.output))

    async def test_mcp_error_payload_is_not_returned_as_source_evidence(self):
        self.session.call_tool.return_value.isError = True
        with self.assertLogs("fabric_tools", level="WARNING") as logs:
            failure = json.loads(await self.module.query_sales_performance("sensitive question"))
        self.assertEqual(failure["code"], "FABRIC_MCP_ERROR")
        self.assertEqual(failure["status"], "error")
        self.assertNotIn("sensitive", json.dumps(failure) + "\n".join(logs.output))

    async def test_missing_tools_returns_safe_failure(self):
        self.session.list_tools.return_value.tools = []
        with self.assertLogs("fabric_tools", level="WARNING"):
            failure = json.loads(await self.module.query_sales_performance("question"))
        self.assertEqual(failure["code"], "FABRIC_NO_TOOLS")
        self.session.call_tool.assert_not_called()

    async def test_cancellation_is_logged_and_propagated(self):
        self.session.call_tool.side_effect = asyncio.CancelledError()
        with self.assertLogs("fabric_tools", level="WARNING") as logs:
            with self.assertRaises(asyncio.CancelledError):
                await self.module.query_sales_performance("sensitive question")
        self.assertIn("FABRIC_CANCELLED", logs.output[-1])
        self.assertNotIn("sensitive", "\n".join(logs.output))


class ApiTests(unittest.TestCase):
    def test_tradeoff_and_planning_variants_are_accepted_without_hosted_inference(self):
        from fastapi.testclient import TestClient
        from decision_server import app

        with patch.dict("os.environ", {}, clear=True), TestClient(app) as client:
            for variant in ("deadline-vs-value", "discovery-vs-readiness", "reasoned-rollout"):
                with self.subTest(variant=variant):
                    response = client.post("/run", json={"variant": variant, "method": "rules"})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["variant"], variant)
                    self.assertEqual(response.json()["branches"]["rules"]["status"], "ok")
                    self.assertEqual(response.json()["snapshot"]["asOf"], "2026-10-15T12:00:00Z")
                    if variant == "reasoned-rollout":
                        self.assertEqual(response.json()["branches"]["rules"]["planValidation"]["status"], "not_provided")

    def test_retrieved_mode_uses_the_same_model_snapshot_as_the_local_fixture(self):
        from fastapi.testclient import TestClient
        from decision_server import app

        provenance = {"provider": "Azure AI Search", "recordId": "decision-snapshot-v1-base", "sha256": "stored-checksum"}
        with patch.dict("os.environ", {}, clear=True), patch("decision_server.StoredSnapshots") as records, TestClient(app) as client:
            records.return_value.configured.return_value = True
            records.return_value.read = AsyncMock(return_value=(fixture(), provenance))
            retrieved = client.post("/run", json={"evidenceMode": "retrieved", "method": "rules"})
            local = client.post("/run", json={"evidenceMode": "synthetic", "method": "rules"})
            self.assertEqual(retrieved.status_code, 200)
            self.assertEqual(local.status_code, 200)
            self.assertEqual(retrieved.json()["snapshot"], local.json()["snapshot"])
            self.assertEqual(retrieved.json()["branches"]["rules"]["snapshotId"], local.json()["branches"]["rules"]["snapshotId"])
            self.assertEqual(retrieved.json()["evidenceMode"], "retrieved")
            self.assertEqual(retrieved.json()["retrieval"], provenance)
            records.return_value.read.assert_awaited_once_with("base")

    def test_rules_endpoint_and_request_boundaries(self):
        from fastapi.testclient import TestClient
        from decision_server import app

        with patch.dict("os.environ", {}, clear=True), TestClient(app) as client:
            self.assertEqual(client.get("/capabilities").json()["decision1"], False)
            self.assertFalse(client.get("/capabilities").json()["liveRetrieval"])
            self.assertFalse(client.get("/capabilities").json()["storedRetrieval"])
            self.assertEqual(client.post("/run", json={"evidenceMode": "retrieved", "method": "rules"}).status_code, 503)
            self.assertEqual(client.post("/run", json={"evidenceMode": "live", "method": "rules"}).status_code, 503)
            self.assertEqual(client.post("/run", json={"evidenceMode": "live", "question": "x" * 2001}).status_code, 422)
            result = client.post("/run", json={"variant": "base", "method": "rules"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(list(result.json()["branches"]), ["rules"])
            self.assertEqual(result.json()["branches"]["rules"]["status"], "ok")
            self.assertEqual(client.post("/run", json={"variant": "unknown"}).status_code, 422)
            self.assertEqual(client.post("/run", json={"endpoint": "https://evil.test"}).status_code, 422)
            self.assertEqual(client.post("/run", headers={"origin": "https://evil.test"}, json={}).status_code, 403)
            self.assertEqual(client.get("/health", headers={"host": "evil.test"}).status_code, 400)


if __name__ == "__main__":
    unittest.main()