from __future__ import annotations

import os
from urllib.parse import urlparse

import requests

WEBIQ_BASE_URL = "https://api.microsoft.ai/v3"
HAZARD_SOURCE_SCOPE = "site:noaa.gov OR site:fema.gov OR site:weather.gov"

API_KEY = os.environ["WEBIQ_API_KEY"]


def search_climate_risk(query: str, max_results: int = 5) -> list[dict]:
    """Search Microsoft Web IQ's live web-grounding API for climate/disaster-risk
    information relevant to `query`, scoped toward authoritative hazard sources
    (NOAA, FEMA, National Weather Service). Returns the matching web results
    (title, url, domain, content, lastUpdatedAt, sourceQuality) live from the
    real API — not a mock or cached dataset."""
    response = requests.post(
        f"{WEBIQ_BASE_URL}/search/web",
        headers={
            "x-apikey": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "query": f"{query} {HAZARD_SOURCE_SCOPE}",
            "maxResults": max_results,
        },
        timeout=30,
    )
    response.raise_for_status()

    results = response.json().get("webResults", [])
    return [
        {
            "title": r.get("title"),
            "url": r.get("url"),
            "domain": r.get("domain") or urlparse(r.get("url", "")).netloc,
            "content": r.get("content"),
            "lastUpdatedAt": r.get("lastUpdatedAt") or r.get("crawledAt"),
            "sourceQuality": r.get("sourceQuality"),
        }
        for r in results
    ]
