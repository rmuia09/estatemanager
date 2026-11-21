import 'dotenv/config'
import { PostHog } from 'posthog-node'

const apiKey = process.env.POSTHOG_API_KEY
const host = process.env.POSTHOG_HOST

if (process.env.NODE_ENV !== 'production') {
  if (!apiKey) {
    throw new Error('POSTHOG_API_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_API_KEY is configured')
  }
  if (!host) {
    throw new Error('POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured')
  }
}

const posthog = apiKey && host
  ? new PostHog(apiKey, {
      host,
      enableExceptionAutocapture: true,
      flushAt: 1,
      flushInterval: 0
    })
  : null

export function userDistinctId(user) {
  return user && user.id != null ? `user_${user.id}` : undefined
}

export function identifyUser(user) {
  const distinctId = userDistinctId(user)
  if (!posthog || !distinctId) return
  posthog.identify({
    distinctId,
    properties: {
      username: user.username,
      name: user.full_name,
      role: user.role
    }
  })
}

export function captureEvent(user, event, properties = {}) {
  const distinctId = userDistinctId(user)
  if (!posthog || !distinctId) return
  posthog.capture({ distinctId, event, properties })
}

export function captureException(error, user, properties = {}) {
  if (!posthog) return
  posthog.captureException(error, userDistinctId(user), properties)
}

export async function flushPostHog() {
  if (posthog) await posthog.flush()
}

export async function shutdownPostHog() {
  if (posthog) await posthog.shutdown()
}

export default posthog
