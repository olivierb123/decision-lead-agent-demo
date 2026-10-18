# Seed decision-demo data in Fabric

This creates **new, explicitly synthetic scenario data hosted in Fabric**, not an update to real customer records. It does not overwrite the inherited sales CSV, refresh an existing semantic model, provision resources, or change agents. No credentials or additional packages are required.

## Run in a Fabric notebook

1. Open a Fabric **PySpark (Python)** notebook. Attach a Lakehouse as its **default** Lakehouse; restart the notebook session if you changed the attachment. Use an isolated demo Lakehouse if available.
2. Upload [scripts/seed_decision_demo.py](../scripts/seed_decision_demo.py) into that Lakehouse's **Files** root.
3. Run this notebook cell:

```python
import runpy

seed = runpy.run_path("/lakehouse/default/Files/seed_decision_demo.py")
output = seed["run"](as_of="2026-10-15", version="v1")
```

The explicit date matches the October 15, 2026 demo. For a new scenario, deliberately choose your actual demo date. Future demo dates are rejected. Generating an old scenario today does not make its evidence current: `effectiveAt` remains the end of that scenario's reporting window, while `generatedAt` records actual file creation time.

Results appear under **Files/decision_demo/v1/2026-10-15/**:

| File | Contents |
| --- | --- |
| `sales_performance.csv` | 42 daily rows across Central, South, and West for the default date; original nine column names plus dates, stable row IDs, lineage, and synthetic labels |
| `decision_opportunities.csv` | Six account scenarios, stable opportunity/account IDs, territory, software opportunity values, buying context, contact restrictions, match status, and explicit unknowns |
| `manifest.json` | Reporting bounds, fiscal-calendar definition, expected counts/totals, file SHA-256 hashes, and limitations |

The reporting window covers up to 14 completed calendar days, capped at the beginning of its ending month. For October 15 it is **October 1-14, 2026**, not the whole fiscal quarter. Every territory has identical date coverage. Financial totals are distributed exactly to cents; do not average or sum daily `variancePct`. Compute period variance as `(SUM(revenue) - SUM(quota)) / SUM(quota) * 100`.

| Territory | Period Revenue | Period Quota | Period Variance |
| --- | ---: | ---: | ---: |
| Central | 300,000 | 350,000 | -14.3% |
| South | 110,000 | 210,000 | -47.6% |
| West | 210,000 | 200,000 | +5.0% |

The explicit synthetic fiscal calendar ends June 30: October 2026 is **FY27 Q2**. This is not an inferred calendar for the inherited FY26 rows.

Repeated runs for the same date/version fail before replacing existing output. For another bundle, use `version="v2"`. If storage fails midway, the incomplete directory is left for inspection; use a new version after resolving the error. The manifest is written last. Only use bundles that contain a complete manifest and matching file hashes.

## Connect the data to Fabric IQ

**The currently deployed `sales_performance` semantic model is CSV Import mode, not Direct Lake.** Writing files or Delta tables to a Lakehouse does not update it, and clicking Refresh alone will not make it read a different CSV. Its existing Data agent will keep seeing its existing model until you connect the new data deliberately.

For an isolated sales-only trial:

1. Download the generated `sales_performance.csv` from Lakehouse Files. In the Fabric/Power BI workspace, select **New item > Semantic model > CSV > Upload file** and create a **separate** semantic model, for example `decision_demo_sales_v1`. Do not replace the shared model.
2. Confirm the imported table is named **`sales_performance`**. The current hosted retrieval prompt explicitly queries that name. Rename the table in Power BI Desktop and republish to the separate demo model if necessary; do not assume the semantic model's display name determines its table name.
3. Check field types: revenue/quota/variance are numeric; fiscal labels, IDs, and `sourceId` are text; `isSynthetic` is Boolean; reporting/business dates are Date; effective/generation dates retain their UTC meaning. Preserve nulls in any subsequently imported opportunity table. Empty CSV fields mean **unknown**, not zero or false.
4. Validate all three totals above and identical date coverage before adding the model to a separate Fabric Data agent. Ensure the existing integration identity can read that model; a successful query in your browser does not prove service-principal access works.
5. Open the semantic model's **Prep data for AI > Simplify data schema** and include the reporting bounds, `businessDate`, `effectiveAt`, `sourceId`, and `isSynthetic` alongside territory/revenue/quota. Under **Add AI instructions**, add the reporting guidance below. Save the model, test the Data agent's responses, then publish the Data agent. Semantic-model DAX generation uses model metadata and Prep for AI settings; general Data agent instructions are not passed to its DAX generator.
6. Connecting the new Data agent to the hosted Fabric IQ agent is a **separate configuration step**. Until that connection changes, the app still uses the old data. Preserve the shared agents; prefer a dedicated hosted agent for this demo. If the hosted endpoint changes, update `FABRIC_IQ_AGENT_URL` in the decision demo's root environment file and restart the local workflow backend.

Suggested semantic-model AI instructions:

```text
This model contains explicitly synthetic decision-demo data, not customer records.
Query sales_performance. Report the exact reportingPeriodLabel, minimum/maximum
businessDate, and the number of days covered per territory. Select ONE reporting
window; never combine overlapping scenario windows. SUM revenue and quota once
per territory within that window, then calculate aggregate variance.
Do not call this a complete quarter when the reporting window is shorter.
Explicitly return reportingPeriodStart, reportingPeriodEnd, and effectiveAt.
Use stored effectiveAt as the source-effective date, preserving its verified UTC
timezone as an ISO timestamp with Z. generatedAt is only file creation time;
never substitute refresh or query time for effectiveAt. If source dates disagree
or the source timezone cannot be verified, report the ambiguity rather than guess.
Include the semantic-model/table reference and sourceId identifiers supporting
the returned facts. Never invent citations, CRM revenue, or buyer intent.
```

Use the generated manifest to check the answers. `sourceId` is synthetic lineage, not independent verification or a public URL. The hosted Fabric IQ layer must still return the strict JSON shape expected by the application; the script does not change that contract.

The app explicitly requests one stored reporting window and its source-effective dates, with a fiscal-period fallback for older models without date columns. A correctly returned date does not bypass missing-citation checks, and incomplete numeric totals are rejected rather than filled in.

For recurring refresh, configure a supported persistent source, such as the same CSV item in OneDrive/SharePoint, and refresh/synchronize that configured import model. A new versioned Lakehouse directory is not automatically the new source. Keep one scenario window in the active model; appending overlapping daily bundles double-counts financial totals.

## What Still Needs Integration

The current live adapter uses **territory totals**, not opportunity records. The opportunity file prepares account-level data for a later semantic-model and adapter change. Uploading it alone does not enable account ranking. For a multi-table model, import both CSVs in Power BI Desktop, preserve nullable types, and avoid joining opportunity rows directly to sales facts before summing revenue/quota. Several opportunities share a territory, so that join would duplicate financial totals.

The scenarios include a strong meeting request, a paused high-value account, an uncertain product fit, a similar-name unverified entity, an incomplete enterprise buying signal, and a smaller clear-fit expansion. They supply meaningful tradeoffs without prescribing model predictions or manufacturing disagreement.

Updating Fabric does **not** fix stale Web IQ context or missing Foundry IQ product-document dates. Those sources still need genuine dates, provenance, and relevant context. Shared policy checks remain unchanged, and can still prevent inference. No synthetic web hazards, geographic mappings, or product capabilities are introduced by this script.

## Source Validation Blockers

Live checks have returned the correct Fabric totals and stored source IDs, but have also returned a single day's amounts labelled as full-window totals. For example, Central revenue of 21,428.58 is a daily allocation, not the expected 300,000 period total. Do not treat the live comparison as ready merely because dates or citations appear. Structural JSON validation cannot prove numeric aggregation is correct.

In the demo semantic model, define explicit SUM measures for revenue and quota, and configure a **Prep for AI > Verified answer** for the territory performance question. The verified query must select one reporting window and aggregate across all its daily rows. Group by territory/window only; aggregate source IDs and business dates separately rather than grouping financial totals by those daily fields. Confirm the three period totals against the manifest and inspect the actual generated DAX. Updating this shared model or publishing hosted-agent/index changes requires separate approval.

The local Web request uses the existing two-day policy window and distinguishes publication/update dates from crawl or retrieval times. A current-looking event description still requires a verified source timestamp. The product seed records contain date-only `lastUpdated` metadata separately from their indexed text; a hosted context may omit it, and the date alone does not establish a timezone-aware effective timestamp. Expose genuine source date/timezone metadata in the hosted context rather than substituting deployment or query time. Until these source issues are repaired, missing effective dates continue to require review.

## Fabric Wrapper Diagnostics

The hosted Fabric wrapper emits `fabric_tool_diagnostic` console records at authentication, connection, initialization, tool discovery, tool execution, and connection cleanup. Each record includes a per-call `diagnosticId`, stage, event, and elapsed milliseconds. These temporary diagnostic records use warning level so they remain visible without enabling verbose SDK logging.

Wrapper failures return a sanitized error object to the hosting agent instead of relying on a generic function-failed message. `FABRIC_TOOL_FAILURE` includes exception class names and numeric MCP/HTTP codes when available; `FABRIC_MCP_ERROR` identifies a tool-reported error, and `FABRIC_NO_TOOLS` identifies empty tool discovery. Cancellation is logged and re-raised. Successful source answers are returned unchanged.

Diagnostics do not log credentials, authorization headers, questions, source answers, exception messages, or raw tracebacks. An error object is not source evidence and must not be used to invent rows, dates, or references. A completed MCP call can still contain a semantic-query refusal; inspect the returned source answer separately.

The shared `fabriciq-sales-agent` must only be redeployed with user approval. Deploy that service alone, preserve its existing Fabric identity and model configuration, and do not run `azd provision` for a diagnostic code update. A deployment smoke test does not establish that the complete three-source decision comparison is ready.

### Version 21 Verification

The approved diagnostic-only deployment created active version 21. Compared with version 20, environment values, CPU, memory, protocols, runtime, and entry point were unchanged. The generated local deployment environment is ignored by Git and does not store the Fabric client secret. All 27 backend tests passed, including five focused diagnostic tests.

One app-shaped request in a fresh version-21 session returned the expected synthetic window (2026-10-01 through 2026-10-14), all three territory totals (Central 300000/350000, South 110000/210000, West 210000/200000), `2026-10-14T23:59:59Z`, and the matching first/last source IDs. Session console records confirmed successful authentication, connection, initialization, tool discovery, tool execution, and cleanup under one diagnostic ID. The wrapper completed in about 58 seconds; the CLI reported about 68 seconds for the hosted invocation.

This single successful request does not establish consistent retrieval, independent verification of every generated claim, browser/backend integration, or readiness of the other sources. No decision-model comparison was run. The evaluation suite was explicitly deferred.

## Local Validation

From this repository in WSL:

```bash
.venv/bin/python -m unittest discover -s scripts -p test_seed_decision_demo.py -v
```

Tests generate files only in temporary local directories. They validate coverage, exact totals, fiscal/date boundaries, UTC timestamps, unknowns, IDs, labels, CSV serialization, hashes, and overwrite refusal. They do not verify a Fabric session, semantic-model import, service-principal access, or hosted retrieval.

## References

- [Fabric notebook Lakehouse file access](https://learn.microsoft.com/fabric/data-science/read-write-pandas#reading-and-writing-various-file-formats)
- [Import CSV data into a Power BI semantic model](https://learn.microsoft.com/power-bi/connect-data/service-comma-separated-value-files)
- [CSV synchronization from OneDrive or SharePoint](https://learn.microsoft.com/power-bi/connect-data/refresh-csv-file-onedrive)
- [Semantic-model Prep for AI settings used by Fabric Data agent](https://learn.microsoft.com/fabric/data-science/semantic-model-best-practices)