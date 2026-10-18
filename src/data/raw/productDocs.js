export const docs = [
  {
    docId: 'DOC-1',
    title: 'FieldForge Value Proposition One-Pager',
    type: 'marketing',
    audience: 'Prospects',
    summary:
      'Positions FieldForge as the field-to-office coordination layer for construction and civil contractors, cutting dispatch delays and missed follow-ups.',
    lastUpdated: '2026-08-01',
  },
  {
    docId: 'DOC-2',
    title: 'Competitive Battlecard: FieldForge vs. Procore Field Productivity',
    type: 'sales',
    audience: 'Sellers',
    summary:
      'FieldForge wins on real-time crew dispatch and permit-triggered lead capture; Procore has broader project-management depth but a weaker field-to-CRM handoff.',
    lastUpdated: '2026-08-20',
  },
  {
    docId: 'DOC-3',
    title: 'FieldForge Technical Architecture Overview',
    type: 'technical',
    audience: 'Technical sellers / SEs',
    summary:
      'Covers integration points with Dynamics 365, Microsoft Graph, and public permit data feeds; describes the grounding pipeline behind AI-assisted dispatch.',
    lastUpdated: '2026-09-05',
  },
  {
    docId: 'DOC-4',
    title: 'FY27 Product Roadmap Snapshot',
    type: 'technical',
    audience: 'Internal + select prospects',
    summary:
      'Near-term roadmap includes climate-risk-aware scheduling and expanded county-level permit coverage.',
    lastUpdated: '2026-09-15',
  },
]

export const decisionDemoDocs = docs.map((doc) => {
  const docId = `DECISION-DEMO-V1-${doc.docId}`
  const effectiveAt = `${doc.lastUpdated}T00:00:00Z`
  const timestampProvenance = 'Simulated UTC midnight for this synthetic fixture; the original document has only a calendar date, with no verified time or timezone.'
  return {
    ...doc,
    id: docId,
    docId,
    originalDocId: doc.docId,
    originalLastUpdated: doc.lastUpdated,
    datasetVersion: 'v1',
    isSynthetic: true,
    dataClassification: 'SYNTHETIC_DEMO',
    effectiveAt,
    timestampProvenance,
    content: [
      'SYNTHETIC DEMO PRODUCT DOCUMENT. Not a verified current product publication.',
      `${doc.title}. ${doc.summary} (type: ${doc.type}, audience: ${doc.audience})`,
      `docId: ${docId}; originalDocId: ${doc.docId}; original lastUpdated: ${doc.lastUpdated} (date precision only).`,
      `Synthetic fixture effectiveAt: ${effectiveAt}; timezone: UTC; isSynthetic: true; datasetVersion: v1.`,
      timestampProvenance,
    ].join('\n'),
  }
})
