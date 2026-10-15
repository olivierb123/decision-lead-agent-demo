import { useState, useEffect } from 'react'
import { Database, Users, Globe, FileText, ChevronDown, ChevronUp, Quote, Lock, Zap, LogIn, LogOut } from 'lucide-react'
import { mockRecords } from './data/mockRecords.js'
import { matchRecords } from './lib/matchRecords.js'
import { runFoundryIQQuery, runFabricIQQuery, runWebIQQuery, runSynergyQuery } from './agentClient.js'
import { signIn, signOut, getActiveAccount, getAccessToken } from './auth.js'
import { PERSONAS } from './data/personas.js'
import { accounts, opportunities, leads } from './data/raw/crm.js'
import { rows as salesPerformanceRows } from './data/raw/salesPerformance.js'
import { docs as productDocs } from './data/raw/productDocs.js'
import { calendarEvents, emails, messages } from './data/raw/m365.js'
import { permits } from './data/raw/permits.js'
import { riskRecords } from './data/raw/climateRisk.js'
import { usageRecords } from './data/raw/telemetry.js'
import { cases as supportCases } from './data/raw/supportCases.js'

const IQ_STYLES = {
  'Fabric IQ': {
    icon: Database,
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    glow: 'hover:border-emerald-500/40',
  },
  'Work IQ': {
    icon: Users,
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    glow: 'hover:border-sky-500/40',
  },
  'Web IQ': {
    icon: Globe,
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    glow: 'hover:border-amber-500/40',
  },
  'Foundry IQ': {
    icon: FileText,
    badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
    glow: 'hover:border-fuchsia-500/40',
  },
}

const CLASSIFICATION_STYLES = {
  Structured: 'bg-slate-500/10 text-slate-300 border-slate-600/40',
  'Semi-structured': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  Unstructured: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
}

const DOMAINS = [
  {
    name: 'CRM',
    iq: 'Fabric IQ',
    classification: 'Structured',
    tables: [
      { label: 'accounts', rows: accounts },
      { label: 'opportunities', rows: opportunities },
      { label: 'leads', rows: leads },
    ],
  },
  {
    name: 'Sales Performance',
    iq: 'Fabric IQ',
    classification: 'Structured',
    tables: [{ label: 'rows', rows: salesPerformanceRows }],
  },
  {
    name: 'Product Docs',
    iq: 'Foundry IQ',
    classification: 'Unstructured',
    tables: [{ label: 'docs', rows: productDocs }],
  },
  {
    name: 'M365',
    iq: 'Work IQ',
    classification: 'Semi-structured',
    tables: [
      { label: 'calendarEvents', rows: calendarEvents },
      { label: 'emails', rows: emails },
      { label: 'messages', rows: messages },
    ],
  },
  {
    name: 'Permits',
    iq: 'Web IQ',
    classification: 'Structured',
    tables: [{ label: 'permits', rows: permits }],
  },
  {
    name: 'Climate / Disaster Risk',
    iq: 'Web IQ',
    classification: 'Structured',
    tables: [{ label: 'riskRecords', rows: riskRecords }],
  },
  {
    name: 'Telemetry',
    iq: 'Fabric IQ',
    classification: 'Structured',
    tables: [{ label: 'usageRecords', rows: usageRecords }],
  },
  {
    name: 'Support Cases',
    iq: 'Fabric IQ',
    classification: 'Semi-structured',
    tables: [{ label: 'cases', rows: supportCases }],
  },
]

