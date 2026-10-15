from __future__ import annotations

import os

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from agent_framework_azure_ai_search import AzureAISearchContextProvider
from azure.identity import DefaultAzureCredential
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential
from dotenv import load_dotenv

load_dotenv()

PROJECT_ENDPOINT = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
MODEL_DEPLOYMENT_NAME = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o")
SEARCH_ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
SEARCH_INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX_NAME", "product-docs")
SEARCH_SEMANTIC_CONFIG_NAME = os.environ.get("AZURE_SEARCH_SEMANTIC_CONFIG_NAME", "product-docs-semantic-config")

INSTRUCTIONS = (
    "You are Foundry IQ, a grounding agent for FieldForge's product, marketing, and "
    "technical documentation. Answer only from the retrieved document context you are "
    "given for this turn — never from general knowledge — and always cite the source "
    "doc's title and docId inline (e.g. \"DOC-2: Competitive Battlecard...\"). If the "
    "retrieved context doesn't cover the question, say so plainly instead of guessing."
)


def build_agent() -> Agent:
    """Build the Foundry IQ docs agent: a Foundry-hosted chat model grounded by a
    real Azure AI Search index via Agent Framework's native context provider hook,
    instead of a hand-written keyword matcher."""
    search_provider = AzureAISearchContextProvider(
        endpoint=SEARCH_ENDPOINT,
        index_name=SEARCH_INDEX_NAME,
        credential=AsyncDefaultAzureCredential(),
        mode="semantic",
        top_k=3,
        semantic_configuration_name=SEARCH_SEMANTIC_CONFIG_NAME,
    )
    chat_client = FoundryChatClient(
        project_endpoint=PROJECT_ENDPOINT,
        model=MODEL_DEPLOYMENT_NAME,
        credential=DefaultAzureCredential(),
    )
    return Agent(
        chat_client,
        instructions=INSTRUCTIONS,
        name="FoundryIQDocsAgent",
        context_providers=[search_provider],
    )
