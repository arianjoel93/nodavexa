import posthog from './posthog'

const logger = posthog?.logger

export const posthogLogs = {
  contactSubmissionCompleted() {
    logger?.info('contact form submission completed', {
      workflow: 'contact_form',
      outcome: 'submitted',
    })
  },
  contactSubmissionFailed() {
    logger?.warn('contact form submission failed', {
      workflow: 'contact_form',
      outcome: 'request_failed',
    })
  },
  shippingQuoteCalculated(quantity: number) {
    logger?.info('shipping quote calculated', {
      workflow: 'shipping_quote',
      outcome: 'available',
      quantity,
    })
  },
  shippingQuoteUnavailable() {
    logger?.warn('shipping quote unavailable', {
      workflow: 'shipping_quote',
      outcome: 'unavailable',
    })
  },
  shippingQuoteLookupFailed() {
    logger?.error('shipping quote lookup failed', {
      workflow: 'shipping_quote',
      outcome: 'request_failed',
    })
  },
}
