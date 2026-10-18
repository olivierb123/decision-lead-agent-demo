import asyncio
import json
import math
import os
from urllib.parse import urlparse

import requests
from azure.identity import DefaultAzureCredential

from decision_policy import ACTIONS, RUBRIC


TOKEN_SCOPE = "https://cognitiveservices.azure.com/.default"


def supplied_ids(candidate, snapshot):
    return [item["evidenceId"] for item in candidate["evidence"] + snapshot["productEvidence"]]


def policy_exclusions(snapshot):
    return [
        {"candidateId": candidate["candidateId"],
         "action": "defer" if "defer" in candidate["policy"]["allowedActions"] else "cannot_tell",
         "priority": 0, "evidenceIds": supplied_ids(candidate, snapshot),
         "basis": "Shared policy; not a model decision."}
        for candidate in snapshot["candidates"] if not {"outreach", "research"}.intersection(candidate["policy"]["allowedActions"])
    ]


def token_cost(usage, prefix):
    input_rate = os.getenv(f"{prefix}_INPUT_USD_PER_MILLION")
    output_rate = "0" if prefix == "DECISION1" else os.getenv(f"{prefix}_OUTPUT_USD_PER_MILLION")
    if not input_rate or not output_rate or not isinstance(usage, dict):
        return None
    input_tokens, output_tokens = usage.get("prompt_tokens", usage.get("input_tokens")), usage.get("completion_tokens", usage.get("output_tokens"))
    if type(input_tokens) is not int or type(output_tokens) is not int or min(input_tokens, output_tokens) < 0:
        return None
    details = usage.get("prompt_tokens_details") or usage.get("input_tokens_details") or {}
    if not isinstance(details, dict):
        return None
    cached_tokens = details.get("cached_tokens", 0)
    if type(cached_tokens) is not int or not 0 <= cached_tokens <= input_tokens:
        return None
    cached_rate = os.getenv(f"{prefix}_CACHED_INPUT_USD_PER_MILLION") if cached_tokens else "0"
    if not cached_rate:
        return None
    try:
        rates = float(input_rate), float(output_rate), float(cached_rate)
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(rate) and rate >= 0 for rate in rates):
        return None
    return ((input_tokens - cached_tokens) * rates[0] + output_tokens * rates[1] + cached_tokens * rates[2]) / 1_000_000


def post_json(endpoint, body, scope=TOKEN_SCOPE, timeout=60):
    with DefaultAzureCredential() as credential:
        token = credential.get_token(scope).token
    response = requests.post(endpoint, json=body, headers={"Authorization": f"Bearer {token}"}, timeout=timeout, allow_redirects=False)
    if not response.ok or response.is_redirect:
        raise RuntimeError(f"Hosted model returned HTTP {response.status_code}")
    return response.json()


def combine_chat_usage(usages):
    if any(not isinstance(usage, dict) for usage in usages):
        return None
    counts = []
    for usage in usages:
        details = usage.get("prompt_tokens_details") or {}
        if not isinstance(details, dict):
            return None
        values = usage.get("prompt_tokens"), usage.get("completion_tokens"), details.get("cached_tokens", 0)
        if any(type(value) is not int or value < 0 for value in values) or values[2] > values[0]:
            return None
        counts.append(values)
    return {"prompt_tokens": sum(values[0] for values in counts),
            "completion_tokens": sum(values[1] for values in counts),
            "prompt_tokens_details": {"cached_tokens": sum(values[2] for values in counts)},
            "total_tokens": sum(values[0] + values[1] for values in counts), "requests": usages}


