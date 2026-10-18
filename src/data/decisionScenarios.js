export const decisionActions = {
  outreach: 'Contact the account now about a currently supported sales motion.',
  research: 'Clarify product requirements or buying context before recommending outreach.',
  defer: 'Respect a documented temporary pause and revisit on its review date.',
  cannot_tell: 'Send to human review because required evidence is missing or unverified.',
}

export const decisionScenario = {
  schemaVersion: 1,
  scenarioId: 'fieldforge-next-action-v1',
  evidenceMode: 'synthetic',
  asOf: '2026-10-15T12:00:00Z',
  reportingPeriod: { start: '2026-10-01', through: '2026-10-14' },
  description: 'Standalone fictional sales motions, not live CRM records or real hazard forecasts.',
  productEvidence: [
    {
      evidenceId: 'DEMO-PRODUCT-CURRENT',
      source: 'Foundry IQ',
      status: 'available',
      observedAt: '2026-10-15T09:00:00Z',
      effectiveAt: '2026-10-14T09:00:00Z',
      text: 'FieldForge currently supports crew dispatch, permit-triggered lead capture, and a Dynamics 365 handoff. It complements rather than replaces a complete enterprise project-management suite.',
    },
    {
      evidenceId: 'DEMO-PRODUCT-ROADMAP',
      source: 'Foundry IQ',
      status: 'available',
      observedAt: '2026-10-15T09:00:00Z',
      effectiveAt: '2026-10-14T09:00:00Z',
      text: 'Climate-risk-aware scheduling is a roadmap concept, not generally available. There is no committed availability date. Sellers must not promise it as an existing capability.',
    },
  ],
  candidates: [
    {
      candidateId: 'DEMO-APEX',
      name: 'Apex Design & Build',
      motion: 'Existing-account dispatch expansion',
      opportunityAmount: 76000,
      projectValue: 640000,
      territory: 'West',
      geography: { state: 'TX', county: 'Travis' },
      entityMatch: 'verified',
      outreachPauseUntil: null,
      buyingSignals: { meetingRequested: true, requiresUnavailableCapability: false },
      territoryPerformance: { revenue: 168000, quota: 175000 },
      evidence: [
        {
          evidenceId: 'DEMO-APEX-BUYING',
          source: 'Fabric IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-14T09:00:00Z',
          text: 'An existing customer has an approved commercial remodel and budget for a dispatch expansion. The operations buyer requested a crew-dispatch demo this week. Their existing project-management suite will remain in place.',
        },
        {
          evidenceId: 'DEMO-APEX-CONTEXT',
          source: 'Web IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-15T08:00:00Z',
          text: 'Synthetic Travis County scenario: moderate regional wildfire risk, but no project closure or customer-requested contact restriction is documented.',
        },
      ],
    },
    {
      candidateId: 'DEMO-COASTAL',
      name: 'Coastal Grade & Pave',
      motion: 'Existing-account field operations expansion',
      opportunityAmount: 158000,
      projectValue: 1250000,
      territory: 'South',
      geography: { state: 'FL', county: 'Miami-Dade' },
      entityMatch: 'verified',
      outreachPauseUntil: '2026-10-23T09:00:00Z',
      buyingSignals: { meetingRequested: false, requiresUnavailableCapability: false },
      territoryPerformance: { revenue: 61000, quota: 90000 },
      evidence: [
        {
          evidenceId: 'DEMO-COASTAL-BUYING',
          source: 'Fabric IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-14T09:00:00Z',
          text: 'An existing customer plans a dispatch expansion. South has the largest quota shortfall, but the account contact explicitly requested no sales outreach before October 23 while the team handles disruption.',
        },
        {
          evidenceId: 'DEMO-COASTAL-CONTEXT',
          source: 'Web IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-15T08:00:00Z',
          text: 'Synthetic Miami-Dade scenario: high storm disruption and a project-site closure. This is fictional demo evidence, not a current NOAA alert.',
        },
      ],
    },
    {
      candidateId: 'DEMO-SUMMIT',
      name: 'Summit Ridge Builders',
      motion: 'Existing-account multi-site cross-sell',
      opportunityAmount: 210000,
      projectValue: 2100000,
      territory: 'Central',
      geography: { state: 'OH', county: 'Franklin' },
      entityMatch: 'verified',
      outreachPauseUntil: null,
      buyingSignals: { meetingRequested: false, requiresUnavailableCapability: true },
      territoryPerformance: { revenue: 405000, quota: 380000 },
      evidence: [
        {
          evidenceId: 'DEMO-SUMMIT-BUYING',
          source: 'Fabric IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-14T09:00:00Z',
          text: 'The largest opportunity asks for one system to replace enterprise project management and automatically reschedule around climate risk at launch. The buyer has not confirmed whether dispatch alone would meet the need.',
        },
        {
          evidenceId: 'DEMO-SUMMIT-CONTEXT',
          source: 'Web IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-15T08:00:00Z',
          text: 'Synthetic Franklin County scenario: no current project disruption is reported. Absence of disruption does not establish product fit.',
        },
      ],
    },
    {
      candidateId: 'DEMO-UNVERIFIED',
      name: 'Apex Construction Services',
      motion: 'Unverified permit-triggered prospect',
      opportunityAmount: null,
      projectValue: 3100000,
      territory: 'West',
      geography: { state: 'TX', county: 'Travis' },
      entityMatch: 'unverified',
      outreachPauseUntil: null,
      buyingSignals: { meetingRequested: false, requiresUnavailableCapability: false },
      territoryPerformance: { revenue: 168000, quota: 175000 },
      evidence: [
        {
          evidenceId: 'DEMO-UNVERIFIED-BUYING',
          source: 'Fabric IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-14T09:00:00Z',
          text: 'A new permit applicant has a similar name to Apex Design & Build, but no verified account ID, buyer, budget, or stated requirement. Permit project value is not FieldForge opportunity value.',
        },
        {
          evidenceId: 'DEMO-UNVERIFIED-CONTEXT',
          source: 'Web IQ',
          status: 'available',
          observedAt: '2026-10-15T09:00:00Z',
          effectiveAt: '2026-10-15T08:00:00Z',
          text: 'Synthetic registry scenario: the permit is approved, but the applicant address differs from the existing Apex account. The entity relationship is not verified.',
        },
      ],
    },
  ],
}

