import posthog from './analytics.js'

export function isEnabled(flag, fallback = false) {
  const value = posthog.isFeatureEnabled(flag)
  return value == null ? fallback : value
}

export function getFlag(flag, fallback = null) {
  const value = posthog.getFeatureFlag(flag)
  return value == null ? fallback : value
}

export function onFlags(callback) {
  posthog.onFeatureFlags(callback)
}

export function trackExperiment(flag, properties = {}) {
  posthog.capture('$feature_flag_called', { $feature_flag: flag, ...properties })
}
