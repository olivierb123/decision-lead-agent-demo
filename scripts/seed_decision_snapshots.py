"""Publish exact synthetic fixture records; dry-run unless --upload is explicit."""

import argparse
import asyncio
import json
from pathlib import Path
import sys

import requests
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))
from decision_records import StoredSnapshots, VARIANTS, build_record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload", action="store_true", help="Create the isolated snapshot index and upload exact fixture records")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env")
    records = [build_record(variant) for variant in VARIANTS]
    print(json.dumps({"source": "src/data/decisionScenarios.js", "records": [
        {"id": record["id"], "sha256": record["sha256"], "asOf": record["asOf"]} for record in records
    ]}, indent=2))
    if not args.upload:
        print("Dry run: no Azure writes or authentication performed.")
        return

    store = StoredSnapshots()
    if not store.configured() or store.index != "decision-demo-snapshots-v1":
        raise ValueError("Configure DECISION_RECORDS_SEARCH_ENDPOINT and the isolated decision-demo-snapshots-v1 index")
    fields = [{"name": name, "type": "Edm.Boolean" if name == "isSynthetic" else "Edm.String",
               **({"key": True} if name == "id" else {})} for name in records[0]]
    params = {"api-version": "2024-07-01"}
    index_url = f"{store.endpoint}/indexes/{store.index}"
    with DefaultAzureCredential() as credential, requests.Session() as session:
        session.headers["Authorization"] = f"Bearer {credential.get_token('https://search.azure.com/.default').token}"
        existing = session.get(index_url, params=params, timeout=30)
        if existing.status_code == 404:
            created = session.put(index_url, params=params, headers={"If-None-Match": "*"},
                                  json={"name": store.index, "fields": fields}, timeout=30)
            created.raise_for_status()
        else:
            existing.raise_for_status()
            actual_fields = {field["name"]: field for field in existing.json()["fields"]}
            if any(actual_fields.get(field["name"], {}).get("type") != field["type"] for field in fields):
                raise ValueError("Existing index schema differs; refusing to modify it")
            if actual_fields["id"].get("key") is not True:
                raise ValueError("Existing index has an unexpected key")
        for record in records:
            existing = session.get(f"{index_url}/docs/{record['id']}", params=params, timeout=30)
            if existing.status_code != 404:
                existing.raise_for_status()
                if any(existing.json().get(name) != value for name, value in record.items()):
                    raise ValueError("An existing versioned record differs; refusing to overwrite it")
        result = session.post(f"{index_url}/docs/index", params=params,
                              json={"value": [{"@search.action": "upload", **record} for record in records]}, timeout=30)
        result.raise_for_status()
        statuses = result.json()["value"]
        if len(statuses) != len(records) or not all(item.get("status") is True for item in statuses):
            raise RuntimeError("Not every snapshot was indexed successfully")

    async def verify():
        for variant in VARIANTS:
            snapshot, provenance = await store.read(variant)
            if snapshot != json.loads(build_record(variant)["content"]):
                raise ValueError("Retrieved snapshot differs from its original fixture")
            print(f"Verified {provenance['recordId']}: {len(snapshot['candidates'])} candidates, exact fixture parity")

    asyncio.run(verify())


if __name__ == "__main__":
    main()