class HostedModels:
    def __init__(self, transport=None):
        self.transport = transport or self._transport

    async def _transport(self, endpoint, body):
        return await asyncio.to_thread(post_json, endpoint, body)

    def configured_runners(self):
        runners = {}
        for name, prefix, runner in (("llm", "LLM", self.llm), ("decision1", "DECISION1", self.decision1)):
            endpoint, deployment = os.getenv(f"{prefix}_ENDPOINT"), os.getenv(f"{prefix}_DEPLOYMENT")
            if endpoint and deployment:
                parsed = urlparse(endpoint)
                if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
                    raise ValueError(f"{prefix}_ENDPOINT must be an HTTPS resource origin")
                runners[name] = runner
        return runners

    async def llm(self, snapshot):
        rubric = snapshot.get("rubric", RUBRIC)
        exclusions = policy_exclusions(snapshot)
        eligible_ids = [item["candidateId"] for item in snapshot["candidates"] if {"outreach", "research"}.intersection(item["policy"]["allowedActions"])]
        if not eligible_ids:
            return {"status": "ok", "model": "No model call: all candidates policy-gated", "suggestions": exclusions,
                "usage": None, "inferenceCostUsd": 0}
        item_schema = {
            "type": "object", "additionalProperties": False,
            "properties": {"candidateId": {"type": "string", "enum": eligible_ids}, "action": {"type": "string", "enum": ["outreach", "research", "cannot_tell"]},
                           "priority": {"type": "number"}, "evidenceIds": {"type": "array", "items": {"type": "string"}}},
            "required": ["candidateId", "action", "priority", "evidenceIds"],
        }
        schema = {"type": "object", "additionalProperties": False,
                  "properties": {"suggestions": {"type": "array", "items": item_schema}}, "required": ["suggestions"]}
        plan_instruction = "Do not generate an explanation."
        if snapshot.get("planningTask"):
            task = snapshot["planningTask"]
            schema["properties"]["implementationPlan"] = {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "candidateId": {"type": "string"},
                    "phases": {"type": "array", "items": {
                        "type": "object", "additionalProperties": False,
                        "properties": {"id": {"type": "string"}, "startDate": {"type": "string"}, "finishDate": {"type": "string"}},
                        "required": ["id", "startDate", "finishDate"],
                    }},
                    "totalCostUsd": {"type": "number", "description": "Actual fixedCostUsd plus the sum of businessDays times dailyCostUsd for each phase. The budget is a ceiling, not the actual cost."},
                    "remainingBudgetUsd": {"type": "number", "description": "planningTask.budgetUsd minus the calculated totalCostUsd; do not assume the entire budget is spent."},
                    "meetsDeadline": {"type": "boolean"}, "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["candidateId", "phases", "totalCostUsd", "remainingBudgetUsd", "meetsDeadline", "evidenceIds"],
            }
            schema["required"].append("implementationPlan")
            plan_instruction = (
                "Also return implementationPlan for planningTask.candidateId. " + task["requirement"]
                + " Use YYYY-MM-DD dates, inclusive business-day durations and the stated phase order. "
                "Report final schedule and calculations only, not private reasoning. Cite the supplied evidence IDs."
            )
        payload = {
            "model": os.environ["LLM_DEPLOYMENT"],
            "messages": [{"role": "system", "content": rubric + f" Return JSON suggestions ONLY for these eligible candidate IDs: {json.dumps(eligible_ids)}. The application supplies excluded candidates separately. Use candidateId, action, priority and evidenceIds. " + plan_instruction},
                         {"role": "user", "content": json.dumps(snapshot)}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "seller_priorities", "strict": True, "schema": schema}},
        }
        endpoint = os.environ["LLM_ENDPOINT"].rstrip("/") + "/openai/v1/chat/completions"
        responses = []
        if snapshot.get("planningTask"):
            tools = [{"type": "function", "function": {
                "name": "implementation_budget", "strict": True,
                "description": "Calculate actual phase costs, total implementation expenditure and remaining budget from planningTask. Use this tool rather than guessing arithmetic.",
                "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
            }}]
            tool_payload = {key: value for key, value in payload.items() if key != "response_format"}
            tool_payload.update({"tools": tools, "tool_choice": {"type": "function", "function": {"name": "implementation_budget"}}})
            tool_response = await self.transport(endpoint, tool_payload)
            responses.append(tool_response)
            calls = tool_response["choices"][0]["message"].get("tool_calls", [])
            if (len(calls) != 1 or calls[0]["function"]["name"] != "implementation_budget"
                    or json.loads(calls[0]["function"]["arguments"]) != {}):
                raise ValueError("Expected the bounded implementation-budget tool call")
            task = snapshot["planningTask"]
            phase_costs = [{"id": phase["id"], "costUsd": phase["businessDays"] * phase["dailyCostUsd"]} for phase in task["phases"]]
            total = task["fixedCostUsd"] + sum(phase["costUsd"] for phase in phase_costs)
            calculated = {"phaseCosts": phase_costs, "fixedCostUsd": task["fixedCostUsd"],
                          "totalCostUsd": total, "remainingBudgetUsd": task["budgetUsd"] - total}
            payload["messages"] = payload["messages"] + [
                {"role": "assistant", "content": None, "tool_calls": calls},
                {"role": "tool", "tool_call_id": calls[0]["id"], "content": json.dumps(calculated)},
            ]
            payload.update({"tools": tools, "tool_choice": "none"})
        response = await self.transport(endpoint, payload)
        responses.append(response)
        result = json.loads(response["choices"][0]["message"]["content"])
        usage = combine_chat_usage([item.get("usage") for item in responses]) if len(responses) > 1 else response.get("usage")
        return {"status": "ok", "suggestions": exclusions + result["suggestions"], "usage": usage,
                "model": response.get("model", os.environ["LLM_DEPLOYMENT"]),
                "inferenceCostUsd": token_cost(usage, "LLM"),
                **({"implementationPlan": result.get("implementationPlan"), "toolsUsed": ["implementation_budget"]}
                   if snapshot.get("planningTask") else {})}

    async def decision1(self, snapshot):
        rubric = snapshot.get("rubric", RUBRIC)
        priority_criteria = (["No research priority or review required", "Low research priority", "Moderate research priority", "High research priority"]
                             if snapshot.get("scope") == "territory-prospecting" else
                             ["Not actionable or review required", "Exploratory", "Timely but uncertain", "Ready and timely"])
        questions, suggestions = {}, policy_exclusions(snapshot)
        for candidate in snapshot["candidates"]:
            candidate_id = candidate["candidateId"]
            allowed = candidate["policy"]["allowedActions"]
            if not {"outreach", "research"}.intersection(allowed):
                continue
            questions[f"action_{candidate_id}"] = {
                "type": "choice", "instructions": f"{rubric} Choose the next action for {candidate_id}.",
                "criteria": {action: ACTIONS[action] for action in allowed},
            }
            questions[f"priority_{candidate_id}"] = {
                "type": "score", "instructions": f"{rubric} Rate attention priority for {candidate_id}.",
                "criteria": priority_criteria,
            }
        if not questions:
            return {"status": "ok", "model": "No model call: all candidates policy-gated", "suggestions": suggestions,
                    "usage": None, "inferenceCostUsd": 0}
        response = await self.transport(
            os.environ["DECISION1_ENDPOINT"].rstrip("/") + "/providers/microsoft/v1/systemone",
            {"model": os.environ["DECISION1_DEPLOYMENT"], "state": snapshot, "questions": questions},
        )
        answers = response["answers"]
        for candidate in snapshot["candidates"]:
            candidate_id = candidate["candidateId"]
            if not {"outreach", "research"}.intersection(candidate["policy"]["allowedActions"]):
                continue
            action_answer, score_answer = answers[f"action_{candidate_id}"], answers[f"priority_{candidate_id}"]
            if action_answer.get("type") != "choice" or score_answer.get("type") != "score":
                raise ValueError("Unexpected Decision-1 answer type")
            suggestions.append({"candidateId": candidate_id, "action": action_answer["choice"], "priority": score_answer["score"],
                                "evidenceIds": supplied_ids(candidate, snapshot),
                                "basis": "Supplied evidence references; Decision-1 provides no written rationale."})
        return {"status": "ok", "suggestions": suggestions, "usage": response.get("usage"),
                "model": response.get("model", os.environ["DECISION1_DEPLOYMENT"]),
                "inferenceCostUsd": token_cost(response.get("usage"), "DECISION1")}