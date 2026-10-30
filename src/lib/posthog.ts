import posthog from 'posthog-js'

const token = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined

if (!token && import.meta.env.DEV) {
  throw new Error(
    'VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured',
  )
}

if (!host && import.meta.env.DEV) {
  throw new Error(
    'VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured',
  )
}

const posthogClient = token && host
  ? posthog.init(token, {
      api_host: host,
      capture_pageview: 'history_change',
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      defaults: '2026-05-30',
      logs: {
        serviceName: 'nodavexa-web',
        environment: import.meta.env.MODE,
      },
    })
  : undefined

export default posthogClient
