import assert from 'node:assert/strict'
import test from 'node:test'
import { chapterTakeaway, comparisonWinners, fixtureSourceLabel, modelWasSkipped, salesPerformanceForSnapshot, summarizeComparison } from '../lib/decisionPresentation.js'
import { rows as salesPerformance } from './raw/salesPerformance.js'
import { decisionDemoDocs, docs } from './raw/productDocs.js'
import {
  buildDecisionState,
  buildComparisonSnapshot,
  comparisonVariants,
  demoChapters,
  decisionActions,
  decisionEvaluationCases,
  decisionScenario,
} from './decisionScenarios.js'

test('winner columns require supported shared results and measured trade-offs, not a preset method', () => {
  const snapshot = buildComparisonSnapshot('discovery-vs-readiness')
  for (const candidate of snapshot.candidates) candidate.policy = { allowedActions: ['outreach', 'research'], reasonCodes: [] }
  const branch = (first, elapsedMs, inferenceCostUsd) => ({ status: 'ok', snapshotId: 'shared', selectedIds: [first], suggestions: [], elapsedMs, inferenceCostUsd })
  const result = { mode: 'compare', snapshot, branches: { rules: branch('DEMO-APEX', 1, 0), llm: branch('DEMO-SUMMIT', 100, 0.01), decision1: branch('DEMO-SUMMIT', 10, 0.001) } }
  const chapter = demoChapters[1]
  assert.deepEqual(comparisonWinners(chapter, result), ['decision1'])
  result.branches.llm.elapsedMs = 5
  assert.deepEqual(comparisonWinners(chapter, result), ['llm', 'decision1'])
  result.branches.llm.inferenceCostUsd = null
  assert.deepEqual(comparisonWinners(chapter, result), [])
  result.branches.llm.inferenceCostUsd = 0.01
  result.branches.decision1.status = 'error'
  assert.deepEqual(comparisonWinners(chapter, result), [])
  result.branches.decision1.status = 'ok'
  result.branches.decision1.snapshotId = 'different'
  assert.deepEqual(comparisonWinners(chapter, result), [])
  result.branches.decision1.snapshotId = 'shared'
  result.branches.llm.planValidation = { status: 'invalid', feasible: false }
  assert.deepEqual(comparisonWinners(demoChapters[2], result), [])
  result.branches.llm.planValidation = { status: 'valid', feasible: true }
  assert.deepEqual(comparisonWinners(demoChapters[2], result), ['llm'])
  for (const method of Object.keys(result.branches)) result.branches[method].selectedIds = ['DEMO-APEX']
  assert.deepEqual(comparisonWinners(demoChapters[0], result), ['rules'])
  for (const branch of Object.values(result.branches)) { branch.elapsedMs = 1; branch.inferenceCostUsd = 0 }
  assert.deepEqual(comparisonWinners(demoChapters[0], result), ['rules', 'llm', 'decision1'])
  assert.deepEqual(comparisonWinners(chapter, null), [])
})

test('isolated product documents preserve source dates and disclose simulated UTC timestamps', () => {
  const dates = ['2026-08-01', '2026-08-20', '2026-09-05', '2026-09-15']
  assert.deepEqual(docs.map((doc) => doc.lastUpdated), dates)
  assert.equal(decisionDemoDocs.length, 4)
  assert.equal(new Set(decisionDemoDocs.map((doc) => doc.docId)).size, 4)
  for (const [index, fixture] of decisionDemoDocs.entries()) {
    const original = docs[index]
    assert.equal(Object.hasOwn(original, 'effectiveAt'), false)
    assert.equal(Object.hasOwn(original, 'isSynthetic'), false)
    assert.notEqual(fixture.docId, original.docId)
    assert.match(fixture.id, /^[A-Za-z0-9_-]+$/)
    assert.equal(fixture.id, fixture.docId)
    assert.equal(fixture.originalDocId, original.docId)
    assert.equal(fixture.originalLastUpdated, dates[index])
    assert.equal(fixture.lastUpdated, dates[index])
    assert.equal(fixture.summary, original.summary)
    assert.equal(fixture.effectiveAt, `${dates[index]}T00:00:00Z`)
    assert.ok(Number.isFinite(Date.parse(fixture.effectiveAt)))
    assert.equal(fixture.isSynthetic, true)
    assert.equal(fixture.dataClassification, 'SYNTHETIC_DEMO')
    assert.match(fixture.timestampProvenance, /Simulated UTC midnight/)
    assert.match(fixture.timestampProvenance, /no verified time or timezone/)
    for (const value of [fixture.docId, fixture.originalDocId, fixture.lastUpdated, fixture.effectiveAt, fixture.timestampProvenance]) {
      assert.ok(fixture.content.includes(value))
    }
    assert.match(fixture.content, /SYNTHETIC DEMO/)
    assert.match(fixture.content, /isSynthetic: true/)
  }
  assert.match(decisionDemoDocs[3].summary, /roadmap/)
})

