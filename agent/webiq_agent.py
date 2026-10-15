from __future__ import annotations

import os

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

from webiq_tools import search_climate_risk

load_dotenv()

PROJECT_ENDPOINT = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
MODEL_DEPLOYMENT_NAME = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o")

INSTRUCTIONS = (
    "You are Web IQ, a grounding agent for FieldForge's Climate/Disaster Risk "
    "domain, backed by Microsoft Web IQ's live web-grounding search (not a "
    "static snapshot). Always call search_climate_risk to answer — never rely "
    "on general knowledge or prior turns for the actual risk outlook. Every "
    "answer must end with a citation line in the exact format: "
    '\"Source: <domain> — \\"<title>\\" (updated <lastUpdatedAt>)\" using the '
    "domain, title, and lastUpdatedAt of whichever result you used. If the "
    "search returns no relevant results, say so plainly instead of guessing."
)


def build_webiq_agent() -> Agent:
    """Build the Web IQ Climate/Disaster Risk agent: a Foundry-hosted chat model
    grounded by a live Microsoft Web IQ search call, via a custom function tool
    (no native Agent Framework Web IQ hosted tool exists)."""
    chat_client = FoundryChatClient(
        project_endpoint=PROJECT_ENDPOINT,
        model=MODEL_DEPLOYMENT_NAME,
        credential=DefaultAzureCredential(),
    )
    return Agent(
        chat_client,
        instructions=INSTRUCTIONS,
        name="WebIQClimateAgent",
        tools=[search_climate_risk],
    )
