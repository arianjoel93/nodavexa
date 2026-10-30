import posthog from './posthog'

type EventName =
  | 'resource_cta_click'
  | 'demo_cta_hero'
  | 'demo_cta_pricing'
  | 'demo_cta_final'
  | 'demo_form_start'
  | 'demo_form_submit'
  | 'whatsapp_click'
  | 'video_demo_play'
  | 'diagnostic_complete'
  | 'seo_service_page_view'
  | 'demo_cta_click'
  | 'contact_form_start'
  | 'contact_form_submit'
  | 'case_study_view'
  | 'product_card_click'
  | 'product_page_view'
  | 'control_interest'
  | 'bodegalia_interest'
  | 'weigh_label_interest'

export function trackEvent(name: EventName, properties?: Record<string, string | number | boolean>) {
  posthog?.capture(name, properties)
}
