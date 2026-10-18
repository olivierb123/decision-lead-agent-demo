import asyncio
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlparse

import requests
from azure.identity import DefaultAzureCredential


ROOT = Path(__file__).resolve().parents[1]
VARIANTS = ("base", "deadline-vs-value", "discovery-vs-readiness", "summit-fit", "coastal-remote", "stale-context", "source-failure", "reasoned-rollout")


@lru_cache(maxsize=len(VARIANTS))
def load_snapshot(variant):
    if variant not in VARIANTS:
        raise ValueError("Unknown scenario variant")
    output = subprocess.check_output(
        ["node", "--input-type=module", "-e",
         "import {buildComparisonSnapshot} from './src/data/decisionScenarios.js'; console.log(JSON.stringify(buildComparisonSnapshot(process.argv[1])))", variant],
        cwd=ROOT, text=True, timeout=10,
    )
    return json.loads(output)


def build_record(variant):
    snapshot = load_snapshot(variant)
    content = json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return {
        "id": f"decision-snapshot-v1-{variant}", "variant": variant,
        "scenarioId": snapshot["scenarioId"], "asOf": snapshot["asOf"],
        "isSynthetic": True, "dataClassification": "SYNTHETIC_DEMO",
        "content": content, "sha256": hashlib.sha256(content.encode()).hexdigest(),
    }


class StoredSnapshots:
    def __init__(self, transport=None):
        self.endpoint = os.getenv("DECISION_RECORDS_SEARCH_ENDPOINT", "").rstrip("/")
        self.index = os.getenv("DECISION_RECORDS_SEARCH_INDEX", "")
        self.transport = transport or self._transport

    def configured(self):
        parsed = urlparse(self.endpoint)
        return bool(parsed.scheme == "https" and parsed.hostname
                    and parsed.hostname.endswith(".search.windows.net")
                    and not parsed.username and not parsed.query and not parsed.fragment
                    and parsed.path in ("", "/") and parsed.port in (None, 443)
                    and re.fullmatch(r"[a-z0-9][a-z0-9-]{1,127}", self.index))

    async def _transport(self, endpoint):
        def retrieve():
            with DefaultAzureCredential() as credential:
                token = credential.get_token("https://search.azure.com/.default").token
            response = requests.get(endpoint, headers={"Authorization": f"Bearer {token}"},
                                    timeout=30, allow_redirects=False)
            response.raise_for_status()
            if response.is_redirect:
                raise ValueError("Search redirects are not permitted")
            return response.json()

        return await asyncio.to_thread(retrieve)

    async def read(self, variant):
        if not self.configured() or variant not in VARIANTS:
            raise ValueError("Stored scenario retrieval is not configured or variant is invalid")
        record_id = f"decision-snapshot-v1-{variant}"
        endpoint = f"{self.endpoint}/indexes/{quote(self.index)}/docs/{record_id}?api-version=2024-07-01"
        record = await self.transport(endpoint)
        if (record.get("id") != record_id or record.get("variant") != variant
                or record.get("isSynthetic") is not True or record.get("dataClassification") != "SYNTHETIC_DEMO"):
            raise ValueError("Unexpected stored synthetic record")
        content = record.get("content")
        if not isinstance(content, str) or len(content) > 1_000_000:
            raise ValueError("Invalid stored snapshot content")
        digest = hashlib.sha256(content.encode()).hexdigest()
        if record.get("sha256") != digest:
            raise ValueError("Stored snapshot checksum mismatch")
        if digest != build_record(variant)["sha256"]:
            raise ValueError("Stored snapshot differs from the canonical fixture")
        snapshot = json.loads(content)
        if (snapshot.get("evidenceMode") != "synthetic"
                or snapshot.get("scenarioId") != "fieldforge-next-action-v1"):
            raise ValueError("Stored record is not the versioned synthetic scenario")
        return snapshot, {
            "provider": "Azure AI Search", "endpoint": self.endpoint, "index": self.index,
            "recordId": record_id, "sha256": digest,
            "observedAt": datetime.now(timezone.utc).isoformat(),
        }