test('product-document serialization retains timestamp metadata for later isolated indexing', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(decisionDemoDocs)), decisionDemoDocs)
})

test('fixture display separates authored opportunity facts and planning assumptions from IQ query claims', () => {
  const snapshot = buildComparisonSnapshot('reasoned-rollout')
  const original = JSON.stringify(snapshot)
  assert.equal(fixtureSourceLabel(snapshot.candidates[0].evidence[0]), 'Synthetic opportunity records')
  assert.equal(fixtureSourceLabel(snapshot.candidates[0].evidence[1]), 'Synthetic external context')
  assert.equal(fixtureSourceLabel(snapshot.productEvidence[0]), 'Synthetic product documentation')
  assert.equal(fixtureSourceLabel(snapshot.productEvidence.at(-1)), 'Scenario assumptions')
  assert.equal(JSON.stringify(snapshot), original)
  assert.equal(snapshot.candidates[0].evidence[0].source, 'Fabric IQ')
})

test('sales display preserves original fiscal rows and shows snapshot values without double-counting accounts', () => {
  const original = JSON.stringify(salesPerformance)
  assert.equal(salesPerformance.length, 5)
  assert.deepEqual(salesPerformance.map((row) => row.month), ['Jul', 'Jul', 'Aug', 'Aug', 'Sep'])
  assert.ok(salesPerformance.every((row) => row.fiscalYear === 'FY26' && row.fiscalQuarter === 'Q1' && !Object.hasOwn(row, 'effectiveAt')))
  const snapshot = buildComparisonSnapshot('base')
  const state = JSON.stringify(snapshot)
  const rows = salesPerformanceForSnapshot(snapshot)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map(({ territory, revenue, quota }) => ({ territory, revenue, quota })), [
    { territory: 'West', revenue: 168000, quota: 175000 },
    { territory: 'South', revenue: 61000, quota: 90000 },
    { territory: 'Central', revenue: 405000, quota: 380000 },
  ])
  assert.equal(rows[0].attainmentPct, 168000 / 175000 * 100)
  assert.equal(JSON.stringify(snapshot), state)
  assert.equal(JSON.stringify(salesPerformance), original)
  snapshot.candidates.push({ territory: 'West', territoryPerformance: { revenue: 123, quota: 175000 } })
  assert.equal(salesPerformanceForSnapshot(snapshot).length, 4)
  assert.equal(salesPerformanceForSnapshot({ candidates: [{ territory: 'Unknown' }] })[0].attainmentPct, null)
})

test('candidate evidence has stable unique IDs, all three sources, and aligned reporting dates', () => {
  const ids = new Set()
  for (const candidate of decisionScenario.candidates) {
    assert.ok(!ids.has(candidate.candidateId))
    ids.add(candidate.candidateId)
    assert.ok(candidate.projectValue > 0)
    assert.ok(candidate.opportunityAmount === null || candidate.opportunityAmount > 0)
    assert.ok(candidate.territoryPerformance.quota > 0)

    const evidence = [...candidate.evidence, ...decisionScenario.productEvidence]
    assert.deepEqual(new Set(evidence.map((entry) => entry.source)), new Set(['Fabric IQ', 'Web IQ', 'Foundry IQ']))
    for (const entry of evidence) {
      assert.ok(entry.evidenceId)
      assert.equal(entry.status, 'available')
      assert.ok(entry.text)
      assert.ok(Date.parse(entry.effectiveAt) <= Date.parse(entry.observedAt))
      assert.ok(Date.parse(entry.observedAt) <= Date.parse(decisionScenario.asOf))
    }
  }
  assert.equal(decisionScenario.evidenceMode, 'synthetic')
  assert.equal(decisionScenario.reportingPeriod.through, '2026-10-14')
})

