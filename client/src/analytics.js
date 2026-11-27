import posthog from 'posthog-js'

const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export function detectDevice() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPod/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android.*Mobile/i.test(ua)) return 'Android phone'
  if (/Android/i.test(ua)) return 'Android tablet'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  if (/Linux/i.test(ua)) return 'Linux PC'
  return 'desktop'
}

export function initAnalytics(stamp) {
  if (!key) return false
  posthog.init(key, {
    api_host: host,
    ui_host: 'https://us.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]'
    }
  })
  if (stamp) {
    posthog.register({ device_stamp: stamp, device_type: detectDevice() })
  }
  return true
}

export function identifyForUser(user, stamp) {
  if (!key || !user) return
  const id = `user_${user.id}`
  if (stamp) posthog.alias(id, stamp)
  posthog.identify(id, { username: user.username, name: user.full_name, role: user.role })
}

export function trackScreen(screen, from) {
  if (!key) return
  posthog.capture('$screen_view', { screen, from: from || null, device_type: detectDevice() })
}

export default posthog
