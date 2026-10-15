from __future__ import annotations

import os

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


async def query_sales_performance(question: str) -> str:
    """Query FieldForge's live Fabric Data agent (Sales Performance semantic
    model) with a natural-language question. Calls the Fabric Data agent's MCP
    endpoint directly using a service-principal credential — not a mock or
    cached dataset. Returns the agent's natural-language answer."""
    token = _credential.get_token(FABRIC_SCOPE)
    headers = {"Authorization": f"Bearer {token.token}"}

    async with streamablehttp_client(MCP_URL, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool = tools.tools[0]
            question_arg = next(iter(tool.inputSchema["properties"]))
            result = await session.call_tool(tool.name, {question_arg: question})
            return "\n".join(block.text for block in result.content if block.type == "text")
