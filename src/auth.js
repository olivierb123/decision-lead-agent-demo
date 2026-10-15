import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'

const TOKEN_SCOPE = 'https://ai.azure.com/.default'

// Redirect flow, not popup: login.microsoftonline.com sends
// Cross-Origin-Opener-Policy: same-origin, which permanently severs a popup
// from its opener once the popup navigates through the login page — so the
// opener can never detect completion or close the popup, regardless of what
// the redirect URI page does. Full-page redirect sidesteps that entirely.
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
}

const msalInstance = new PublicClientApplication(msalConfig)

const msalReady = msalInstance.initialize().then(() =>
  msalInstance.handleRedirectPromise().then((result) => {
    if (result?.account) {
      msalInstance.setActiveAccount(result.account)
    }
  }),
)

function getCachedAccount() {
  const active = msalInstance.getActiveAccount()
  if (active) return active
  const accounts = msalInstance.getAllAccounts()
  return accounts.length > 0 ? accounts[0] : null
}

/** Navigates the whole page to Microsoft sign-in; does not return. */
export async function signIn() {
  await msalReady
  await msalInstance.loginRedirect({ scopes: [TOKEN_SCOPE] })
}

/** Navigates the whole page to Microsoft sign-out; does not return. */
export async function signOut() {
  await msalReady
  const account = getCachedAccount()
  if (account) {
    await msalInstance.logoutRedirect({ account })
  }
}

export async function getActiveAccount() {
  await msalReady
  return getCachedAccount()
}

export async function getAccessToken() {
  await msalReady
  const account = getCachedAccount()
  if (!account) return null

  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: [TOKEN_SCOPE], account })
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ scopes: [TOKEN_SCOPE] })
      return null
    }
    throw err
  }
}
