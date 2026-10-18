import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, GitBranch, Play, Square, RefreshCw, ShieldCheck, Database, Globe, FileText, LoaderCircle, Users, ClipboardList, Phone, MessageSquare, X, Save } from 'lucide-react'
import { buildComparisonSnapshot, demoChapters } from './data/decisionScenarios.js'
import { rows as salesPerformance } from './data/raw/salesPerformance.js'
import { chapterTakeaway, comparisonWinners, fixtureSourceLabel, modelWasSkipped, salesPerformanceForSnapshot, summarizeComparison } from './lib/decisionPresentation.js'

const METHODS = [
  { id: 'rules', label: 'Rules', kind: 'Weighted formula' },
  { id: 'llm', label: 'LLM', kind: 'Structured-output generation' },
  { id: 'decision1', label: 'Decision-1', kind: 'Choice and ordinal score' },
]
const SOURCES = [
  { name: 'Fabric IQ', label: 'Synthetic opportunity records', icon: Users },
  { name: 'Web IQ', label: 'Synthetic external context', icon: Globe },
  { name: 'Foundry IQ', label: 'Synthetic product documentation', icon: FileText },
  { name: 'Scenario assumptions', label: 'Scenario assumptions', icon: ClipboardList },
]
const ACTIONS = { outreach: 'Contact now', research: 'Qualify opportunity', defer: 'Defer', cannot_tell: 'Human review' }
const REASONS = {
  CONTACT_PAUSE: 'Customer contact pause', UNVERIFIED_ENTITY: 'Unverified company',
  SOURCE_UNAVAILABLE: 'Source unavailable', STALE_EVIDENCE: 'Stale evidence',
  MISSING_CANDIDATE_EVIDENCE: 'Missing account context', MISSING_PRODUCT_EVIDENCE: 'Missing product evidence',
  MISSING_SOURCE_PROVENANCE: 'Missing source provenance', MISSING_EFFECTIVE_DATE: 'Source date unknown',
  INVALID_EFFECTIVE_DATE: 'Source date is ambiguous', FUTURE_DATED_EVIDENCE: 'Future-dated source',
}
const money = (value) => value == null ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const rankable = (candidate) => candidate.policy?.allowedActions.some((action) => action === 'outreach' || action === 'research')

