"""One-off script: create the `product-docs` Azure AI Search index and seed it
from src/data/raw/productDocs.js (hand-ported below — 4 small docs, not worth a
build step to convert JS -> JSON for this).

Run manually, once, after `azd provision` has created the Azure AI Search resource:

    python scripts/seed_search_index.py

Requires the same .env as agent/ (AZURE_SEARCH_ENDPOINT) plus Azure CLI login
or another DefaultAzureCredential-compatible identity with Search Service
Contributor + Search Index Data Contributor on the resource.
"""

from __future__ import annotations

import os

from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SemanticConfiguration,
    SemanticField,
    SemanticPrioritizedFields,
    SemanticSearch,
)
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "agent", ".env"))

SEARCH_ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX_NAME", "product-docs")
SEMANTIC_CONFIG_NAME = os.environ.get("AZURE_SEARCH_SEMANTIC_CONFIG_NAME", "product-docs-semantic-config")

# Hand-ported from src/data/raw/productDocs.js — keep the two files in sync if docs change.
PRODUCT_DOCS = [
    {
        "docId": "DOC-1",
        "title": "FieldForge Value Proposition One-Pager",
        "type": "marketing",
        "audience": "Prospects",
        "summary": (
            "Positions FieldForge as the field-to-office coordination layer for construction "
            "and civil contractors, cutting dispatch delays and missed follow-ups."
        ),
        "lastUpdated": "2026-08-01",
    },
    {
        "docId": "DOC-2",
        "title": "Competitive Battlecard: FieldForge vs. Procore Field Productivity",
        "type": "sales",
        "audience": "Sellers",
        "summary": (
            "FieldForge wins on real-time crew dispatch and permit-triggered lead capture; "
            "Procore has broader project-management depth but a weaker field-to-CRM handoff."
        ),
        "lastUpdated": "2026-08-20",
    },
    {
        "docId": "DOC-3",
        "title": "FieldForge Technical Architecture Overview",
        "type": "technical",
        "audience": "Technical sellers / SEs",
        "summary": (
            "Covers integration points with Dynamics 365, Microsoft Graph, and public permit "
            "data feeds; describes the grounding pipeline behind AI-assisted dispatch."
        ),
        "lastUpdated": "2026-09-05",
    },
    {
        "docId": "DOC-4",
        "title": "FY27 Product Roadmap Snapshot",
        "type": "technical",
        "audience": "Internal + select prospects",
        "summary": (
            "Near-term roadmap includes climate-risk-aware scheduling and expanded "
            "county-level permit coverage."
        ),
        "lastUpdated": "2026-09-15",
    },
]


def build_index() -> SearchIndex:
    return SearchIndex(
        name=INDEX_NAME,
        fields=[
            SearchField(name="id", type=SearchFieldDataType.String, key=True),
            SearchField(name="docId", type=SearchFieldDataType.String, filterable=True),
            SearchField(name="title", type=SearchFieldDataType.String, searchable=True),
            SearchField(name="content", type=SearchFieldDataType.String, searchable=True),
            SearchField(name="type", type=SearchFieldDataType.String, filterable=True),
            SearchField(name="audience", type=SearchFieldDataType.String, filterable=True),
            SearchField(name="lastUpdated", type=SearchFieldDataType.String, filterable=True),
        ],
        semantic_search=SemanticSearch(
            configurations=[
                SemanticConfiguration(
                    name=SEMANTIC_CONFIG_NAME,
                    prioritized_fields=SemanticPrioritizedFields(
                        title_field=SemanticField(field_name="title"),
                        content_fields=[SemanticField(field_name="content")],
                    ),
                )
            ]
        ),
    )


def to_search_document(doc: dict) -> dict:
    content = f"{doc['title']}. {doc['summary']} (type: {doc['type']}, audience: {doc['audience']})"
    return {
        "id": doc["docId"],
        "docId": doc["docId"],
        "title": doc["title"],
        "content": content,
        "type": doc["type"],
        "audience": doc["audience"],
        "lastUpdated": doc["lastUpdated"],
    }


def main() -> None:
    credential = DefaultAzureCredential()

    index_client = SearchIndexClient(endpoint=SEARCH_ENDPOINT, credential=credential)
    index_client.create_or_update_index(build_index())
    print(f"Created/updated index '{INDEX_NAME}' with semantic config '{SEMANTIC_CONFIG_NAME}'.")

    search_client = SearchClient(endpoint=SEARCH_ENDPOINT, index_name=INDEX_NAME, credential=credential)
    documents = [to_search_document(d) for d in PRODUCT_DOCS]
    result = search_client.upload_documents(documents=documents)
    succeeded = sum(1 for r in result if r.succeeded)
    print(f"Uploaded {succeeded}/{len(documents)} documents to '{INDEX_NAME}'.")


if __name__ == "__main__":
    main()
