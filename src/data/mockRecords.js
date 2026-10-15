export const mockRecords = [
  {
    id: 'fabric-iq-sales',
    domain: 'Sales performance (Power BI)',
    groundingSources: ['Fabric IQ'],
    sourceDomains: ['Sales Performance'],
    confidence: 'High',
    query: 'Which territories are behind quota this quarter, and by how much?',
    reasoning:
      "This lives entirely inside the org's own structured business data — sales facts, quota, and territory hierarchies already modeled in Fabric/OneLake. Fabric IQ's semantic layer understands that business model directly, so the agent doesn't need to guess table joins or reinvent a metric definition.",
    citations: ['Power BI semantic model: Sales Performance — FY26 Q1 rows (territory × month)'],
    answerPreview:
      "West is down all quarter (Jul -13.1%, Aug -4.0%) and South is furthest behind (Aug -32.2%). Central is ahead both months it's reported (Jul +4.7%, Sep +6.6%).",
  },
  {
    id: 'work-iq-m365',
    domain: 'Microsoft 365 content',
    groundingSources: ['Work IQ'],
    sourceDomains: ['M365'],
    confidence: 'High',
    query: 'What did Apex Design & Build last confirm on the Field Ops Expansion pricing follow-up?',
    reasoning:
      "The answer lives in the org's own M365 content — an email thread — not in a structured database or on the public web. Work IQ grounds directly in that Graph data (mail, calendar, Teams) instead of the agent trying to reconstruct it from memory.",
    citations: [
      'M365 email MAIL-1: "RE: Field Ops Expansion – pricing follow-up" (marcus.vance@apexdb.example → dana.whitfield@fieldforge.example, 2026-09-19)',
    ],
    answerPreview:
      "Apex confirmed the 2-year term works on their end, contingent on the discount holding — the last open item on OPP-5501 (Field Ops Expansion, $76K, Negotiation stage).",
  },
  {
    id: 'web-iq-permits',
    domain: 'Public permits',
    groundingSources: ['Web IQ'],
    sourceDomains: ['Permits'],
    confidence: 'High',
    query: 'Has Apex Design & Build pulled any new commercial permits recently?',
    reasoning:
      "Municipal permit filings are public real-world data, not something in the org's own systems. Web IQ is built for exactly this — citation-ready retrieval over public/registry data — rather than a generic web scrape with no provenance.",
    citations: ['Austin, TX municipal permit registry — filing CP-24-11892 (filed 2026-09-19)'],
    answerPreview:
      'Yes — Apex Design & Build (Austin, TX) filed a $640K commercial remodel permit 5 days ago. Owner of record: Marcus Vance.',
  },
  {
    id: 'crm-cross-sell',
    domain: 'CRM — accounts & opportunities',
    groundingSources: ['Fabric IQ'],
    sourceDomains: ['CRM'],
    confidence: 'High',
    query: 'Is there an active cross-sell motion at Summit Ridge Builders, and where does it stand?',
    reasoning:
      "Pipeline stage and ownership live in the CRM system of record, not in a document or inbox. Fabric IQ's semantic layer over that structured data is what can answer this precisely instead of guessing at deal status.",
    citations: [
      'Dynamics 365 Sales: Accounts × Opportunities — OPP-5502 (Summit Ridge – Multi-site Rollout, Cross-sell, Proposal stage)',
    ],
    answerPreview:
      'Yes — Summit Ridge Builders (Enterprise, $412K ARR) has a $210K cross-sell opportunity in Proposal stage, targeting close by Nov 30, owned by Marcus Cole.',
  },
  {
    id: 'foundry-iq-docs',
    domain: 'Product documentation',
    groundingSources: ['Foundry IQ'],
    sourceDomains: ['Product Docs'],
    confidence: 'High',
    query: 'How do we position FieldForge against Procore in a competitive deal?',
    reasoning:
      "This lives only in unstructured sales enablement content — no structured system tracks 'how to win a competitive deal.' Foundry IQ's indexed retrieval over that content is built for exactly this kind of grounding.",
    citations: [
      'Foundry IQ index: DOC-2 — Competitive Battlecard: FieldForge vs. Procore Field Productivity (updated 2026-08-20)',
    ],
    answerPreview:
      "Lead with real-time crew dispatch and permit-triggered lead capture — FieldForge's edge. Procore has broader project-management depth, but a weaker field-to-CRM handoff is the wedge.",
  },
  {
    id: 'web-iq-climate',
    domain: 'Climate / disaster risk',
    groundingSources: ['Web IQ'],
    sourceDomains: ['Climate / Disaster Risk'],
    confidence: 'High',
    query: "What's the storm risk outlook for our Miami-Dade project?",
    reasoning:
      "Public hazard and forecast data isn't tracked in any internal system. Web IQ is built for citation-ready retrieval over exactly this kind of public risk data.",
    citations: ['NOAA National Hurricane Center — risk record REG-FL-MIAMIDADE (High, as of 2026-09-10)'],
    answerPreview:
      'High storm risk as of the latest NOAA assessment — worth factoring into the Coastal Grade & Pave project timeline and any insurance/contingency conversation.',
  },
  {
    id: 'fabric-iq-telemetry',
    domain: 'Product telemetry',
    groundingSources: ['Fabric IQ'],
    sourceDomains: ['Telemetry'],
    confidence: 'High',
    query: "How is Summit Ridge Builders' product adoption trending?",
    reasoning:
      'Usage and adoption trend data lives in the internal telemetry warehouse, not in CRM. Fabric IQ is what actually understands trend-over-time here.',
    citations: [
      'Telemetry warehouse: usageRecords — ACC-1002, FY26-Q1 (118 active users, 61% feature adoption, trend: flat)',
    ],
    answerPreview:
      'Steady — 118 active users and 61% feature adoption, trend flat. No adoption-driven risk signal here, unlike some other accounts this quarter.',
  },
  {
    id: 'fabric-iq-support',
    domain: 'Support case history',
    groundingSources: ['Fabric IQ'],
    sourceDomains: ['Support Cases'],
    confidence: 'High',
    query: "What was the outcome of Apex Design & Build's last support case?",
    reasoning:
      "Case history lives in the support system of record, not CRM. Fabric IQ grounds directly in that structured case data instead of the agent guessing at resolution status.",
    citations: [
      'Support system of record: CASE-3001 — "Dispatch sync delay on mobile app" (Resolved, CSAT 4/5, opened 2026-08-22, closed 2026-08-25)',
    ],
    answerPreview: 'Resolved in 3 days with a CSAT of 4/5 — no lingering issue, nothing here suggests renewal risk.',
  },
  {
    id: 'composite-renewal-risk',
    domain: 'Cross-source: renewal risk',
    groundingSources: ['Fabric IQ'],
    sourceDomains: ['CRM', 'Telemetry', 'Support Cases'],
    confidence: 'High',
    query: 'Is Coastal Grade & Pave at renewal risk, and why?',
    reasoning:
      'No single source tells this story — CRM alone shows a normal-looking account, telemetry alone shows a usage dip, and the support system alone shows one open ticket. Joining all three on `accountId` is what turns three unremarkable signals into a clear renewal-risk call.',
    citations: [
      'Dynamics 365 Sales: ACC-1003 — Priya Nandan, Mid-Market, $96K ARR',
      'Telemetry warehouse: usageRecords — ACC-1003, 22% feature adoption, trend: down',
      'Support system of record: CASE-3002 — "Unable to import crew roster CSV" (Open, High priority, renewal-risk flagged)',
    ],
    answerPreview:
      'Yes. Usage is down to 22% adoption and trending further down, and there’s an open high-priority case explicitly flagged for renewal risk with no resolution yet. Worth a proactive save-play before the next renewal conversation.',
  },
  {
    id: 'composite-upsell-context',
    domain: 'Cross-source: upsell + real-world risk',
    groundingSources: ['Fabric IQ', 'Web IQ'],
    sourceDomains: ['CRM', 'Permits', 'Climate / Disaster Risk'],
    confidence: 'Needs verification',
    query: 'Should we prioritize the Apex Design & Build upsell, and is there anything to flag?',
    reasoning:
      'CRM alone tells you the deal stage. Joining it with the permit filing (a fuzzy, name-matched join — permits carry no CRM foreign key) and a geographic climate-risk lookup (state + county match) turns "deal in Negotiation" into the real-world context behind why now, and what to watch for.',
    citations: [
      'Dynamics 365 Sales: OPP-5501 — Apex – Field Ops Expansion, Upsell, $76K, Negotiation stage, owner Dana Whitfield',
      'Austin, TX municipal permit registry — CP-24-11892 (Commercial Remodel, $640K project value, filed 2026-09-19)',
      'NOAA / National Interagency Fire Center — risk record REG-TX-TRAVIS (wildfire, Moderate, as of 2026-09-01)',
    ],
    answerPreview:
      'Yes — Apex just filed a $640K commercial remodel permit in Austin, a strong signal the Field Ops Expansion upsell ($76K, already in Negotiation) is well-timed. One flag: the project sits in a moderate wildfire-risk zone, worth a mention in the timeline/insurance conversation, not a blocker.',
  },
  {
    id: 'composite-leadgen-focus',
    domain: 'Cross-source: lead generation strategy',
    groundingSources: ['Fabric IQ', 'Web IQ', 'Foundry IQ'],
    sourceDomains: ['Sales Performance', 'Climate / Disaster Risk', 'Product Docs'],
    confidence: 'High',
    query:
      'Where should we focus new lead generation — factoring in territory quota performance, regional storm risk, and our competitive edge against Procore?',
    reasoning:
      "No single IQ can answer this alone — quota performance lives in the sales semantic model, storm risk lives in public hazard data, and competitive positioning lives in sales enablement docs. Combining all three in one query turns three separate lookups into an actual resource-allocation call: which territory needs the lead-gen push, whether real-world risk changes the calculus, and how to win once those leads are in the pipeline.",
    citations: [
      'Power BI semantic model: Sales Performance — FY26 Q1 rows (territory × month)',
      'NOAA National Hurricane Center — risk record REG-FL-MIAMIDADE (High, as of 2026-09-10)',
      'Foundry IQ index: DOC-2 — Competitive Battlecard: FieldForge vs. Procore Field Productivity (updated 2026-08-20)',
    ],
    answerPreview:
      "South is furthest behind quota this quarter (Aug -32.2%), which makes it the clearest lead-gen target — but Miami-Dade carries a High storm-risk rating right now, so push generation toward inland South accounts first. Lead with FieldForge's real-time crew dispatch and permit-triggered lead capture against Procore once those leads are qualified.",
  },
]
