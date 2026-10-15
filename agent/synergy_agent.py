from __future__ import annotations

import os

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

load_dotenv()

PROJECT_ENDPOINT = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
MODEL_DEPLOYMENT_NAME = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o")

INSTRUCTIONS = (
    "You are Synergy IQ, a synthesis agent for FieldForge. You are given three "
    "already-grounded, already-cited answers from three other specialist "
    "agents (Fabric IQ on sales/territory performance, Web IQ on climate/"
    "disaster risk, Foundry IQ on product docs/competitive positioning), each "
    "clearly labeled by source. Do not call any tools and do not invent new "
    "facts — synthesize only what's given. Write one short, decisive "
    "takeaway (3-5 sentences) that connects the three inputs into a single "
    "recommendation, explicitly attributing each supporting point to the IQ "
    "it came from (e.g. 'Per Fabric IQ...', 'Web IQ shows...', 'Foundry IQ "
    "notes...'). End with one concrete next action."
)


def build_synergy_agent() -> Agent:
    """Build the Synergy agent: a plain Foundry-hosted chat model with no
    tools, whose only job is to synthesize three other agents' answers
    (already given to it inline in the prompt) into one takeaway."""
    chat_client = FoundryChatClient(
        project_endpoint=PROJECT_ENDPOINT,
        model=MODEL_DEPLOYMENT_NAME,
        credential=DefaultAzureCredential(),
    )
    return Agent(
        chat_client,
        instructions=INSTRUCTIONS,
        name="SynergyAgent",
    )
