// Thin client for the real Foundry Hosted Agents (Foundry IQ docs, Fabric IQ
// sales performance), each proxied through the local Vite dev server (see
// vite.config.js) so the AAD bearer token never reaches the browser.
// Adapted from lead-agent-demo/src/agentClient.js's Responses-protocol SSE parser.

async function* parseSSEStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIndex
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
      if (!dataLines.length) continue

      const data = dataLines.join('\n')
      if (data === '[DONE]') continue

      try {
        yield JSON.parse(data)
      } catch {
        // ignore malformed/partial SSE frames
      }
    }
  }
}

/**
 * Run one turn against a deployed Foundry Hosted Agent, proxied at `proxyPath`.
 *
 * callbacks:
 *   - onText(fullText): streamed assistant text, called with the accumulated
 *     text so far each time new text arrives
 *   - onDone(): called when the run completes successfully
 *   - onError(message): called on failure
 *
 * accessToken: the signed-in user's own bearer token (from src/auth.js). When
 * present, the dev proxy forwards it as-is instead of minting its own token,
 * so agent tool calls that authenticate OBO (Fabric IQ) run as the real
 * browser user rather than the developer's local `az login` session.
 */
async function runIQQuery(proxyPath, question, callbacks = {}, accessToken = null) {
  const { onText = () => {}, onDone = () => {}, onError = () => {} } = callbacks

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const response = await fetch(proxyPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: question, stream: true }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Agent request failed: ${response.status} ${response.statusText}`)
    }

    const textByItemId = new Map()

    for await (const event of parseSSEStream(response)) {
      switch (event.type) {
        case 'response.output_text.delta': {
          const itemId = event.item_id
          const prev = textByItemId.get(itemId) || ''
          const next = prev + event.delta
          textByItemId.set(itemId, next)
          onText(next)
          break
        }
        case 'response.completed':
          onDone()
          break
        case 'response.incomplete':
          onError(event.response?.incomplete_details?.reason || 'Response incomplete')
          break
        case 'response.failed':
          onError(event.response?.error?.message || 'Response failed')
          break
        default:
          break
      }
    }
  } catch (err) {
    onError(err.message || String(err))
  }
}

/** Run one turn of the Foundry IQ docs agent (Azure AI Search grounded). */
export function runFoundryIQQuery(question, callbacks = {}, accessToken = null) {
  return runIQQuery('/api/foundry-iq/responses', question, callbacks, accessToken)
}

/** Run one turn of the Fabric IQ sales performance agent (live semantic model grounded). */
export function runFabricIQQuery(question, callbacks = {}, accessToken = null) {
  return runIQQuery('/api/fabric-iq/responses', question, callbacks, accessToken)
}

/** Run one turn of the Web IQ climate/disaster-risk agent (live web search grounded). */
export function runWebIQQuery(question, callbacks = {}, accessToken = null) {
  return runIQQuery('/api/web-iq/responses', question, callbacks, accessToken)
}

/** Run one turn of the Synergy agent (no tools — synthesizes 3 other agents' answers, given inline in `question`, into one takeaway). */
export function runSynergyQuery(question, callbacks = {}, accessToken = null) {
  return runIQQuery('/api/synergy/responses', question, callbacks, accessToken)
}