export const decisionEvaluationCases = [
  {
    caseId: 'apex-timely-fit',
    candidateId: 'DEMO-APEX',
    expectedAction: 'outreach',
    expectedBasis: 'A requested demo maps to currently available dispatch capabilities.',
  },
  {
    caseId: 'coastal-contact-pause',
    candidateId: 'DEMO-COASTAL',
    expectedAction: 'defer',
    expectedBasis: 'A customer-requested pause outweighs territory urgency and deal size.',
  },
  {
    caseId: 'summit-roadmap-mismatch',
    candidateId: 'DEMO-SUMMIT',
    expectedAction: 'research',
    expectedBasis: 'Clarify requirements rather than sell a roadmap capability as available.',
  },
  {
    caseId: 'unverified-company',
    candidateId: 'DEMO-UNVERIFIED',
    expectedAction: 'cannot_tell',
    expectedBasis: 'Do not transfer an existing account buying signal to a similarly named prospect.',
  },
  {
    caseId: 'coastal-remote-planning-request',
    candidateId: 'DEMO-COASTAL',
    outreachPauseUntil: null,
    buyingText: 'The project site is temporarily closed, but the buyer explicitly requests a remote dispatch-planning discussion this week. Existing software will remain. No sales-contact pause is in effect.',
    expectedAction: 'outreach',
    expectedBasis: 'The same hazard evidence need not block a relevant remote discussion requested by the buyer.',
  },
  {
    caseId: 'apex-stale-context',
    candidateId: 'DEMO-APEX',
    contextEffectiveAt: '2026-09-15T08:00:00Z',
    expectedAction: 'cannot_tell',
    expectedBasis: 'Refresh stale required evidence before recommending a time-sensitive action.',
  },
  {
    caseId: 'apex-context-failure',
    candidateId: 'DEMO-APEX',
    contextStatus: 'error',
    expectedAction: 'cannot_tell',
    expectedBasis: 'A failed retrieval is not evidence of low risk.',
  },
]

