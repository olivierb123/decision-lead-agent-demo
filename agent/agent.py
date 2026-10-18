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

DECISION_DOCS_INSTRUCTIONS = (
    " This index contains SYNTHETIC_DEMO fixtures, not verified current product publications. "
    "Return exactly one JSON object with text, effectiveAt and references. No Markdown fences, "
    "headings, or explanation outside that object. The text field MUST begin: "
    "SYNTHETIC DEMO: effectiveAt values simulate UTC midnight; these are not verified publication times. "
    "The original publication timestamp is unknown, but the separate synthetic fixture has its own "
    "explicit effectiveAt and UTC timezone. Return that stored fixture timestamp, clearly labeled "
    "synthetic, rather than returning null merely because the original publication was date-only. "
    "For EACH document used or cited, include its docId, originalLastUpdated "
    "(calendar-date precision only), exact retrieved effectiveAt, and timestampProvenance in text. "
    "When the requested JSON has a single effectiveAt, use the earliest retrieved effectiveAt "
    "among ALL cited documents, not the date of the highest-ranked search result. If any cited "
    "document lacks an explicit timestamp/timezone, return null instead. Never invent metadata. "
    "Keep currently described capabilities separate from roadmap items and retain uncertainty."
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
        instructions=(INSTRUCTIONS + DECISION_DOCS_INSTRUCTIONS
                      if SEARCH_INDEX_NAME == "decision-demo-product-docs-v1" else INSTRUCTIONS),
        default_options=({"response_format": {"type": "json_object"}, "temperature": 0}
                 if SEARCH_INDEX_NAME == "decision-demo-product-docs-v1" else None),
        name="FoundryIQDocsAgent",
        context_providers=[search_provider],
    )
