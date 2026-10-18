export const modelWasSkipped = (branch) => branch?.model === 'No model call: all candidates policy-gated'

export function comparisonWinners(chapter, result) {
  if (!chapterTakeaway(chapter, result)?.supported) return []
  if (chapter.number === 3) return ['llm']
  const methods = chapter.number === 1 ? ['rules', 'llm', 'decision1'] : ['llm', 'decision1']
  if (methods.some((method) => ['elapsedMs', 'inferenceCostUsd'].some((field) => !Number.isFinite(result.branches[method][field]) || result.branches[method][field] < 0))) return []
  return methods.filter((method) => !methods.some((other) => {
    const current = result.branches[method], alternative = result.branches[other]
    return alternative.elapsedMs <= current.elapsedMs && alternative.inferenceCostUsd <= current.inferenceCostUsd && (alternative.elapsedMs < current.elapsedMs || alternative.inferenceCostUsd < current.inferenceCostUsd)
  }))
}

export function fixtureSourceLabel(item) {
  if (item.evidenceId === 'DEMO-ROLLOUT-CONSTRAINTS') return 'Scenario assumptions'
  return { 'Fabric IQ': 'Synthetic opportunity records', 'Web IQ': 'Synthetic external context', 'Foundry IQ': 'Synthetic product documentation' }[item.source] ?? item.source
}

export function salesPerformanceForSnapshot(snapshot) {
  const rows = new Map()
  for (const candidate of snapshot.candidates) {
    const { revenue = null, quota = null } = candidate.territoryPerformance ?? {}
    const territory = candidate.territory ?? 'Unknown'
    const key = JSON.stringify([territory, revenue, quota])
    rows.set(key, { territory, revenue, quota,
      attainmentPct: Number.isFinite(revenue) && Number.isFinite(quota) && quota > 0 ? revenue / quota * 100 : null })
  }
  return [...rows.values()]
}

export function chapterTakeaway(chapter, result) {
  if (!chapter || !result) return null
  const summary = summarizeComparison(result)
  if (result.mode !== 'compare' || ['incomplete', 'blocked', 'empty'].includes(summary.kind)) {
    return { supported: false, title: 'Full comparison needed', detail: 'Run all three methods on eligible shared evidence before drawing this chapter\'s conclusion.', measurements: [] }
  }
  const { rules, llm, decision1 } = result.branches
  const leads = (branch) => branch.selectedIds?.[0] === chapter.targetCandidateId
  let supported, title, detail, qualified
  if (chapter.number === 1) {
    supported = summary.kind === 'agreement' && leads(rules)
    title = supported ? 'Same decision, simpler execution' : 'Agreement not demonstrated in this run'
    detail = supported ? 'All three agree on ranks and actions. Rules need no model tokens. Raw scores remain visible and may differ; choose rules when this decision coverage is sufficient.' : 'The intended lesson is agreement, but this run differs. Inspect the evidence and outputs instead of assuming a winner.'
    qualified = supported ? ['rules', 'llm', 'decision1'] : []
  } else if (chapter.number === 2) {
    supported = leads(llm) && leads(decision1) && !leads(rules)
    title = supported ? 'Context beats the fixed formula' : 'Intended contrast not demonstrated in this run'
    detail = supported ? 'Both hosted models put the funded pilot first; rules favor the larger discovery estimate. This matches the authored case criterion, not a quality benchmark. Other actions and scores may still differ.' : 'The case criterion is to prioritize the funded pilot over exploratory interest. Compare the actual recommendations; a model advantage is not assumed.'
    qualified = supported ? ['llm', 'decision1'] : []
  } else {
    supported = leads(llm) && llm.planValidation?.status === 'valid' && llm.planValidation.feasible === true
    title = supported ? 'A checked plan, not just a decision' : 'A valid, feasible plan is still required'
    detail = supported ? 'The LLM selected the funded pilot and combined a generated schedule with a budget-calculation tool; the plan passes independent checks. Decision-only baselines do not supply this artifact. This extra work is not a like-for-like latency comparison; a purpose-built scheduler could also solve these fixed constraints.' : 'Choosing an account does not complete this task. The generated schedule, arithmetic and references must pass checks; do not treat an invalid or absent plan as success.'
    qualified = []
  }
  const names = { rules: 'Rules', llm: 'LLM', decision1: 'Decision-1' }
  const measurements = []
  for (const [field, label, format] of [
    ['elapsedMs', 'Faster qualifying branch', (value) => `${value.toFixed(1)} ms`],
    ['inferenceCostUsd', 'Lower qualifying token estimate', (value) => `$${value.toFixed(6)}`],
  ]) {
    if (qualified.length > 1 && qualified.every((method) => Number.isFinite(result.branches[method][field]))) {
      const ordered = [...qualified].sort((first, second) => result.branches[first][field] - result.branches[second][field])
      const best = result.branches[ordered[0]][field]
      const tied = ordered.filter((method) => result.branches[method][field] === best)
      measurements.push(`${label}: ${tied.map((method) => names[method]).join(' / ')} (${format(best)})`)
    }
  }
  return { supported, title, detail, measurements }
}