export function buildDecisionState(caseId) {
  const evaluationCase = decisionEvaluationCases.find((entry) => entry.caseId === caseId)
  if (!evaluationCase) throw new Error(`Unknown decision case: ${caseId}`)

  const candidate = structuredClone(
    decisionScenario.candidates.find((entry) => entry.candidateId === evaluationCase.candidateId),
  )
  if (Object.hasOwn(evaluationCase, 'outreachPauseUntil')) {
    candidate.outreachPauseUntil = evaluationCase.outreachPauseUntil
  }
  if (evaluationCase.buyingText) candidate.evidence[0].text = evaluationCase.buyingText
  if (evaluationCase.contextEffectiveAt) candidate.evidence[1].effectiveAt = evaluationCase.contextEffectiveAt
  if (evaluationCase.contextStatus) {
    candidate.evidence[1].status = evaluationCase.contextStatus
    candidate.evidence[1].text = null
  }

  return {
    schemaVersion: decisionScenario.schemaVersion,
    scenarioId: decisionScenario.scenarioId,
    evidenceMode: decisionScenario.evidenceMode,
    asOf: decisionScenario.asOf,
    reportingPeriod: structuredClone(decisionScenario.reportingPeriod),
    candidate,
    productEvidence: structuredClone(decisionScenario.productEvidence),
  }
}

export const demoChapters = [
  {
    id: 'base', number: 1, title: 'Routine decision', approach: 'Rules first',
    question: 'Do we need a model when the decision is already explicit?',
    lesson: 'When ranks and actions agree, prefer the simplest adequate approach. Compare measured time and token cost; raw priority scores need not match.',
    targetCandidateId: 'DEMO-APEX',
    preferredMethod: 'rules',
    logic: [
      { title: 'Apply shared policy', detail: 'Respect contact pauses and send unverified or incomplete evidence to review.' },
      { title: 'Calculate the fixed score', detail: '30% value (capped at $250K) + 20% proportional quota gap + 30% meeting requested + 20% capability fit; scaled to 0-3.' },
      { title: 'Choose the next action', detail: 'Meeting requested and no unavailable requirement: contact. Otherwise, research.' },
      { title: 'Validate and rank', detail: 'Check allowed actions and rank eligible accounts by the resulting score.' },
    ],
    task: 'Rank accounts and choose next actions.',
    inputs: [
      { evidenceId: 'DEMO-APEX-BUYING', subject: 'Apex', now: '$76,000 approved dispatch expansion. Buyer requested a demo; current capabilities fit.' },
      { evidenceId: 'DEMO-SUMMIT-BUYING', subject: 'Summit', now: '$210,000 opportunity. Requires unavailable capabilities; dispatch-only fit is not confirmed.' },
    ],
  },
  {
    id: 'discovery-vs-readiness', number: 2, title: 'Contextual decision', approach: 'Decision model',
    question: 'Which matters more: a large discovery estimate or a smaller funded purchase?',
    lesson: 'The formula rewards deal size and a meeting request. A decision model can recognize buying readiness and match the LLM on the leading recommendation, without generating prose.',
    targetCandidateId: 'DEMO-SUMMIT',
    preferredMethod: 'decision1',
    logic: [
      { title: 'Apply shared policy', detail: 'Use the same eligible accounts and evidence as the other approaches.' },
      { title: 'Evaluate buying context', detail: 'The model receives approved budget, buying readiness, fit and timing alongside deal value.' },
      { title: 'Return an action and score', detail: 'Decision-1 answers bounded choice and ordinal-score questions, not a generated plan.' },
      { title: 'Validate and rank', detail: 'Check actions and score bounds, then rank accounts. No written model rationale is returned.' },
    ],
    task: 'Same task: rank accounts and choose next actions.',
    inputs: [
      { evidenceId: 'DEMO-APEX-BUYING', subject: 'Apex', before: '$76,000 approved expansion with confirmed fit.', now: '$240,000 exploratory estimate. No approved budget, sponsor or buying process.' },
      { evidenceId: 'DEMO-SUMMIT-BUYING', subject: 'Summit', before: '$210,000 opportunity requiring unavailable capabilities.', now: '$90,000 funded dispatch pilot. Requirements and security review complete; scoping requested today.' },
    ],
  },
  {
    id: 'reasoned-rollout', number: 3, title: 'Decision plus a plan', approach: 'Generative LLM',
    question: 'Can the funded pilot meet its deadline and budget, and what is the implementation plan?',
    lesson: 'Selecting an account is not the whole deliverable. The LLM constructs a schedule and calls a budget-calculation tool; independent checks verify the result. Rules and Decision-1 remain decision-only baselines, not plan generators.',
    targetCandidateId: 'DEMO-SUMMIT',
    preferredMethod: 'llm',
    logic: [
      { title: 'Read evidence and constraints', detail: 'Assess the funded pilot, phase order, business days, deadline and implementation budget.' },
      { title: 'Call the budget tool', detail: 'Calculate fixed setup plus phase costs and remaining budget from supplied rates and durations.' },
      { title: 'Generate the proposal', detail: 'Return ranked actions plus a dated implementation schedule, totals and evidence references.' },
      { title: 'Independently check the plan', detail: 'Validate phase order, weekdays, arithmetic, deadline and citations. Invalid plans remain rejected.' },
    ],
    task: 'Expanded task: rank accounts, then generate a schedule and tool-checked implementation budget.',
    inputs: [
      { evidenceId: 'DEMO-SUMMIT-BUYING', subject: 'Summit', before: '$90,000 funded pilot with requirements and security review complete.', now: 'Same $90,000 pilot; implementation security sign-off, migration and training still need scheduling.' },
      { evidenceId: 'DEMO-ROLLOUT-CONSTRAINTS', subject: 'Implementation constraints', before: 'No phase durations, rates or implementation budget supplied.', now: 'October 16-22; sequential 2 / 2 / 1 business-day phases at $900 / $1,400 / $600 per day. $18,000 setup; $23,500 budget.' },
    ],
  },
]

