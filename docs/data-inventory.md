# Data & system-of-record inventory

This is the bottom of the stack: before any normalization or UI work, know what data exists, where it actually lives, and which Microsoft "IQ" grounding product maps to it. Each row below has a corresponding raw, source-shaped mock file under `src/data/raw/` — Stage 2 will show what it looks like to normalize each one into a citable, agent-ready record.

| # | Data domain | System of record | Why that's the system of record | Mapped IQ product | Mock file |
|---|---|---|---|---|---|
| 1 | CRM — accounts, opportunities, leads, account teams | Dynamics 365 Sales (assumed) | Tells you which accounts are covered, cross-sell/upsell angles, and captures dispatch for next-step lead creation & follow-up | **Fabric IQ** | `src/data/raw/crm.js` |
| 2 | Sales performance semantic model | Power BI semantic model over Fabric/OneLake | Revenue vs. quota by fiscal year/quarter/month, territory and segment heat, individual seller/team performance | **Fabric IQ** | `src/data/raw/salesPerformance.js` |
| 3 | FieldForge product content (marketing, sales, technical) | Indexed knowledge store, assumed searchable via Foundry IQ | Positioning, competitive differentiation, and roadmap don't live in a structured system — they're unstructured docs | **Foundry IQ** | `src/data/raw/productDocs.js` |
| 4 | M365 — calendar, inbox, Teams/IM (sellers & technical sellers) | Microsoft Graph | Scheduling next steps and correlating outreach with buyers requires the org's actual conversation history | **Work IQ** | `src/data/raw/m365.js` |
| 5 | Public permits/construction records (US, targeted states/counties) | Municipal/county permit registries | Permit filings are public records held by the municipality, not internal systems | **Web IQ** | `src/data/raw/permits.js` |
| 6 | Climate/disaster risk (storm, flood, fire, earthquake, forecasted risk e.g. El Niño) | NOAA/FEMA/public risk feeds | Public hazard and forecast data, geographically scoped alongside permit activity | **Web IQ** | `src/data/raw/climateRisk.js` |
| 7 | Product usage/telemetry | Internal telemetry warehouse | Adoption trends signal expansion opportunity or renewal risk that CRM data alone won't show | **Fabric IQ** | `src/data/raw/telemetry.js` |
| 8 | Support/case history | Support system of record (e.g. Dynamics Customer Service) | Case volume, priority, and CSAT are the leading indicators of account health and renewal risk | **Fabric IQ** | `src/data/raw/supportCases.js` |

Stage 2's normalized console (`src/data/mockRecords.js`) now covers all 8 domains above individually, plus 2 composite records that join across domains (e.g. renewal risk from CRM + telemetry + support cases on `accountId`) — the console also has a query input that keyword-matches a typed question against the grounded records, simulating what an agent's retrieval step would surface.

See [`data-relationships.md`](./data-relationships.md) for how these 8 domains classify (structured/semi-structured/unstructured) and join to each other.
