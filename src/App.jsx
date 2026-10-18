import { useState, useEffect } from 'react'
import { Database, Users, Globe, FileText, ChevronDown, ChevronUp, Quote, Lock, Zap, LogIn, LogOut } from 'lucide-react'
import { mockRecords } from './data/mockRecords.js'
import { docs as productDocs } from './data/raw/productDocs.js'
import { matchRecords } from './lib/matchRecords.js'
import { runFoundryIQQuery, runFabricIQQuery, runWebIQQuery, runSynergyQuery } from './agentClient.js'
import { signIn, signOut, getActiveAccount, getAccessToken } from './auth.js'
import { PERSONAS } from './data/personas.js'
import DecisionWorkbench from './DecisionWorkbench.jsx'

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
                {record.confidence === 'High' ? 'Fixture' : 'Fixture - unverified match'}
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

export default function App() {
  const [question, setQuestion] = useState('')
  const [activePersona, setActivePersona] = useState(PERSONAS[0])
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
      <main className="mx-auto max-w-6xl px-6 py-10">
          <section aria-label="Seller priorities" className="mb-10">
            <DecisionWorkbench />
          </section>
          <details className="border-t border-slate-800 pt-6">
            <summary className="cursor-pointer text-sm text-slate-400">Fixture reference console</summary>
      <header className="border-b border-slate-800 px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          FieldForge Lead Agent
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Grounded evidence and seller priorities
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Demo persona
            </span>
            <select
              aria-label="Demo persona"
              value={activePersona.id}
              onChange={(event) => setActivePersona(PERSONAS.find((persona) => persona.id === event.target.value))}
              className="min-w-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            >
              {PERSONAS.map((persona) => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
            </select>
          </label>

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

          <section aria-label="Grounded evidence" className="mt-6 mb-10">
            <h2 className="mb-4 text-lg font-semibold">Grounded Evidence</h2>
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    aria-label="Grounded evidence question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQueryKeyDown}
                    placeholder="Where should we focus new lead generation?"
                    className="min-w-0 basis-full flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none sm:basis-0"
                  />
                <button
                  role="switch"
                  aria-checked={liveMode}
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
                  Live agents
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
              <p className="mt-2 text-xs text-slate-400">
                {liveMode ? 'Live agent queries enabled. Unmatched records remain synthetic.' : 'Source mode: synthetic grounded records'}
              </p>
              {isFiltered && (
                <p className="mt-2 text-xs text-slate-500">
                  {matches.length > 0
                    ? `Matched ${matches.length} of ${mockRecords.length} grounded records`
                    : 'No grounded source matches that yet.'}
                </p>
              )}
            </div>

            <details open={isFiltered || liveMode ? true : undefined}>
              <summary className="mb-4 cursor-pointer text-sm text-slate-300">Source records ({matches.length})</summary>
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
            </details>
          </section>
          </details>
      </main>
    </div>
  )
}