export const comparisonVariants = [
  { id: 'base', label: 'Original evidence' },
  { id: 'deadline-vs-value', label: 'Tradeoff: deadline vs deal size' },
  { id: 'discovery-vs-readiness', label: 'Tradeoff: discovery vs funded pilot' },
  { id: 'summit-fit', label: 'Summit confirms dispatch-only scope' },
  { id: 'coastal-remote', label: 'Coastal requests remote planning' },
  { id: 'stale-context', label: 'Apex context is stale' },
  { id: 'source-failure', label: 'Web IQ retrieval fails' },
  { id: 'reasoned-rollout', label: 'Reasoning: constrained rollout plan' },
]

export function buildComparisonSnapshot(variant = 'base') {
  if (!comparisonVariants.some((entry) => entry.id === variant)) throw new Error('Unknown scenario variant')
  const snapshot = structuredClone(decisionScenario)
  const apex = snapshot.candidates.find((entry) => entry.candidateId === 'DEMO-APEX')
  const coastal = snapshot.candidates.find((entry) => entry.candidateId === 'DEMO-COASTAL')
  const summit = snapshot.candidates.find((entry) => entry.candidateId === 'DEMO-SUMMIT')
  if (['summit-fit', 'deadline-vs-value', 'discovery-vs-readiness', 'reasoned-rollout'].includes(variant)) {
    summit.buyingSignals = { meetingRequested: true, requiresUnavailableCapability: false }
    summit.evidence[0].text = 'The buyer confirms a dispatch-only pilot this month, retaining the existing project-management suite. Climate scheduling is explicitly excluded. A remote demo is requested this week.'
  }
  if (variant === 'deadline-vs-value') {
    apex.evidence[0].text = 'Synthetic buying record: the operations decision-maker has approved the $76,000 dispatch expansion, confirmed product fit, and requested a remote final-scoping meeting today. Procurement must receive the implementation scope by 2026-10-16T16:00:00Z to use the approved budget; otherwise the purchase moves to the next annual cycle. The existing project-management suite remains. This is an active purchasing decision, not an exploratory demo.'
    summit.evidence[0].text = 'Synthetic buying record: the $210,000 dispatch expansion fits current capabilities and a meeting has been requested. The meeting is a non-urgent exploratory planning session for May 2027. There is no purchasing decision, implementation deadline, or approved current-cycle budget; the amount is an uncommitted pipeline estimate. The buyer has no open question requiring a seller response today and no contact restriction. Existing project-management software remains; climate scheduling is out of scope.'
  }
  if (['discovery-vs-readiness', 'reasoned-rollout'].includes(variant)) {
    apex.opportunityAmount = 240000
    summit.opportunityAmount = 90000
    apex.evidence[0].text = 'Synthetic buying record: an operations analyst requested a general dispatch discovery demo this week. No purchase sponsor, approved budget, buying process, implementation date, or agreed requirements have been established. The $240,000 amount is a seller-entered potential expansion estimate, not a buyer-approved budget. Dispatch is currently supported and no unavailable capability has been requested. Existing project-management software remains. The invitation establishes interest in discovery, not readiness to buy.'
    summit.evidence[0].text = 'Synthetic buying record: the economic buyer and procurement lead approved a $90,000 dispatch-only pilot budget, completed requirements and security review, and requested a final implementation-scoping meeting today for a 2026-10-22 rollout. No capability or buying-process questions remain open. Existing project-management software stays in place and climate scheduling is excluded. The meeting is to progress the funded purchase, not to discover whether there is a project.'
  }
  if (variant === 'reasoned-rollout') {
    summit.evidence[0].text = 'Synthetic buying record: the economic buyer and procurement lead approved a $90,000 dispatch-only pilot and requested final implementation planning for a 2026-10-22 rollout. Requirements review is complete, but the implementation security sign-off, migration and training still need scheduling. There is a separate $23,500 implementation budget. Existing project-management software remains; climate scheduling is excluded. The seller must establish whether the supplied operational constraints permit delivery before committing a date.'
    snapshot.productEvidence.push({
      evidenceId: 'DEMO-ROLLOUT-CONSTRAINTS', source: 'Foundry IQ', status: 'available',
      observedAt: '2026-10-15T09:00:00Z', effectiveAt: '2026-10-14T09:00:00Z',
      text: 'Synthetic implementation assumptions, not product guarantees: Summit can start on October 16, 2026 and must finish by October 22. Security sign-off takes two business days at $900/day, then migration takes two business days at $1,400/day, then training takes one business day at $600/day. Phases cannot overlap. Work is Monday-Friday only; no other holidays are modeled. Fixed setup costs are $18,000 and the total implementation budget is $23,500. No extra staff or accelerated work is authorized.',
    })
    snapshot.planningTask = {
      candidateId: 'DEMO-SUMMIT', earliestStart: '2026-10-16', deadline: '2026-10-22',
      budgetUsd: 23500, fixedCostUsd: 18000,
      phases: [
        { id: 'security', businessDays: 2, dailyCostUsd: 900 },
        { id: 'migration', businessDays: 2, dailyCostUsd: 1400 },
        { id: 'training', businessDays: 1, dailyCostUsd: 600 },
      ],
      evidenceIds: ['DEMO-SUMMIT-BUYING', 'DEMO-ROLLOUT-CONSTRAINTS'],
      requirement: 'Construct an ordered, non-overlapping Monday-Friday schedule from the supplied constraints, calculate total implementation cost and remaining budget, and assess the deadline. Do not invent extra resources or promise roadmap features.',
    }
  }
  if (variant === 'coastal-remote') {
    coastal.outreachPauseUntil = null
    coastal.buyingSignals.meetingRequested = true
    coastal.evidence[0].text = 'The buyer explicitly requests a remote dispatch-planning meeting this week despite the site closure. Existing software remains in place. The previous contact pause has been lifted.'
  }
  if (variant === 'stale-context') apex.evidence[1].effectiveAt = '2026-09-15T08:00:00Z'
  if (variant === 'source-failure') {
    for (const candidate of snapshot.candidates) {
      candidate.evidence[1].status = 'error'
      candidate.evidence[1].text = null
    }
  }
  return snapshot
}