export function summarizeComparison(result) {
  if (!result) return null
  const candidates = result.snapshot.candidates
  const policies = candidates.map((candidate) => result.policies?.[candidate.candidateId] ?? candidate.policy)
  const eligible = policies.filter((policy) => policy?.allowedActions.some((action) => action === 'research' || action === 'outreach')).length
  const reasonCodes = [...new Set(policies.flatMap((policy) => policy?.reasonCodes ?? []))]
  const counts = { total: candidates.length, eligible, reasonCodes }
  if (!candidates.length) return { ...counts, kind: 'empty', title: 'No candidates returned', detail: 'The source snapshot contains no candidates to assess. No ranking was produced.' }
  if (!eligible) return { ...counts, kind: 'blocked', title: 'No candidates cleared shared policy', detail: 'Evidence issues require review; contact pauses remain deferred. Hosted decision models were not called.' }
  const completed = Object.values(result.branches).filter((branch) => branch.status === 'ok' && !modelWasSkipped(branch))
  if (completed.length < (result.mode === 'compare' ? 3 : 1)) return { ...counts, kind: 'incomplete', title: 'Comparison incomplete', detail: 'One or more branches failed, returned invalid output, or were unavailable.' }
  if (completed.length === 1) return { ...counts, kind: 'single', title: 'Single-method result', detail: 'One branch completed; there is no cross-method comparison.' }
  if (!completed.every((branch) => branch.snapshotId) || new Set(completed.map((branch) => branch.snapshotId)).size !== 1) {
    return { ...counts, kind: 'incomplete', title: 'Snapshots do not match', detail: 'These results cannot be treated as a shared-input comparison.' }
  }
  const rankings = completed.map((branch) => JSON.stringify(branch.selectedIds))
  const signature = (branch, field) => JSON.stringify([...branch.suggestions].sort((first, second) => first.candidateId.localeCompare(second.candidateId)).map((item) => [item.candidateId, field === 'priority' ? item.priority.toFixed(2) : item[field]]))
  const sameRanking = new Set(rankings).size === 1
  const sameActions = new Set(completed.map((branch) => signature(branch, 'action'))).size === 1
  const sameScores = new Set(completed.map((branch) => signature(branch, 'priority'))).size === 1
  if (sameRanking && sameActions) return { ...counts, kind: 'agreement', title: 'Same ranking and actions', detail: sameScores ? 'Displayed scores also agree. This run does not establish equal quality.' : 'Priority scores differ. Agreement on this input does not establish equal quality.' }
  return { ...counts, kind: 'difference', title: sameRanking ? 'Actions differ' : sameActions ? 'Rankings differ' : 'Rankings and actions differ', detail: 'Differences are shown against the same evidence snapshot. No quality winner has been established.' }
}