test('evaluation labels cover every action and never enter model state', () => {
  assert.deepEqual(new Set(decisionEvaluationCases.map((entry) => entry.expectedAction)), new Set(Object.keys(decisionActions)))
  for (const evaluationCase of decisionEvaluationCases) {
    const state = buildDecisionState(evaluationCase.caseId)
    assert.equal(state.candidate.candidateId, evaluationCase.candidateId)
    assert.ok(!JSON.stringify(state).includes('expectedAction'))
    assert.ok(!JSON.stringify(state).includes('expectedBasis'))
    assert.ok(!Object.hasOwn(state, 'caseId'))
  }
})

test('high hazard remains identical when the buyer instead requests remote planning', () => {
  const paused = buildDecisionState('coastal-contact-pause')
  const remote = buildDecisionState('coastal-remote-planning-request')
  assert.deepEqual(paused.candidate.evidence[1], remote.candidate.evidence[1])
  assert.notEqual(paused.candidate.evidence[0].text, remote.candidate.evidence[0].text)
  assert.equal(remote.candidate.outreachPauseUntil, null)
  assert.ok(paused.candidate.outreachPauseUntil)
})

test('stale and failed retrieval variants retain explicit evidence status', () => {
  const stale = buildDecisionState('apex-stale-context')
  const failed = buildDecisionState('apex-context-failure')
  assert.equal(stale.candidate.evidence[1].effectiveAt, '2026-09-15T08:00:00Z')
  assert.equal(failed.candidate.evidence[1].status, 'error')
  assert.equal(failed.candidate.evidence[1].text, null)
})

test('building and modifying state cannot change the source fixtures', () => {
  const first = buildDecisionState('apex-timely-fit')
  first.candidate.evidence[0].text = 'Changed'
  first.productEvidence[0].text = 'Changed'
  first.reportingPeriod.through = 'Changed'
  const next = buildDecisionState('apex-timely-fit')
  assert.notEqual(next.candidate.evidence[0].text, 'Changed')
  assert.notEqual(next.productEvidence[0].text, 'Changed')
  assert.notEqual(next.reportingPeriod.through, 'Changed')
  assert.throws(() => buildDecisionState('missing'), /Unknown decision case/)
})

test('deadline tradeoff changes evidence timing without changing the formula inputs', () => {
  const control = buildComparisonSnapshot('summit-fit')
  const tradeoff = buildComparisonSnapshot('deadline-vs-value')
  assert.equal(tradeoff.asOf, decisionScenario.asOf)
  for (const [index, candidate] of tradeoff.candidates.entries()) {
    const { evidence, ...fields } = candidate
    const { evidence: controlEvidence, ...controlFields } = control.candidates[index]
    assert.deepEqual(fields, controlFields)
    assert.deepEqual(evidence[1], controlEvidence[1])
    assert.equal(evidence[0].effectiveAt, controlEvidence[0].effectiveAt)
    assert.equal(evidence[0].observedAt, controlEvidence[0].observedAt)
  }
  assert.match(tradeoff.candidates[0].evidence[0].text, /2026-10-16T16:00:00Z/)
  assert.match(tradeoff.candidates[2].evidence[0].text, /May 2027/)
})

test('readiness tradeoff separates a requested demo from a funded buying decision', () => {
  const snapshot = buildComparisonSnapshot('discovery-vs-readiness')
  const [apex, coastal, summit, unverified] = snapshot.candidates
  assert.ok(apex.opportunityAmount > summit.opportunityAmount)
  assert.deepEqual(apex.buyingSignals, summit.buyingSignals)
  assert.match(apex.evidence[0].text, /not a buyer-approved budget/)
  assert.match(summit.evidence[0].text, /approved a \$90,000/)
  assert.deepEqual(coastal, decisionScenario.candidates[1])
  assert.deepEqual(unverified, decisionScenario.candidates[3])
  assert.deepEqual(snapshot.productEvidence, decisionScenario.productEvidence)
  assert.equal(decisionScenario.candidates[0].opportunityAmount, 76000)
})

test('every comparison scenario remains synthetic and excludes evaluation answers', () => {
  assert.equal(new Set(comparisonVariants.map((variant) => variant.id)).size, comparisonVariants.length)
  for (const { id } of comparisonVariants) {
    const snapshot = buildComparisonSnapshot(id)
    assert.equal(snapshot.evidenceMode, 'synthetic')
    assert.equal(snapshot.asOf, decisionScenario.asOf)
    for (const forbidden of ['expectedAction', 'expectedBasis', 'caseId']) {
      assert.ok(!JSON.stringify(snapshot).includes(forbidden))
    }
  }
})

