import copy
import asyncio
import hashlib
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from time import perf_counter
from typing import Any

from agent_framework import Workflow, WorkflowBuilder, WorkflowContext, executor


METHODS = ("rules", "llm", "decision1")
Runner = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass
class PreparedEvidence:
    snapshot: dict[str, Any]


@dataclass
class BranchResult:
    method: str
    result: dict[str, Any]
    policy: dict[str, Any]
    snapshot: dict[str, Any]


@dataclass
class SourceEvidence:
    snapshot: dict[str, Any]
    source: str = ""
    reading: dict[str, Any] | None = None


def build_workflow(
    runners: dict[str, Runner],
    method: str = "compare",
    prepare: Callable[[dict[str, Any]], dict[str, Any]] = copy.deepcopy,
    validate: Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]] | None = None,
    source_readers: dict[str, Runner] | None = None,
) -> Workflow:
    if method not in (*METHODS, "compare"):
        raise ValueError("Unknown decision method")
    selected = METHODS if method == "compare" else (method,)

    @executor(id="load_evidence_request")
    async def start(snapshot: dict, ctx: WorkflowContext[dict]) -> None:
        await ctx.send_message(copy.deepcopy(snapshot))

    def make_source(source: str):
        @executor(id=f"read_{source.lower().replace(' ', '_')}")
        async def read_source(snapshot: dict, ctx: WorkflowContext[SourceEvidence]) -> None:
            if source_readers is not None:
                try:
                    reading = await asyncio.wait_for(source_readers[source](copy.deepcopy(snapshot)), timeout=150)
                except Exception as error:
                    reading = {"status": "error", "message": f"Source failed ({type(error).__name__})."}
                await ctx.send_message(SourceEvidence(copy.deepcopy(snapshot), source, reading))
                return
            fragment = copy.deepcopy(snapshot)
            fragment["productEvidence"] = [item for item in fragment.get("productEvidence", []) if item["source"] == source]
            for candidate in fragment.get("candidates", []):
                candidate["evidence"] = [item for item in candidate.get("evidence", []) if item["source"] == source]
            await ctx.send_message(SourceEvidence(fragment))

        return read_source

    @executor(id="validate_evidence_and_policy")
    async def prepare_evidence(parts: list[SourceEvidence], ctx: WorkflowContext[PreparedEvidence]) -> None:
        snapshot = copy.deepcopy(parts[0].snapshot)
        if source_readers is not None:
            snapshot["sourceResults"] = {part.source: part.reading for part in parts}
            await ctx.send_message(PreparedEvidence(prepare(snapshot)))
            return
        snapshot["productEvidence"] = [item for part in parts for item in part.snapshot["productEvidence"]]
        for index, candidate in enumerate(snapshot.get("candidates", [])):
            candidate["evidence"] = [item for part in parts for item in part.snapshot["candidates"][index]["evidence"]]
        await ctx.send_message(PreparedEvidence(prepare(snapshot)))

    def make_branch(name: str):
        @executor(id=f"prioritize_{name}")
        async def branch(evidence: PreparedEvidence, ctx: WorkflowContext[BranchResult]) -> None:
            started = perf_counter()
            runner = runners.get(name)
            if runner is None:
                result = {"status": "unavailable", "message": "Hosted branch is not configured."}
            else:
                try:
                    result = await asyncio.wait_for(runner(copy.deepcopy(evidence.snapshot)), timeout=75)
                    if validate is not None:
                        result = validate(result, evidence.snapshot)
                except Exception as error:
                    result = {"status": "error", "message": f"Branch failed ({type(error).__name__})."}
            snapshot_id = hashlib.sha256(json.dumps(evidence.snapshot, sort_keys=True).encode()).hexdigest()
            result = {**result, "elapsedMs": round((perf_counter() - started) * 1000, 2), "snapshotId": snapshot_id}
            policies = {item["candidateId"]: item["policy"] for item in evidence.snapshot.get("candidates", []) if "policy" in item}
            await ctx.send_message(BranchResult(name, result, policies, evidence.snapshot))

        return branch

    @executor(id="collect_comparison")
    async def collect(results: list[BranchResult], ctx: WorkflowContext[Any, dict]) -> None:
        by_method = {item.method: item.result for item in results}
        await ctx.yield_output({"mode": method, "branches": {name: by_method[name] for name in selected}, "policies": results[0].policy,
                    "snapshot": results[0].snapshot})

    @executor(id="collect_selected")
    async def collect_single(result: BranchResult, ctx: WorkflowContext[Any, dict]) -> None:
        await ctx.yield_output({"mode": method, "branches": {result.method: result.result}, "policies": result.policy,
                    "snapshot": result.snapshot})

    branches = [make_branch(name) for name in selected]
    sources = [make_source(source) for source in ("Fabric IQ", "Web IQ", "Foundry IQ")]
    builder = WorkflowBuilder(start_executor=start, name="fieldforge-decision-comparison")
    builder.add_fan_out_edges(start, sources).add_fan_in_edges(sources, prepare_evidence)
    if len(branches) == 1:
        builder.add_edge(prepare_evidence, branches[0]).add_edge(branches[0], collect_single)
    else:
        builder.add_fan_out_edges(prepare_evidence, branches).add_fan_in_edges(branches, collect)
    return builder.build()


async def run_comparison(
    snapshot: dict[str, Any], runners: dict[str, Runner], method: str = "compare",
    prepare: Callable[[dict[str, Any]], dict[str, Any]] = copy.deepcopy,
    validate: Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]] | None = None,
    source_readers: dict[str, Runner] | None = None,
) -> dict[str, Any]:
    started = perf_counter()
    result = await build_workflow(runners, method, prepare, validate, source_readers).run(snapshot)
    outputs = result.get_outputs()
    if len(outputs) != 1:
        raise RuntimeError("Workflow did not produce exactly one comparison")
    return {**outputs[0], "elapsedMs": round((perf_counter() - started) * 1000, 2),
            "evidenceMode": snapshot.get("evidenceMode", "synthetic"), "retrievalCostUsd": None}