function SalesPerformance({ snapshot }) {
  const rows = salesPerformanceForSnapshot(snapshot)
  const attainment = (revenue, quota) => Number.isFinite(revenue) && Number.isFinite(quota) && quota > 0 ? `${(revenue / quota * 100).toFixed(1)}%` : 'Unknown'
  return <section className="decision-sales-context" aria-label="Sales performance">
    <header><Database size={18} aria-hidden="true" /><h3>Sales performance</h3><span>Local reference / no Fabric query</span></header>
    <div className="decision-sales-tables">
      <div><h4>Original sales_performance records</h4><p>Local reference only, not additional model input. Fiscal labels are preserved; no verified source timestamp is supplied.</p>
        <div className="decision-table-scroll"><table aria-label="Original sales performance"><thead><tr><th>Source period</th><th>Territory</th><th>Revenue</th><th>Quota</th><th>Attainment</th></tr></thead><tbody>{salesPerformance.map((row) => <tr key={JSON.stringify([row.fiscalYear, row.fiscalQuarter, row.month, row.territory, row.seller])}><th scope="row">{row.fiscalYear} / {row.fiscalQuarter} / {row.month}</th><td>{row.territory}</td><td>{money(row.revenue)}</td><td>{money(row.quota)}</td><td>{attainment(row.revenue, row.quota)}</td></tr>)}</tbody></table></div>
      </div>
      <div><h4>Territory values used in this comparison</h4><p>Authored values embedded in the shared scenario snapshot. Repeated territory/value pairs are shown once, not summed.</p>
        <div className="decision-table-scroll"><table aria-label="Scenario sales performance"><thead><tr><th>Territory</th><th>Revenue</th><th>Quota</th><th>Attainment</th></tr></thead><tbody>{rows.map((row) => <tr key={JSON.stringify([row.territory, row.revenue, row.quota])}><th scope="row">{row.territory}</th><td>{money(row.revenue)}</td><td>{money(row.quota)}</td><td>{row.attainmentPct == null ? 'Unknown' : `${row.attainmentPct.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
      </div>
    </div>
    <p className="decision-source-meta">The reference covers mixed months, not a single comparable reporting window. Scenario dates are separately simulated, not source dates for these original rows. Revenue and quota do not establish buyer intent or budget approval.</p>
  </section>
}

function MethodResult({ method, result, snapshot, busy, available }) {
  const selected = result?.selectedIds ?? []
  const skipped = modelWasSkipped(result)
  const eligibleCount = snapshot.candidates.filter(rankable).length
  const status = busy ? 'Awaiting workflow result' : skipped ? 'Not called' : result?.status === 'ok' ? !snapshot.candidates.length ? 'No input' : eligibleCount ? 'Completed' : 'Policy only' : result?.status ?? (available == null ? 'Checking connection' : available ? 'Not run' : 'Not configured')
  return (
    <section className="decision-method" aria-label={`${method.label} results`}>
      <header className="decision-method-heading">
        <h3>{method.label}</h3><span className={`decision-status decision-status-${result?.status ?? 'idle'}`}>{status}</span>
      </header>
      <p className="decision-method-kind">{method.id === 'llm' && snapshot.planningTask ? 'Tool-assisted decision + implementation plan' : method.kind}</p>
      {busy && <LoaderCircle size={19} className="decision-spinner" aria-label="Workflow response pending" />}
      {!busy && result?.message && <p className="decision-notice">{result.message}</p>}
      {result?.violations?.map((violation) => <p key={violation} className="decision-error">{violation}</p>)}
      {skipped && <p className="decision-notice">{snapshot.candidates.length ? 'No inference request sent: no candidates passed shared policy.' : 'No inference request sent: no source candidates.'}</p>}
      {result?.status === 'ok' && !skipped && !eligibleCount && <p className="decision-notice">{snapshot.candidates.length ? 'Shared policy outcomes only; nothing was ranked.' : 'No source candidates to assess.'}</p>}
      {result?.status === 'ok' && eligibleCount > 0 && selected.length === 0 && <p className="decision-notice">This method recommended review for every assessed candidate; none was ranked.</p>}
    </section>
  )
}

function ImplementationPlan({ result }) {
  if (result?.status !== 'ok' || modelWasSkipped(result)) return null
  return <section className="decision-plan" aria-label="LLM plan coverage">
    <h4>Implementation plan</h4>
    <p className={result.planValidation?.status === 'invalid' ? 'decision-error' : 'decision-notice'}>{result.planValidation?.message ?? 'No implementation plan supplied.'}</p>
    {result.toolsUsed?.includes('implementation_budget') && <p>Budget calculated from supplied rates and durations.</p>}
    {result.planValidation?.status === 'valid' && <>
      <p>{result.planValidation.feasible ? 'Within deadline and budget' : 'Not feasible within the supplied constraints'}</p>
      <div className="decision-table-scroll"><table aria-label="Implementation schedule"><thead><tr><th>Phase</th><th>Start</th><th>Finish</th></tr></thead><tbody>{result.implementationPlan.phases.map((phase) => <tr key={phase.id}><th scope="row">{phase.id}</th><td>{phase.startDate}</td><td>{phase.finishDate}</td></tr>)}</tbody></table></div>
      <p>Total {money(result.implementationPlan.totalCostUsd)} / budget remaining {money(result.implementationPlan.remainingBudgetUsd)}</p>
      <p>Generated proposal, not an implementation commitment. LLM cost and time include both model calls and this additional output.</p>
    </>}
    {result.implementationPlan && <details><summary>Generated plan and checks</summary><pre>{JSON.stringify({ plan: result.implementationPlan, checks: result.planValidation }, null, 2)}</pre></details>}
  </section>
}

function ActionDialog({ action, draft, onSave, onClose }) {
  const dialogRef = useRef(null)
  const [saved, setSaved] = useState(Object.keys(draft).length > 0)
  const { candidate, method } = action
  const contact = action.action === 'outreach'
  const qualification = action.action === 'research'
  const context = candidate.evidence.find((item) => fixtureSourceLabel(item) === 'Synthetic opportunity records')?.text ?? 'Account context requires verification.'
  const title = contact ? 'Contact now' : qualification ? 'Qualify opportunity' : 'Human review'
  const Icon = contact ? Phone : qualification ? ClipboardList : MessageSquare
  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [])
  return <dialog ref={dialogRef} className="decision-dialog" aria-labelledby="decision-dialog-title" aria-describedby="decision-dialog-disclosure" onCancel={(event) => { event.preventDefault(); onClose() }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <header><div><Icon size={20} aria-hidden="true" /><div><p>{contact ? 'Contact workspace' : qualification ? 'CRM / Opportunity' : 'IM / Account specialist'}</p><h2 id="decision-dialog-title">{title}</h2></div></div><button type="button" className="decision-icon-button" aria-label="Close action" title="Close" onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); onSave(Object.fromEntries(new FormData(event.currentTarget))); setSaved(true) }} onChange={() => setSaved(false)}>
      <div className="decision-dialog-context"><strong>{candidate.name}</strong><span>{candidate.candidateId} / {method}</span></div>
      <p id="decision-dialog-disclosure" className="decision-demo-notice">Synthetic demo workspace. Contact details are fictional. No calls, messages or CRM changes are made.</p>
      {contact ? <>
        <div className="decision-form-grid"><label>Phone<input type="tel" value="+1 (202) 555-0142" readOnly /></label><label>Email<input type="email" name="email" defaultValue={draft.email ?? 'operations@example.com'} required /></label></div>
        <label>Subject<input name="subject" defaultValue={draft.subject ?? `FieldForge next steps - ${candidate.name}`} required /></label>
        <label>Message<textarea aria-label="Message" name="message" rows={7} defaultValue={draft.message ?? `Hello,\n\nCould we arrange a discussion about the FieldForge opportunity at ${candidate.name}? I'd like to confirm the supported requirements, decision process and next steps before making any commitments.\n\nBest,\nYour FieldForge account team`} required /></label>
      </> : qualification ? <>
        <div className="decision-form-grid"><label>Opportunity<input value={`${candidate.name} / FieldForge`} readOnly /></label><label>Software value<input value={money(candidate.opportunityAmount)} readOnly /></label><label>Stage<select aria-label="Stage" name="stage" defaultValue={draft.stage ?? 'qualification'}><option value="qualification">Needs qualification</option><option value="discovery">Discovery</option><option value="scoping">Ready for scoping</option></select></label><label>Owner<input value="Sales qualification team (demo)" readOnly /></label></div>
        <fieldset><legend>Qualification checklist</legend>{['Confirm sponsor and economic buyer', 'Verify approved budget and buying process', 'Confirm supported requirements and timing'].map((label) => <label className="decision-check-field" key={label}><input type="checkbox" name={label} defaultChecked={draft[label] === 'on'} />{label}</label>)}</fieldset>
        <label>Qualification request<textarea aria-label="Qualification request" name="message" rows={7} defaultValue={draft.message ?? `Please qualify the opportunity for ${candidate.name}. Confirm sponsor, budget approval, requirements and purchase timeline before progressing the sale.\n\nCurrent account context:\n${context}`} required /></label>
      </> : <>
        <div className="decision-im-recipient"><MessageSquare size={19} aria-hidden="true" /><div><strong>Account specialist</strong><span>account-specialist@example.com / demo</span></div></div>
        <label>Review message<textarea aria-label="Review message" name="message" rows={9} defaultValue={draft.message ?? `Please review ${candidate.name} (${candidate.candidateId}) before any outreach. Verify the account identity and buying context, then recommend the safe next step.\n\nCurrent account context:\n${context}`} required /></label>
      </>}
      <footer><p role="status">{saved ? contact ? 'Contact draft saved in this demo session. Nothing sent.' : qualification ? 'Demo qualification request recorded. No CRM record changed.' : 'Review draft saved in this demo session. No IM sent.' : 'Draft only / demo session'}</p><button className="decision-run" type="submit"><Save size={16} aria-hidden="true" />{contact ? 'Save contact draft' : qualification ? 'Request qualification (demo)' : 'Save review draft'}</button></footer>
    </form>
  </dialog>
}

function SourceInput({ source, snapshot, evidenceMode, busy, preview, changedIds, previousChapter }) {
  const Icon = source.icon
  const live = evidenceMode === 'live'
  const reading = snapshot.sourceResults?.[source.name]
  const empty = reading?.data?.territories?.length === 0
  const fixtureEvidence = [...snapshot.productEvidence, ...snapshot.candidates.flatMap((candidate) => candidate.evidence)].filter((item) => fixtureSourceLabel(item) === source.label)
  fixtureEvidence.sort((first, second) => Number(changedIds.includes(second.evidenceId)) - Number(changedIds.includes(first.evidenceId)))
  const changedCount = fixtureEvidence.filter((item) => changedIds.includes(item.evidenceId)).length
  const status = !live ? preview ? 'Fixture preview' : fixtureEvidence.length ? 'Retrieved fixture' : busy ? 'Requested' : 'Not retrieved' : reading ? reading.status === 'available' ? empty ? 'No rows' : 'Returned' : 'Failed' : busy ? 'Requested' : 'Not retrieved'
  return <article className="decision-input-agent" aria-label={`${live ? source.name : source.label} input`}>
    <header><Icon size={17} aria-hidden="true" /><h4>{live ? source.name : source.label}</h4><span>{live && busy && <LoaderCircle size={13} className="decision-spinner" aria-label="Source response pending" />}{status}</span></header>
    {previousChapter && <p className="decision-source-meta">{changedCount ? `${changedCount} changed ${changedCount === 1 ? 'record' : 'records'}` : 'Unchanged'} from scenario {previousChapter}</p>}
    <div className="decision-source-copy">
      {!live ? fixtureEvidence.map((item) => <p key={item.evidenceId} className={changedIds.includes(item.evidenceId) ? 'decision-changed-evidence' : ''}><strong>{item.evidenceId}{changedIds.includes(item.evidenceId) && <span> / Changed</span>}</strong>{item.text ?? 'No evidence returned.'}</p>) : reading?.data?.territories ? <><p className="decision-period">{reading.data.reportingPeriodLabel}</p>{empty && <p>No territory rows returned for a comparable reporting period.</p>}{reading.data.territories.map((row) => <div key={row.territory} className="decision-source-territory"><strong>{row.territory}</strong><span>{money(row.revenue)} revenue / {money(row.quota)} quota</span><p>{row.text}</p><small>Effective {row.effectiveAt ?? 'unknown'}</small></div>)}</> : <p>{reading?.data?.text ?? reading?.message ?? (busy ? 'Response pending' : 'No live response yet')}</p>}
    </div>
    {reading?.data && !reading.data.territories && <p className="decision-source-meta">Source date: {reading.data.effectiveAt ?? 'unknown'} / {reading.data.references.length} agent-reported references</p>}
    {reading && <details><summary>Returned source payload</summary><pre className="decision-source-text">{reading.text ?? reading.message}</pre><p className="decision-source-meta">Response {reading.responseId ?? 'not returned'}<br />Observed {reading.observedAt ?? 'unavailable'}</p></details>}
  </article>
}

function comparisonMetrics(method, result) {
  const skipped = modelWasSkipped(result)
  const inputTokens = result?.usage?.input_tokens ?? result?.usage?.prompt_tokens
  const outputTokens = result?.usage?.output_tokens ?? result?.usage?.completion_tokens
  return [
    result?.status !== 'unavailable' && !skipped && Number.isFinite(result?.elapsedMs) ? `${result.elapsedMs.toFixed(1)} ms` : '--',
    skipped ? '--' : result?.inferenceCostUsd != null ? `$${result.inferenceCostUsd.toFixed(6)}` : result ? 'Unknown' : '--',
    skipped ? 'Not invoked' : Number.isInteger(inputTokens) && Number.isInteger(outputTokens) ? `${inputTokens} in / ${outputTokens} out` : method.id === 'rules' ? 'No model' : result ? 'Unknown' : '--',
  ]
}

function AccountsInScope({ snapshot, chapter, retrieved }) {
  return <section className="decision-accounts" aria-label="Accounts in scope">
    <header><h2>Accounts in scope</h2><span>Scenario {chapter.number} / {retrieved ? 'Retrieved synthetic snapshot' : 'Local fixture preview'}</span></header>
    <p className="decision-source-meta">Simulation as of {snapshot.asOf.slice(0, 10)}</p>
    <div className="decision-table-scroll"><table aria-label="Account situations"><thead><tr><th scope="col">Account</th><th scope="col">Current situation</th><th scope="col">Software opportunity</th></tr></thead><tbody>{snapshot.candidates.map((candidate) => {
      const context = candidate.evidence.find((item) => fixtureSourceLabel(item) === 'Synthetic opportunity records')
      return <tr key={candidate.candidateId}><th scope="row"><strong>{candidate.name}</strong><small>{candidate.territory} / {candidate.motion}</small></th><td>{context?.status === 'available' ? context.text : 'Current situation unavailable.'}</td><td>{money(candidate.opportunityAmount)}</td></tr>
    })}</tbody></table></div>
  </section>
}

function BoundedChoices({ snapshot, result, busy }) {
  const completed = !busy && result?.status === 'ok' && !modelWasSkipped(result)
  return <section className="decision-choice-map" aria-label="Decision-1 bounded choices">
    <p>Allowed actions per account. Priority is a separate 0-3 score, not a probability.</p>
    {snapshot.candidates.map((candidate) => {
      const allowed = candidate.policy?.allowedActions ?? []
      const gated = candidate.policy && !rankable(candidate)
      const suggestion = completed && !gated ? result.suggestions?.find((item) => item.candidateId === candidate.candidateId) : null
      const picked = allowed.includes(suggestion?.action) && Number.isFinite(suggestion?.priority) && suggestion.priority >= 0 && suggestion.priority <= 3
      const rank = picked ? result.selectedIds?.indexOf(candidate.candidateId) ?? -1 : -1
      return <div className="decision-choice-account" key={candidate.candidateId}>
        <header><h5>{candidate.name}</h5>{rank >= 0 && <span>Rank #{rank + 1}</span>}</header>
        {gated ? <p className="decision-choice-policy">Shared policy: {allowed.map((action) => ACTIONS[action]).join(', ')}. Not sent to Decision-1.</p> : !candidate.policy ? <p>Action bounds pending shared policy checks.</p> : <>
          <div className="decision-choice-options" role="group" aria-label={`${candidate.name} allowed actions`}>{allowed.map((action) => <span key={action} className={picked && suggestion.action === action ? 'decision-choice-picked' : ''}>{picked && suggestion.action === action && <Check size={13} aria-hidden="true" />}<span>{ACTIONS[action]}</span>{picked && suggestion.action === action && <strong>Picked</strong>}</span>)}</div>
          <div className="decision-choice-score"><span>Priority <strong>{picked ? `${suggestion.priority.toFixed(2)} / 3` : '--'}</strong></span>{picked && <meter min="0" max="3" value={suggestion.priority} aria-label={`${candidate.name} priority`} />}</div>
          {!picked && <p>{busy ? 'Awaiting returned choice and score.' : result?.status === 'ok' ? 'No validated choice and score returned.' : 'No completed Decision-1 output.'}</p>}
        </>}
      </div>
    })}
    <dl className="decision-score-key" aria-label="Priority score criteria">{['Not actionable or review required', 'Exploratory', 'Timely but uncertain', 'Ready and timely'].map((label, score) => <div key={label}><dt>{score}</dt><dd>{label}</dd></div>)}</dl>
  </section>
}

function ComparisonTable({ snapshot, branches = {}, methods, busy, service, winners, onAction }) {
  const columnClass = (method) => winners.includes(method.id) ? 'decision-winner' : ''
  const actionButton = (candidate, action, method) => {
    const Icon = action === 'outreach' ? Phone : action === 'research' ? ClipboardList : MessageSquare
    return <button type="button" className="decision-next-action" onClick={() => onAction({ candidate, action, method })} aria-label={`${ACTIONS[action]} for ${candidate.name} via ${method}`}><Icon size={14} aria-hidden="true" />{ACTIONS[action]}</button>
  }
  return <div className="decision-table-scroll decision-comparison-table" aria-live="polite" aria-busy={busy}><table aria-label="Method comparison"><thead><tr><th scope="col">Account / next best action</th>{methods.map((method) => <th scope="col" key={method.id} className={columnClass(method)}><MethodResult method={method} result={branches[method.id]} snapshot={snapshot} busy={busy} available={service ? Boolean(service[method.id]) : null} />{winners.includes(method.id) && <span className="decision-winner-label">Best observed fit</span>}</th>)}</tr></thead><tbody>{snapshot.candidates.map((candidate) => <tr key={candidate.candidateId}><th scope="row">{candidate.name}{candidate.policy && !rankable(candidate) && <small>Shared policy</small>}</th>{methods.map((method) => {
    if (!candidate.policy) return <td key={method.id} className={columnClass(method)}>{busy ? 'Assessing shared evidence' : 'Not assessed'}</td>
    if (!rankable(candidate)) {
      const action = candidate.policy.allowedActions.includes('defer') ? 'defer' : 'cannot_tell'
      return <td key={method.id} className={`${columnClass(method)} decision-policy-cell`}>{action === 'defer' ? 'Defer / contact pause' : actionButton(candidate, action, 'Shared policy')}</td>
    }
    const branch = branches[method.id]
    const suggestion = branch?.suggestions?.find((item) => item.candidateId === candidate.candidateId)
    const rank = branch?.selectedIds?.indexOf(candidate.candidateId) ?? -1
    return <td key={method.id} className={columnClass(method)}>{branch?.status === 'ok' && suggestion && candidate.policy.allowedActions.includes(suggestion.action) && !modelWasSkipped(branch) ? <>{rank >= 0 && <strong className="decision-table-rank">#{rank + 1}</strong>}{suggestion.action === 'defer' ? ACTIONS.defer : actionButton(candidate, suggestion.action, method.label)}<small>{suggestion.priority.toFixed(2)} / 3</small></> : <span>{branch?.status ?? 'Not run'}</span>}</td>
  })}</tr>)}</tbody><tfoot><tr className="decision-metrics-heading"><th>Execution metrics</th>{methods.map((method) => <td key={method.id} className={columnClass(method)} />)}</tr>{['Branch time', 'Token cost estimate', 'Model tokens'].map((label, index) => <tr key={label}><th scope="row">{label}</th>{methods.map((method) => <td key={method.id} className={columnClass(method)}>{comparisonMetrics(method, branches[method.id])[index]}</td>)}</tr>)}</tfoot></table></div>
}

export default function DecisionWorkbench() {
  const evidenceMode = 'retrieved'
  const [variant, setVariant] = useState('base')
  const [service, setService] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [results, setResults] = useState({})
  const [action, setAction] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const tabRefs = useRef([])
  const result = results[variant] ?? null
  const actionKey = action ? `${variant}-${action.candidate.candidateId}-${action.action}-${action.method}` : null
  const snapshot = result?.snapshot ?? buildComparisonSnapshot(variant)
  const displayedMethods = METHODS
  const summary = summarizeComparison(result)
  const chapter = evidenceMode !== 'live' ? demoChapters.find((entry) => entry.id === variant) : null
  const takeaway = chapterTakeaway(chapter, result)
  const winners = comparisonWinners(chapter, result)
  const preferredMethod = METHODS.find((entry) => entry.id === chapter.preferredMethod)
  const changedIds = chapter.number > 1 ? chapter.inputs.map((input) => input.evidenceId) : []
  const runDisabled = busy || !service || service.offline || !service.storedRetrieval

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/decision-workflow/capabilities', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Service unavailable')
        return response.json()
      })
      .then(setService)
      .catch((failure) => { if (failure.name !== 'AbortError') setService({ offline: true }) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => () => request.current?.abort(), [])

  function selectTab(nextVariant) {
    if (busy) return
    setVariant(nextVariant)
    setError('')
    setAction(null)
  }

  function navigateTabs(event, index) {
    const next = event.key === 'ArrowRight' ? (index + 1) % demoChapters.length : event.key === 'ArrowLeft' ? (index + demoChapters.length - 1) % demoChapters.length : event.key === 'Home' ? 0 : event.key === 'End' ? demoChapters.length - 1 : null
    if (next == null || busy) return
    event.preventDefault()
    selectTab(demoChapters[next].id)
    tabRefs.current[next].focus()
  }

  async function run(nextVariant) {
    if (request.current || runDisabled) return
    const controller = new AbortController()
    request.current = controller
    setVariant(nextVariant)
    setBusy(true)
    setError('')
    setResults((previous) => ({ ...previous, [nextVariant]: null }))
    try {
      const response = await fetch('/api/decision-workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: nextVariant, method: 'compare', evidenceMode, question: 'Where should we focus new lead generation?' }),
        signal: controller.signal,
      })
      const completed = await response.json()
      if (!response.ok) throw new Error(completed.detail || `Workflow request failed (${response.status}).`)
      setResults((previous) => ({ ...previous, [nextVariant]: completed }))
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Stopped waiting. Hosted requests already sent may still incur charges.' : failure.message)
    } finally {
      request.current = null
      setBusy(false)
    }
  }

  return (
    <div className="decision-workbench">
      <div className="decision-title"><div><h1>Next Best Action for Sales Reps</h1><p>Which account needs attention, and what should happen next?</p><div className="decision-context"><span>Synthetic demo data</span></div></div><GitBranch size={30} aria-hidden="true" /></div>
      <div className="decision-tabs" role="tablist" aria-label="Next-best-action scenarios">{demoChapters.map((entry, index) => <button key={entry.id} ref={(element) => { tabRefs.current[index] = element }} id={`scenario-tab-${entry.id}`} role="tab" aria-selected={variant === entry.id} aria-controls={`scenario-panel-${entry.id}`} tabIndex={variant === entry.id ? 0 : -1} disabled={busy} onClick={() => selectTab(entry.id)} onKeyDown={(event) => navigateTabs(event, index)}><span>{entry.number}. {entry.title}</span><small>{entry.approach}</small></button>)}</div>
      <div id={`scenario-panel-${variant}`} role="tabpanel" aria-labelledby={`scenario-tab-${variant}`} tabIndex={0}>
      <AccountsInScope snapshot={snapshot} chapter={chapter} retrieved={Boolean(result)} />
      {busy && <div className="decision-run-status" role="status"><span>Comparing all three approaches / shared synthetic evidence</span><button type="button" className="decision-icon-button" onClick={() => request.current?.abort()} title="Stop waiting; hosted requests may continue" aria-label="Stop waiting"><Square size={16} /></button></div>}
      {service && !service.offline && evidenceMode === 'live' && !service.liveRetrieval && <p className="decision-error" role="status">Live source endpoints are not configured.</p>}
      {service && !service.offline && evidenceMode === 'retrieved' && !service.storedRetrieval && <p className="decision-error" role="status">Stored synthetic record retrieval is not configured.</p>}
      {service?.offline && <div className="decision-error" role="status">Workflow service offline.<button className="decision-icon-button" onClick={() => setRefresh((value) => value + 1)} title="Retry connection" aria-label="Retry connection"><RefreshCw size={15} /></button></div>}
      {error && <p className="decision-error" role="alert">{error}</p>}
      {chapter && <section className="decision-lesson" aria-label="Chapter insight">
        <p className="decision-lesson-label">Chapter {chapter.number} / 3 / {chapter.approach}</p>
        <h3>{chapter.question}</h3><p>{chapter.lesson}</p>
        {takeaway && <div className={takeaway.supported ? 'decision-lesson-supported' : ''}><h4>{takeaway.title}</h4><p>{takeaway.detail}</p>{takeaway.measurements.length > 0 && <ul>{takeaway.measurements.map((measurement) => <li key={measurement}>{measurement}</li>)}</ul>}</div>}
        <button type="button" className="decision-run decision-compare" disabled={runDisabled} onClick={() => run(variant)}>{busy ? <LoaderCircle size={16} className="decision-spinner" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{busy ? 'Comparing approaches' : 'Compare approaches'}</button>
      </section>}
      <section className="decision-output-column" aria-label="Decision outputs">
        <header className="decision-column-heading"><div><span className="decision-step">01</span><h3>Next best actions / approach comparison</h3></div><GitBranch size={19} aria-hidden="true" /></header>
        {summary && <div className={`decision-comparison-summary decision-summary-${summary.kind}`} role="status"><h4>{summary.title}</h4><p>{summary.detail}</p></div>}
        <ComparisonTable snapshot={snapshot} branches={result?.branches} methods={displayedMethods} busy={busy} service={service} winners={winners} onAction={setAction} />
        {winners.length > 0 && <p className="decision-source-meta">{chapter.number === 3 ? 'Outlined: the approach supplied an independently checked, feasible plan.' : 'Outlined: qualifying approaches not beaten on both measured time and token cost. Multiple outlines indicate a tie or trade-off.'}</p>}
      </section>
      <section className="decision-preferred-output" aria-label="Execution logic">
        <aside className="decision-logic decision-logic-horizontal" aria-label={`${preferredMethod.label} logic diagram`}>
          <h3>Execution logic / {preferredMethod.label}</h3><p>Execution flow, not a private model reasoning trace.</p>
          <div className="decision-flow-scroll"><ol>{chapter.logic.map((step, index) => <li key={step.title}><div><span className="decision-logic-number">{index + 1}</span><div><h4>{step.title}</h4><p>{step.detail}</p></div></div>{index < chapter.logic.length - 1 && <ArrowRight size={18} aria-hidden="true" />}</li>)}</ol></div>
          {preferredMethod.id === 'decision1' && <BoundedChoices snapshot={snapshot} result={result?.branches.decision1} busy={busy} />}
          {snapshot.planningTask && <ImplementationPlan result={result?.branches.llm} />}
        </aside>
      </section>
      <details className="decision-reference-material"><summary>Scenario inputs and source reference</summary>
      <section className="decision-input-changes" aria-label="Scenario input changes">
        <header><h3>{chapter.number === 1 ? 'Baseline fixture inputs' : `What changes from scenario ${chapter.number - 1}?`}</h3><span>{chapter.number === 1 ? 'Starting evidence' : chapter.number === 2 ? 'Evidence changes / same task' : 'Evidence + task change'}</span></header>
        <p className="decision-task"><strong>Requested output</strong>{chapter.task}</p>
        <div className="decision-input-change-list">{chapter.inputs.map((input) => <div className="decision-input-change-row" key={input.evidenceId}><h4>{input.subject}</h4>{input.before && <p><span>Before</span>{input.before}</p>}<p><span>{input.before ? 'Now' : 'Baseline'}</span>{input.now}</p></div>)}</div>
        <p className="decision-source-meta">{chapter.number > 1 ? 'Other accounts, external context, source dates and shared policy checks stay unchanged.' : 'Coastal has a contact pause; the unverified company requires human review.'}</p>
      </section>
      <SalesPerformance snapshot={snapshot} />
      <section className="decision-input-column" aria-label="Snapshot evidence">
        <header className="decision-column-heading"><div><span className="decision-step">01</span><h3>{evidenceMode === 'live' ? 'IQ inputs' : 'Fixture inputs'}</h3></div><ArrowRight size={19} aria-hidden="true" /></header>
        <p className="decision-input-provenance">{result ? 'Retrieved synthetic snapshot from Azure AI Search / shared by all three approaches' : busy ? 'Local fixture preview / awaiting retrieved snapshot' : 'Local fixture preview / not yet retrieved'}</p>
        <p className="decision-input-provenance">No live Fabric, Web or Foundry IQ queries in this demo mode.</p>
        <div className="decision-input-agents">{SOURCES.filter((source) => source.name !== 'Scenario assumptions' || snapshot.planningTask).map((source) => <SourceInput key={`${variant}-${source.name}`} source={source} snapshot={snapshot} evidenceMode={evidenceMode} busy={busy} preview={!result} changedIds={changedIds} previousChapter={chapter.number > 1 ? chapter.number - 1 : null} />)}</div>
        <section className="decision-policy-summary" aria-label="Shared policy checks"><h4><ShieldCheck size={16} />Shared policy checks</h4>{summary ? <><p><strong>{summary.eligible}</strong> rankable / <strong>{summary.total}</strong> source candidates</p>{summary.reasonCodes.length > 0 && <ul>{summary.reasonCodes.map((reason) => <li key={reason}>{REASONS[reason] ?? reason}</li>)}</ul>}</> : <p>{busy ? 'Awaiting the joined snapshot' : 'Not evaluated'}</p>}</section>
      <details className="decision-prepared-state"><summary>Prepared decision snapshot</summary>
      <section className="decision-evidence-section">
        <h3>{evidenceMode === 'live' ? 'Territory Evidence' : 'Opportunity Evidence'}</h3>
        <div className="decision-context">{snapshot.asOf && <span>{evidenceMode === 'live' ? 'Observed' : 'Simulation as of'} {new Date(snapshot.asOf).toLocaleString()}</span>}{snapshot.reportingPeriod?.label ? <span>{snapshot.reportingPeriod.label}</span> : snapshot.reportingPeriod?.through && <span>Sales period {snapshot.reportingPeriod.start} through {snapshot.reportingPeriod.through}</span>}</div>
        {evidenceMode === 'live' && snapshot.candidates.length === 0 && result && <p className="decision-notice">No comparable territory data returned. No fixture data substituted.</p>}
        <div className="decision-table-scroll"><table><thead><tr><th>{evidenceMode === 'live' ? 'Territory' : 'Opportunity'}</th><th>{evidenceMode === 'live' ? 'Source period revenue' : 'Software value'}</th><th>{evidenceMode === 'live' ? 'Source period quota' : 'Permit project value'}</th><th>Shared policy</th></tr></thead><tbody>
          {snapshot.candidates.map((candidate) => <tr key={candidate.candidateId}><td><strong>{candidate.name}</strong><small>{candidate.motion}</small></td><td>{money(evidenceMode === 'live' ? candidate.territoryPerformance.revenue : candidate.opportunityAmount)}</td><td>{money(evidenceMode === 'live' ? candidate.territoryPerformance.quota : candidate.projectValue)}</td><td>{result?.policies[candidate.candidateId]?.reasonCodes.length ? result.policies[candidate.candidateId].reasonCodes.map((reason) => REASONS[reason] ?? reason).join('; ') : result ? 'Eligible for assessment' : 'Not evaluated'}</td></tr>)}
        </tbody></table></div>
        {snapshot.candidates.map((candidate) => <details key={candidate.candidateId} className="decision-source-detail"><summary>{candidate.name}</summary><p>Meeting requested: {candidate.buyingSignals.meetingRequested == null ? 'Unknown' : candidate.buyingSignals.meetingRequested ? 'Yes' : 'No'}. Unavailable capability required: {candidate.buyingSignals.requiresUnavailableCapability == null ? 'Unknown' : candidate.buyingSignals.requiresUnavailableCapability ? 'Yes' : 'No'}. Territory revenue / quota: {money(candidate.territoryPerformance.revenue)} / {money(candidate.territoryPerformance.quota)}.</p>{candidate.evidence.map((item) => <Evidence key={item.evidenceId} item={item} />)}</details>)}
        <details className="decision-source-detail"><summary>Current product capabilities and roadmap</summary>{snapshot.productEvidence.map((item) => <Evidence key={item.evidenceId} item={item} />)}</details>
        {result && <details className="decision-source-detail"><summary>Shared decision state (JSON)</summary><pre className="decision-source-text">{JSON.stringify(snapshot, null, 2)}</pre></details>}
        {result?.retrieval && <details className="decision-source-detail"><summary>Search retrieval receipt</summary><pre className="decision-source-text">{JSON.stringify(result.retrieval, null, 2)}</pre></details>}
      </section>
      </details>
      </section>
      </details>
      <details className="decision-rubric"><summary>Rules baseline</summary><p>{evidenceMode === 'live' ? 'Research priority = three times the proportional quota shortfall, bounded from 0 to 3. Missing or stale evidence requires review and receives no rank. No account outreach is allowed.' : 'Priority = 30% software value (capped at $250K) + 20% proportional quota gap + 30% requested meeting + 20% no unavailable capability required. Converted to a 0-3 rubric score. A requested meeting without an unavailable requirement maps to contact; other eligible cases map to research. Shared policy exclusions are not ranked.'}</p><p>{evidenceMode === 'live' ? 'Territory totals do not establish buyer intent, account fit, or account identity. These calls use the developer identity.' : 'Structured buying signals are authored synthetic inputs shared by every branch, not model predictions or evaluation labels.'}</p></details>
      <div className="decision-footnotes"><span>MAF workflow: {result ? `${result.elapsedMs.toFixed(1)} ms` : '--'}</span><span>Source retrieval: {evidenceMode === 'live' ? 'live hosted IQ agents' : evidenceMode === 'retrieved' ? 'Azure AI Search / synthetic records' : 'local synthetic fixture'}</span><span>Shared retrieval charge: not measured</span><span>Scores are not close probabilities</span></div>
      </div>
      {action && <ActionDialog key={actionKey} action={action} draft={drafts[actionKey] ?? {}} onSave={(draft) => setDrafts((previous) => ({ ...previous, [actionKey]: draft }))} onClose={() => setAction(null)} />}
    </div>
  )
}

function Evidence({ item }) {
  return <div id={`evidence-${item.evidenceId}`} className="decision-evidence"><div><strong>{item.evidenceId}</strong><span>{fixtureSourceLabel(item)} / {item.status}</span></div><p>{item.text ?? 'No evidence returned.'}</p><small>Effective {item.effectiveAt ?? 'unknown'}; observed {item.observedAt}</small>{item.references?.length > 0 && <p>Agent-reported sources: {item.references.join('; ')}</p>}</div>
}