function presentationResult() {
  const branch = { status: 'ok', snapshotId: 'shared-test-snapshot', selectedIds: ['test-candidate'], suggestions: [{ candidateId: 'test-candidate', action: 'research', priority: 1 }] }
  return { mode: 'compare', snapshot: { candidates: [{ candidateId: 'test-candidate' }] }, policies: { 'test-candidate': { allowedActions: ['research'], reasonCodes: [] } }, branches: Object.fromEntries(['rules', 'llm', 'decision1'].map((method) => [method, structuredClone(branch)])) }
}

test('presentation distinguishes absent candidates from policy-blocked candidates', () => {
  const result = presentationResult()
  result.policies['test-candidate'] = { allowedActions: ['cannot_tell'], reasonCodes: ['MISSING_EFFECTIVE_DATE'] }
  result.branches.llm.model = 'No model call: all candidates policy-gated'
  assert.equal(modelWasSkipped(result.branches.llm), true)
  assert.equal(summarizeComparison(result).kind, 'blocked')
  assert.deepEqual(summarizeComparison(result).reasonCodes, ['MISSING_EFFECTIVE_DATE'])
  result.snapshot.candidates = []
  assert.equal(summarizeComparison(result).kind, 'empty')
  assert.equal(summarizeComparison(null), null)
})

test('presentation reports genuine action agreement while exposing different scores', () => {
  const result = presentationResult()
  result.branches.decision1.suggestions[0].priority = 1.25
  const summary = summarizeComparison(result)
  assert.equal(summary.kind, 'agreement')
  assert.match(summary.detail, /scores differ/)
  result.branches.decision1.suggestions[0].priority = 1
  assert.match(summarizeComparison(result).detail, /scores also agree/)
})

test('presentation distinguishes action differences from ranking differences', () => {
  const result = presentationResult()
  result.branches.llm.suggestions[0].action = 'cannot_tell'
  assert.equal(summarizeComparison(result).title, 'Actions differ')
  result.branches.llm.selectedIds = []
  assert.equal(summarizeComparison(result).title, 'Rankings and actions differ')
})

test('presentation does not claim agreement for errors or mismatched snapshots', () => {
  const result = presentationResult()
  result.branches.decision1.status = 'error'
  assert.equal(summarizeComparison(result).kind, 'incomplete')
  result.branches.decision1.status = 'ok'
  result.branches.decision1.snapshotId = 'different-snapshot'
  assert.equal(summarizeComparison(result).title, 'Snapshots do not match')
  result.mode = 'rules'
  result.branches = { rules: result.branches.rules }
  assert.equal(summarizeComparison(result).kind, 'single')
})

test('three teaching chapters reference real fixtures without leaking teaching targets into input', () => {
  assert.deepEqual(demoChapters.map((chapter) => chapter.number), [1, 2, 3])
  for (const chapter of demoChapters) {
    const snapshot = buildComparisonSnapshot(chapter.id)
    assert.ok(snapshot.candidates.some((candidate) => candidate.candidateId === chapter.targetCandidateId))
    for (const field of ['targetCandidateId', 'lesson', 'approach']) {
      assert.ok(!JSON.stringify(snapshot).includes(`"${field}"`))
    }
  }
  assert.equal(buildComparisonSnapshot('base').planningTask, undefined)
  assert.equal(buildComparisonSnapshot('discovery-vs-readiness').planningTask, undefined)
})

test('scenario input highlights reference actual changed evidence without entering model state', () => {
  for (const [index, chapter] of demoChapters.entries()) {
    const snapshot = buildComparisonSnapshot(chapter.id)
    const evidence = [...snapshot.productEvidence, ...snapshot.candidates.flatMap((candidate) => candidate.evidence)]
    const previous = index ? buildComparisonSnapshot(demoChapters[index - 1].id) : null
    const previousEvidence = previous ? [...previous.productEvidence, ...previous.candidates.flatMap((candidate) => candidate.evidence)] : []
    assert.ok(chapter.task)
    assert.equal(snapshot.inputs, undefined)
    assert.equal(JSON.stringify(snapshot).includes(chapter.task), false)
    for (const input of chapter.inputs) {
      const record = evidence.find((item) => item.evidenceId === input.evidenceId)
      assert.ok(record, input.evidenceId)
      assert.ok(input.now)
      if (previous) {
        assert.ok(input.before)
        assert.notEqual(record.text, previousEvidence.find((item) => item.evidenceId === input.evidenceId)?.text)
      }
    }
  }
})