function RecordCard({ record, missingDomains, live }) {
  const [expanded, setExpanded] = useState(false)
  const primaryStyle = IQ_STYLES[record.groundingSources[0]]
  const isBlocked = missingDomains.length > 0
  const isFanOut = Boolean(live?.bySource)

  const citations = !isFanOut && live ? live.citations : record.citations
  const answerText =
    !isFanOut && live ? live.text || (live.status === 'streaming' ? 'Thinking…' : '') : record.answerPreview

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20 transition-colors ${
        isBlocked ? 'opacity-60' : primaryStyle.glow
      } ${live ? 'ring-1 ring-fuchsia-500/40' : ''} ${isFanOut ? 'md:col-span-3' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          {record.domain}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {record.groundingSources.map((source) => {
            const style = IQ_STYLES[source]
            const Icon = style.icon
            return (
              <span
                key={source}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide ${style.badge}`}
              >
                <Icon size={12} strokeWidth={2.5} />
                {source}
              </span>
            )
          })}
          {!isBlocked &&
            (live ? (
              <span className="flex items-center gap-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide text-fuchsia-300">
                <Zap size={12} strokeWidth={2.5} />
                {live.status === 'streaming' ? 'Live · streaming' : live.status === 'error' ? 'Live · error' : 'Live'}
              </span>
            ) : (
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide ${
                  record.confidence === 'High'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                }`}
              >
                {record.confidence === 'High' ? 'Verified' : 'Needs verification'}
              </span>
            ))}
        </div>
      </div>

      {isBlocked ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            Blocked for this persona — requires access to:{' '}
            <span className="font-mono">{missingDomains.join(', ')}</span>
          </span>
        </div>
      ) : isFanOut ? (
        <>
          <p className="mt-3 text-sm text-slate-200">{record.query}</p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2">
              {Object.entries(live.bySource).map(([source, sub]) => {
                const style = IQ_STYLES[source]
                const Icon = style.icon
                return (
                  <div key={source} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${style.badge}`}
                      >
                        <Icon size={11} strokeWidth={2.5} />
                        {source}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wide text-slate-600">
                        {sub.status === 'streaming' ? 'Streaming…' : sub.status === 'error' ? 'Error' : 'Done'}
                      </span>
                    </div>
                    {sub.question && <p className="mt-2 text-xs italic text-slate-500">{sub.question}</p>}
                    {sub.citations.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {sub.citations.map((citation, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                            <Quote size={11} className="mt-0.5 shrink-0 text-slate-700" />
                            <span className="font-mono">{citation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p
                      className={`mt-2 text-xs leading-relaxed ${
                        sub.status === 'error' ? 'text-red-400' : 'text-slate-300'
                      }`}
                    >
                      {sub.text || 'Thinking…'}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 md:col-span-1">
              <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-fuchsia-300">
                <Zap size={12} strokeWidth={2.5} />
                Synthesized takeaway
              </span>
              <p
                className={`mt-2 text-sm leading-relaxed ${
                  live.synthesis.status === 'error' ? 'text-red-400' : 'text-slate-200'
                }`}
              >
                {live.synthesis.status === 'pending'
                  ? 'Waiting for all three sources…'
                  : live.synthesis.text || 'Synthesizing…'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-200">{record.query}</p>

          <div className="mt-4 space-y-2">
            {citations.map((citation, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-slate-950/60 p-3 text-xs text-slate-400"
              >
                <Quote size={13} className="mt-0.5 shrink-0 text-slate-600" />
                <span className="font-mono">{citation}</span>
              </div>
            ))}
            {live && citations.length === 0 && live.status === 'streaming' && (
              <p className="text-xs italic text-slate-600">Retrieving citations…</p>
            )}
          </div>

          <p
            className={`mt-3 text-sm leading-relaxed ${
              live?.status === 'error' ? 'text-red-400' : 'text-slate-300'
            }`}
          >
            {answerText}
          </p>

          {!live && (
            <>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
              >
                Why this source?
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {expanded && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{record.reasoning}</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function extractDocCitations(text) {
  const ids = [...new Set(text.match(/DOC-\d+/g) || [])]
  return ids.map((id) => {
    const doc = productDocs.find((d) => d.docId === id)
    return doc
      ? `Foundry IQ index: ${doc.docId} — ${doc.title} (updated ${doc.lastUpdated})`
      : `Foundry IQ index: ${id}`
  })
}

// Web IQ's instructions mandate a fixed inline format: Source: <domain> —
// "<title>" (updated <lastUpdatedAt>). Parsed straight out of the streamed
// text, same idea as extractDocCitations but for a live web-search source
// instead of a fixed internal doc set.
function extractWebCitations(text) {
  const matches = [...text.matchAll(/Source:\s*([^\n—]+?)\s*—\s*"([^"]+)"\s*\(updated ([^)]+)\)/g)]
  return [...new Set(matches.map((m) => `Web IQ: ${m[1].trim()} — "${m[2].trim()}" (updated ${m[3].trim()})`))]
}

// Records with a real, deployed agent behind them (vs. the Stage 2 mock
// matcher). Each entry knows how to run its own agent and how to surface
// citations while streaming vs. once the response is done — Foundry IQ can
// name a specific doc mid-stream, but Fabric IQ has only one possible source,
// so there's nothing to parse: just show the fixed citation once it's done.
const LIVE_IQ_RECORDS = {
  'foundry-iq-docs': {
    run: runFoundryIQQuery,
    citationsForText: extractDocCitations,
  },
  'fabric-iq-sales': {
    run: runFabricIQQuery,
    citationsForText: () => [],
    doneCitations: ['Fabric IQ semantic model: sales_performance table — live query'],
  },
  'web-iq-climate': {
    run: runWebIQQuery,
    citationsForText: extractWebCitations,
  },
  // Composite record: one typed question fans out to all 3 live agents
  // concurrently (each sub-config below), then a 4th call (runSynergyQuery,
  // a no-tool synthesis agent) combines their answers into one takeaway.
  'composite-leadgen-focus': {
    fanOut: [
      {
        source: 'Fabric IQ',
        run: runFabricIQQuery,
        question: 'Which territories are behind quota this quarter, and by how much?',
        citationsForText: () => [],
        doneCitations: ['Fabric IQ semantic model: sales_performance table — live query'],
      },
      {
        source: 'Web IQ',
        run: runWebIQQuery,
        question: "What's the storm risk outlook for our Miami-Dade project?",
        citationsForText: extractWebCitations,
      },
      {
        source: 'Foundry IQ',
        run: runFoundryIQQuery,
        question: 'How do we position FieldForge against Procore in a competitive deal?',
        citationsForText: extractDocCitations,
      },
    ],
  },
}

function DataTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs italic text-slate-600">No records.</p>
  }
  const columns = Object.keys(rows[0])

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80">
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-900 odd:bg-slate-950/40 last:border-0">
              {columns.map((col) => {
                const val = row[col]
                const display =
                  val === null || val === undefined
                    ? '—'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val)
                return (
                  <td key={col} className="whitespace-nowrap px-3 py-2 text-slate-300">
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DomainSection({ domain }) {
  const style = IQ_STYLES[domain.iq]
  const Icon = style.icon

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">{domain.name}</h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide ${CLASSIFICATION_STYLES[domain.classification]}`}
          >
            {domain.classification}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide ${style.badge}`}
          >
            <Icon size={12} strokeWidth={2.5} />
            {domain.iq}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {domain.tables.map((t) => (
          <div key={t.label}>
            <p className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-600">
              {t.label}
            </p>
            <DataTable rows={t.rows} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [tab, setTab] = useState('raw')
  const [question, setQuestion] = useState('')
  const [activePersona, setActivePersona] = useState(PERSONAS[0])
  const [auditLog, setAuditLog] = useState([])
  const [liveMode, setLiveMode] = useState(false)
  const [liveRecordId, setLiveRecordId] = useState(null)
  const [liveResult, setLiveResult] = useState(null)
  const [account, setAccount] = useState(null)

  useEffect(() => {
    getActiveAccount().then(setAccount)
  }, [])

  // signIn()/signOut() navigate the whole page away (redirect flow) and
  // never resolve inline — the mount effect's getActiveAccount() picks up
  // the result after the page reloads post-redirect.
  const handleSignIn = () => {
    signIn()
  }

  const handleSignOut = () => {
    signOut()
  }

  const isFiltered = question.trim().length > 0
  const matches = isFiltered ? matchRecords(mockRecords, question) : mockRecords

  const missingDomainsFor = (record) =>
    record.sourceDomains.filter((d) => !activePersona.allowedDomains.includes(d))

  const handleQueryKeyDown = async (e) => {
    if (e.key !== 'Enter') return
    const trimmed = question.trim()
    if (!trimmed) return
    const blockedCount = matches.filter((r) => missingDomainsFor(r).length > 0).length
    setAuditLog((log) => [
      {
        id: `${Date.now()}-${log.length}`,
        timestamp: new Date().toLocaleTimeString(),
        persona: activePersona.label,
        question: trimmed,
        matchedCount: matches.length - blockedCount,
        blockedCount,
      },
      ...log,
    ])

    if (liveMode) {
      const liveRecord =
        matches.find((r) => LIVE_IQ_RECORDS[r.id]?.fanOut) || matches.find((r) => LIVE_IQ_RECORDS[r.id])
      if (liveRecord) {
        const config = LIVE_IQ_RECORDS[liveRecord.id]
        setLiveRecordId(liveRecord.id)
        const token = account ? await getAccessToken() : null

        if (config.fanOut) {
          setLiveResult({
            status: 'streaming',
            bySource: Object.fromEntries(
              config.fanOut.map((sub) => [
                sub.source,
                { status: 'streaming', text: '', citations: [], question: sub.question },
              ]),
            ),
            synthesis: { status: 'pending', text: '' },
          })

          const runOne = (sub) =>
            new Promise((resolve) => {
              let finalText = ''
              sub.run(
                sub.question,
                {
                  onText: (text) => {
                    finalText = text
                    setLiveResult((r) =>
                      r
                        ? {
                            ...r,
                            bySource: {
                              ...r.bySource,
                              [sub.source]: {
                                ...r.bySource[sub.source],
                                status: 'streaming',
                                text,
                                citations: sub.citationsForText(text),
                              },
                            },
                          }
                        : r,
                    )
                  },
                  onDone: () => {
                    setLiveResult((r) =>
                      r
                        ? {
                            ...r,
                            bySource: {
                              ...r.bySource,
                              [sub.source]: {
                                ...r.bySource[sub.source],
                                status: 'done',
                                citations: sub.doneCitations ?? r.bySource[sub.source].citations,
                              },
                            },
                          }
                        : r,
                    )
                    resolve({ source: sub.source, text: finalText })
                  },
                  onError: (message) => {
                    setLiveResult((r) =>
                      r
                        ? {
                            ...r,
                            bySource: {
                              ...r.bySource,
                              [sub.source]: { ...r.bySource[sub.source], status: 'error', text: message, citations: [] },
                            },
                          }
                        : r,
                    )
                    resolve({ source: sub.source, text: `(${sub.source} failed: ${message})` })
                  },
                },
                token,
              )
            })

          const results = await Promise.all(config.fanOut.map(runOne))

          setLiveResult((r) => (r ? { ...r, status: 'done', synthesis: { status: 'streaming', text: '' } } : r))

          const synthesisInput = [
            'Synthesize these three grounded answers into one lead-generation takeaway:',
            ...results.map((res) => `${res.source}: ${res.text}`),
          ].join('\n\n')

          runSynergyQuery(
            synthesisInput,
            {
              onText: (text) => setLiveResult((r) => (r ? { ...r, synthesis: { status: 'streaming', text } } : r)),
              onDone: () =>
                setLiveResult((r) => (r ? { ...r, synthesis: { ...r.synthesis, status: 'done' } } : r)),
              onError: (message) =>
                setLiveResult((r) => (r ? { ...r, synthesis: { status: 'error', text: message } } : r)),
            },
            token,
          )
        } else {
          setLiveResult({ status: 'streaming', text: '', citations: [] })
          config.run(
            trimmed,
            {
              onText: (text) =>
                setLiveResult({ status: 'streaming', text, citations: config.citationsForText(text) }),
              onDone: () =>
                setLiveResult((r) => (r ? { ...r, status: 'done', citations: config.doneCitations ?? r.citations } : r)),
              onError: (message) => setLiveResult({ status: 'error', text: message, citations: [] }),
            },
            token,
          )
        }
      } else {
        setLiveRecordId(null)
        setLiveResult(null)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          Grounded Agent Console
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {tab === 'raw'
            ? 'Stage 1 — raw, source-shaped data as it actually lives in each system of record.'
            : tab === 'grounded'
            ? 'Stage 2 — normalized into agent-ready, citable records. Ask a question below to see which grounded source(s) an agent would retrieve.'
            : `Stage 3 — access control, citation confidence, and a live audit trail. Viewing as ${activePersona.label}; switch personas to see records get blocked or unblocked.`}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setTab('raw')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
              tab === 'raw'
                ? 'border-slate-600 bg-slate-800 text-slate-100'
                : 'border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            Stage 1: Raw Data
          </button>
          <button
            onClick={() => setTab('grounded')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
              tab === 'grounded'
                ? 'border-slate-600 bg-slate-800 text-slate-100'
                : 'border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            Stage 2: Grounded Console
          </button>
          <button
            onClick={() => setTab('governance')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
              tab === 'governance'
                ? 'border-slate-600 bg-slate-800 text-slate-100'
                : 'border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            Stage 3: Governance
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-600">
              Viewing as
            </span>
            {PERSONAS.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setActivePersona(persona)}
                className={`rounded-lg border px-3 py-1 text-xs font-mono uppercase tracking-wide transition-colors ${
                  activePersona.id === persona.id
                    ? 'border-slate-600 bg-slate-800 text-slate-100'
                    : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {persona.label}
              </button>
            ))}
          </div>

          {account ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">
                Signed in: {account.username}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1 text-xs font-mono uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
              >
                <LogOut size={12} strokeWidth={2.5} />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1 text-xs font-mono uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
            >
              <LogIn size={12} strokeWidth={2.5} />
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {tab === 'raw' ? (
          <div className="space-y-5">
            {DOMAINS.map((domain) => (
              <DomainSection key={domain.name} domain={domain} />
            ))}
          </div>
        ) : tab === 'grounded' ? (
          <div>
            <div className="mb-6">
              <div className="flex gap-2">
                {liveMode && (
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQueryKeyDown}
                    placeholder="Ask a question, e.g. &ldquo;Is Coastal Grade & Pave at renewal risk?&rdquo;"
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
                  />
                )}
                <button
                  onClick={() => {
                    if (liveMode) {
                      setLiveMode(false)
                      setLiveRecordId(null)
                      setLiveResult(null)
                      setQuestion('')
                      return
                    }
                    if (!account) {
                      handleSignIn()
                      return
                    }
                    setLiveMode(true)
                    setLiveRecordId(null)
                    setLiveResult(null)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-mono uppercase tracking-wide transition-colors ${
                    liveMode
                      ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Zap size={12} strokeWidth={2.5} />
                  Live: Foundry IQ + Fabric IQ + Web IQ
                </button>
                {isFiltered && (
                  <button
                    onClick={() => {
                      setQuestion('')
                      setLiveResult(null)
                    }}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-mono uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              {!liveMode && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Turn on Live to ask a question against the real deployed agents.
                </p>
              )}
              {isFiltered && (
                <p className="mt-2 text-xs text-slate-500">
                  {matches.length > 0
                    ? `Matched ${matches.length} of ${mockRecords.length} grounded records`
                    : 'No grounded source matches that yet.'}
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-600">Press Enter to log this query to the Stage 3 audit trail.</p>
              {liveMode && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Live mode calls real, deployed agents — Foundry IQ (Azure AI Search) for Product Docs, Fabric
                  IQ (a live semantic model) for Sales Performance, and Web IQ (live web search grounding) for
                  Climate/Disaster Risk — everything else on this tab still uses the Stage 2 mock matcher. Try
                  &ldquo;Where should we focus new lead generation — factoring in territory quota performance,
                  regional storm risk, and our competitive edge against Procore?&rdquo; to see all 3 IQs fan out
                  from one query, then a 4th live agent synthesize their answers into one takeaway.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {matches.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  missingDomains={missingDomainsFor(record)}
                  live={liveMode && record.id === liveRecordId ? liveResult : null}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-100">Access control — personas</h2>
              <p className="mt-1 text-xs text-slate-500">
                Each role is granted access to a subset of the 8 domains from Stage 1. Records that
                touch a domain outside the active persona's access get blocked on the Stage 2 tab.
              </p>
              <div className="mt-4 space-y-3">
                {PERSONAS.map((persona) => (
                  <div key={persona.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">{persona.label}</span>
                      <span className="text-[11px] text-slate-500">
                        {persona.allowedDomains.length} of 8 domains
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{persona.description}</p>
                    <p className="mt-2 text-[11px] font-mono text-slate-400">
                      {persona.allowedDomains.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-100">Audit log</h2>
              <p className="mt-1 text-xs text-slate-500">
                Every query submitted on the Stage 2 tab (press Enter) is recorded here with the
                active persona and what was matched vs. blocked.
              </p>
              {auditLog.length === 0 ? (
                <p className="mt-4 text-xs italic text-slate-600">
                  No queries yet — try Stage 2's search box and press Enter.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80">
                        <th className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500">
                          Time
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500">
                          Persona
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500">
                          Question
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500">
                          Matched
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-mono uppercase tracking-wide text-slate-500">
                          Blocked
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-900 odd:bg-slate-950/40 last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-400">{entry.timestamp}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{entry.persona}</td>
                          <td className="px-3 py-2 text-slate-300">{entry.question}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{entry.matchedCount}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{entry.blockedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
