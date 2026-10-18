from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid

from azure.identity import ClientSecretCredential
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

FABRIC_SCOPE = "https://api.fabric.microsoft.com/.default"

FABRIC_TENANT_ID = os.environ["FABRIC_TENANT_ID"]
FABRIC_CLIENT_ID = os.environ["FABRIC_CLIENT_ID"]
FABRIC_CLIENT_SECRET = os.environ["FABRIC_CLIENT_SECRET"]
FABRIC_WORKSPACE_ID = os.environ["FABRIC_WORKSPACE_ID"]
FABRIC_DATA_AGENT_ID = os.environ["FABRIC_DATA_AGENT_ID"]

MCP_URL = (
    f"https://api.fabric.microsoft.com/v1/mcp/workspaces/{FABRIC_WORKSPACE_ID}"
    f"/dataagents/{FABRIC_DATA_AGENT_ID}/agent"
)

_credential = ClientSecretCredential(FABRIC_TENANT_ID, FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET)
_logger = logging.getLogger(__name__)


def _diagnostic(diagnostic_id: str, started: float, stage: str, event: str, **details) -> dict:
    record = {"diagnosticId": diagnostic_id, "stage": stage, "event": event,
              "elapsedMs": round((time.monotonic() - started) * 1000), **details}
    _logger.warning("fabric_tool_diagnostic %s", json.dumps(record))
    return record


def _error_details(error: Exception) -> dict:
    pending, error_types, rpc_codes, http_statuses = [error], set(), set(), set()
    inspected = 0
    while pending and inspected < 20:
        current = pending.pop()
        inspected += 1
        if isinstance(current, BaseExceptionGroup):
            pending.extend(current.exceptions)
            continue
        error_types.add(type(current).__name__)
        rpc_code = getattr(getattr(current, "error", None), "code", None)
        http_status = getattr(getattr(current, "response", None), "status_code", None)
        if type(rpc_code) is int:
            rpc_codes.add(rpc_code)
        if type(http_status) is int:
            http_statuses.add(http_status)
    return {"errorTypes": sorted(error_types), "rpcCodes": sorted(rpc_codes), "httpStatuses": sorted(http_statuses)}


async def query_sales_performance(question: str) -> str:
    """Query FieldForge's live Fabric Data agent (Sales Performance semantic
    model) with a natural-language question. Calls the Fabric Data agent's MCP
    endpoint directly using a service-principal credential — not a mock or
    cached dataset. Returns the agent's natural-language answer."""
    diagnostic_id, started = uuid.uuid4().hex, time.monotonic()
    stage = "authentication"
    _diagnostic(diagnostic_id, started, stage, "started")
    try:
        token = _credential.get_token(FABRIC_SCOPE)
        headers = {"Authorization": f"Bearer {token.token}"}
        _diagnostic(diagnostic_id, started, stage, "ok")
        stage = "connect"
        async with streamablehttp_client(MCP_URL, headers=headers) as (read, write, _):
            _diagnostic(diagnostic_id, started, stage, "ok")
            stage = "initialize"
            async with ClientSession(read, write) as session:
                await session.initialize()
                _diagnostic(diagnostic_id, started, stage, "ok")
                stage = "list_tools"
                tools = await session.list_tools()
                if not tools.tools:
                    return json.dumps(_diagnostic(diagnostic_id, started, stage, "error",
                                                  status="error", code="FABRIC_NO_TOOLS"))
                tool = tools.tools[0]
                question_arg = next(iter(tool.inputSchema["properties"]))
                _diagnostic(diagnostic_id, started, stage, "ok")
                stage = "call_tool"
                _diagnostic(diagnostic_id, started, stage, "started")
                result = await session.call_tool(tool.name, {question_arg: question})
                if result.isError:
                    return json.dumps(_diagnostic(diagnostic_id, started, stage, "error",
                                                  status="error", code="FABRIC_MCP_ERROR"))
                answer = "\n".join(block.text for block in result.content if block.type == "text")
                _diagnostic(diagnostic_id, started, stage, "ok")
                stage = "close"
        _diagnostic(diagnostic_id, started, stage, "ok")
        return answer
    except asyncio.CancelledError:
        _diagnostic(diagnostic_id, started, stage, "cancelled", code="FABRIC_CANCELLED")
        raise
    except Exception as error:
        return json.dumps(_diagnostic(diagnostic_id, started, stage, "error", status="error",
                                      code="FABRIC_TOOL_FAILURE", **_error_details(error)))