test('reasoning chapter provides constraints, not a solved plan or altered policy evidence', () => {
  const snapshot = buildComparisonSnapshot('reasoned-rollout')
  const task = snapshot.planningTask
  assert.equal(task.phases.reduce((sum, phase) => sum + phase.businessDays, 0), 5)
  assert.equal(task.fixedCostUsd + task.phases.reduce((sum, phase) => sum + phase.businessDays * phase.dailyCostUsd, 0), 23200)
  assert.equal(task.earliestStart, '2026-10-16')
  assert.equal(task.deadline, '2026-10-22')
  assert.equal(task.implementationPlan, undefined)
  assert.deepEqual(snapshot.candidates[1], decisionScenario.candidates[1])
  assert.deepEqual(snapshot.candidates[3], decisionScenario.candidates[3])
  assert.deepEqual(snapshot.productEvidence.slice(0, 2), decisionScenario.productEvidence)
})

test('chapter takeaways use observed agreement and costs, never a preset winner', () => {
  const result = presentationResult()
  const chapter = { number: 1, targetCandidateId: 'test-candidate' }
  for (const [index, branch] of Object.values(result.branches).entries()) {
    branch.elapsedMs = index + 1
    branch.inferenceCostUsd = index / 1000
  }
  assert.equal(chapterTakeaway(chapter, result).supported, true)
  assert.match(chapterTakeaway(chapter, result).measurements[0], /Rules/)
  result.branches.llm.suggestions[0].action = 'cannot_tell'
  assert.equal(chapterTakeaway(chapter, result).supported, false)
  assert.equal(chapterTakeaway(chapter, result).measurements.length, 0)
  result.branches.llm.status = 'error'
  assert.equal(chapterTakeaway(chapter, result).title, 'Full comparison needed')
})

test('contextual chapter compares qualifying models without inventing a speed advantage', () => {
  const result = presentationResult()
  result.branches.rules.selectedIds = ['other-candidate']
  result.branches.llm.elapsedMs = 100
  result.branches.decision1.elapsedMs = 200
  result.branches.llm.inferenceCostUsd = 0.01
  result.branches.decision1.inferenceCostUsd = 0.001
  const chapter = { number: 2, targetCandidateId: 'test-candidate' }
  const takeaway = chapterTakeaway(chapter, result)
  assert.equal(takeaway.supported, true)
  assert.match(takeaway.measurements[0], /LLM/)
  assert.match(takeaway.measurements[1], /Decision-1/)
  result.branches.decision1.selectedIds = ['other-candidate']
  assert.equal(chapterTakeaway(chapter, result).supported, false)
})

test('reasoning chapter needs both the case target and an independently valid feasible plan', () => {
  const result = presentationResult()
  const chapter = { number: 3, targetCandidateId: 'test-candidate' }
  assert.equal(chapterTakeaway(chapter, result).supported, false)
  result.branches.llm.planValidation = { status: 'valid', feasible: true }
  assert.equal(chapterTakeaway(chapter, result).supported, true)
  result.branches.llm.planValidation.feasible = false
  assert.equal(chapterTakeaway(chapter, result).supported, false)
  result.mode = 'llm'
  assert.equal(chapterTakeaway(chapter, result).title, 'Full comparison needed')
})

test('each chapter focuses one preferred output and an execution diagram without modifying model inputs', () => {
  assert.deepEqual(demoChapters.map((chapter) => chapter.preferredMethod), ['rules', 'decision1', 'llm'])
  for (const chapter of demoChapters) {
    const snapshot = buildComparisonSnapshot(chapter.id)
    assert.equal(snapshot.preferredMethod, undefined)
    assert.equal(snapshot.logic, undefined)
    assert.equal(chapter.logic.length, 4)
    for (const step of chapter.logic) {
      assert.ok(step.title)
      assert.ok(step.detail)
      assert.equal(JSON.stringify(snapshot).includes(step.detail), false)
    }
  }
  assert.match(demoChapters[0].logic[1].detail, /30%.*20%.*30%.*20%/)
  assert.match(demoChapters[1].logic[3].detail, /No written model rationale/)
  assert.match(demoChapters[2].logic[1].title, /budget tool/)
  assert.match(demoChapters[2].logic[3].detail, /Invalid plans remain rejected/)
})