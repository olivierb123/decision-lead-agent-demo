# Data governance & guardrails

Stage 1 established what data exists and where. Stage 2 showed it normalized into citable, queryable records. Stage 3 is the layer that makes grounding across 8 domains and 2 IQ products safe to actually operationalize: who can see what, how confident an answer is, and what was asked.

## Access control — personas

The console simulates three roles, each granted access to a subset of the 8 canonical domains from [`data-inventory.md`](./data-inventory.md). A record is fully blocked — not partially redacted — if any of its `sourceDomains` fall outside the active persona's `allowedDomains` (`src/data/personas.js`). Binary blocking matches the same principle as citation enforcement below: an agent shouldn't give a partial answer if it can't fully cite it.

| Persona | Allowed domains | Rationale |
|---|---|---|
| **Sales Rep** | CRM, Sales Performance, Product Docs, M365, Permits, Climate / Disaster Risk | Everything tied to running and closing their own deals — no account-health telemetry or support case data. |
| **Customer Success** | CRM, Telemetry, Support Cases | Account health and support ownership — no visibility into pipeline mechanics or competitive material. |
| **Executive** | All 8 domains | Full access. |

This split was checked against all 10 records in `mockRecords.js` and produces a deliberately asymmetric demo: each of the 2 composite records is fully visible to exactly the role it's meant for and blocked for the other.

- `composite-renewal-risk` (needs CRM + Telemetry + Support Cases) → **blocked** for Sales Rep, full for Customer Success and Executive.
- `composite-upsell-context` (needs CRM + Permits + Climate / Disaster Risk) → full for Sales Rep, **blocked** for Customer Success, full for Executive.

The console defaults to **Sales Rep** on load so the blocking guardrail is visible immediately, without switching anything.

## Citation / confidence enforcement

Every record carries a `confidence` field: `'High'` or `'Needs verification'`. This isn't a new judgment call — it falls directly out of the hard-vs-fuzzy join classification already documented in [`data-relationships.md`](./data-relationships.md):

- **`High`** — the record is single-source, or every join behind a composite record is a hard/ID join (`accountId`, or a geographic key like `state` + `county`).
- **`Needs verification`** — the record relies on at least one fuzzy/inferred join (name-match, email-to-person match, text mention).

Only `composite-upsell-context` qualifies as `Needs verification` — it joins the CRM account to a public permit filing by matching the applicant name against the account name, and permits carry no CRM foreign key. All 9 other records are `High`.

This is rendered as a badge on the record card so an agent-facing consumer can't mistake a fuzzy-matched composite for the same level of certainty as a hard-joined one.

## Audit log

The "Stage 3: Governance" tab renders a live, session-recorded audit trail: every query submitted in Stage 2's search box (on Enter) is appended with the active persona, the question text, and how many of the matched records were visible vs. blocked under that persona. It resets on page refresh — there's no backend, so nothing persists across sessions. This is the same "simulate honestly, don't fake persistence" approach Stage 2 took with its keyword matcher.
