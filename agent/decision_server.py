import asyncio
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from decision_models import HostedModels
from decision_policy import prepare_snapshot, rules_runner, validate_recommendations
from decision_workflow import run_comparison
from decision_sources import LiveSources, SOURCE_ENV, prepare_live_snapshot
from decision_records import StoredSnapshots, load_snapshot


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
app = FastAPI(title="FieldForge Decision Workflow", docs_url=None, redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
run_lock = asyncio.Lock()


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant: Literal["base", "deadline-vs-value", "discovery-vs-readiness", "summit-fit", "coastal-remote", "stale-context", "source-failure", "reasoned-rollout"] = "base"
    method: Literal["compare", "rules", "llm", "decision1"] = "compare"
    evidenceMode: Literal["synthetic", "retrieved", "live"] = "synthetic"
    question: str = Field(default="Where should we focus new lead generation?", min_length=1, max_length=2000)


@app.middleware("http")
async def local_origin_only(request: Request, call_next):
    origin = request.headers.get("origin")
    allowed = [value.strip() for value in os.getenv("WORKFLOW_ALLOWED_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175").split(",") if value.strip()]
    if origin is not None and origin not in allowed:
        return JSONResponse({"error": "Origin is not permitted"}, status_code=403)
    if request.headers.get("sec-fetch-site") == "cross-site":
        return JSONResponse({"error": "Cross-site requests are not permitted"}, status_code=403)
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok", "framework": "Microsoft Agent Framework", "evidenceModes": ["synthetic", "retrieved", "live"]}


@app.get("/capabilities")
async def capabilities():
    runners = HostedModels().configured_runners()
    sources = LiveSources().configured_readers()
    return {"rules": True, "llm": "llm" in runners, "decision1": "decision1" in runners,
            "evidenceModes": ["synthetic", "retrieved", "live"], "liveRetrieval": len(sources) == len(SOURCE_ENV),
            "storedRetrieval": StoredSnapshots().configured(),
            "sources": {source: source in sources for source in SOURCE_ENV}}


@app.post("/run")
async def run(body: RunRequest):
    if run_lock.locked():
        raise HTTPException(429, "A comparison is already running")
    async with run_lock:
        try:
            runners = {"rules": rules_runner, **HostedModels().configured_runners()}
            if body.evidenceMode == "live":
                readers = LiveSources().configured_readers()
                if len(readers) != len(SOURCE_ENV):
                    raise HTTPException(503, "All three IQ source endpoints must be configured for a live run.")
                if not body.question.strip():
                    raise HTTPException(422, "A nonempty question is required.")
                snapshot = {"evidenceMode": "live", "question": body.question.strip()}
                result = await run_comparison(snapshot, runners, body.method, prepare_live_snapshot,
                                              validate_recommendations, readers)
            elif body.evidenceMode == "retrieved":
                records = StoredSnapshots()
                if not records.configured():
                    raise HTTPException(503, "Stored synthetic record retrieval is not configured.")
                snapshot, retrieval = await records.read(body.variant)
                result = await run_comparison(snapshot, runners, body.method, prepare_snapshot, validate_recommendations)
                result = {**result, "evidenceMode": "retrieved", "retrieval": retrieval}
            else:
                snapshot = await asyncio.to_thread(load_snapshot, body.variant)
                result = await run_comparison(snapshot, runners, body.method, prepare_snapshot, validate_recommendations)
            return {**result, "variant": body.variant}
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(500, f"Workflow failed ({type(error).__name__}); check local server configuration.") from error