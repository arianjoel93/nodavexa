export type Equipment = { id?: string; name: string; weight: string; length: string; width: string; height: string }
export type DocumentFile = { id?: string; name: string; url: string; file_path?: string; kind: 'datasheet' | 'manual' }
export type ProductPageContent = {
  h1: string
  lead: string
  intro: string
  whatsapp: string
  flow: string[]
  manualFlow?: string[]
  sections: { heading: string; copy: string; items?: string[] }[]
  audiences: string[]
  price?: string
  priceNote?: string
}
export type Solution = {
  id: string; slug: string; name: string; excerpt: string; description: string; category: string;
  cover_url: string; cover_file_path?: string; video_url?: string; website_url?: string; featured: boolean; published: boolean; created_at?: string;
  seo_keywords: string[]; seo_description: string;
  base_price_mxn: number; vat_rate: number; quote_enabled: boolean;
  item_type: 'solution' | 'product'; has_vat: boolean; payment_type: 'one_time' | 'monthly';
  software_pricing_model?: 'deposit_monthly' | 'total_maintenance';
  initial_price_mxn?: number; annual_maintenance_price_mxn?: number;
  sat_withholdings_enabled?: boolean; isr_withholding_rate?: number; vat_withholding_rate?: number;
  shipping_weight_kg: number; shipping_length_cm: number; shipping_width_cm: number; shipping_height_cm: number;
  equipment: Equipment[]; documents: DocumentFile[]
  product_page?: ProductPageContent | null
}
export type SiteSettings = {
  whatsapp: string
  email: string
  address: string
  form_maintenance_mxn?: number
  form_extra_changes_note?: string
  form_landing_quote_min_mxn?: number
  form_landing_quote_max_mxn?: number
  homepage_hero_slides?: HomepageHeroSlide[]
}
export type HomepageHeroSlide = {
  image_url: string
  alt: string
}
export type SuccessCase = {
  id: string; slug: string; title: string; client_type: string; problem: string; result: string;
  description: string; cover_url: string; cover_file_path?: string; featured: boolean; published: boolean;
  created_at?: string; updated_at?: string
}
export type SuccessCaseVideo = {
  id: string; slug: string; title: string; video_url: string; youtube_id: string; description: string;
  position: number; published: boolean; created_at?: string; updated_at?: string
}
export type ProjectServiceType = 'landing_page' | 'website' | 'web_app' | 'installable_software'
export type ProjectRequestStatus = 'new' | 'reviewing' | 'quoted' | 'sent' | 'archived'
export type ProjectRequest = {
  id: string
  form_slug: string
  status: ProjectRequestStatus
  service_type: ProjectServiceType
  company_name: string
  contact_name: string
  email: string
  phone: string
  country: string
  company_website: string
  company_description: string
  project_goal: string
  target_audience: string
  references_text: string
  brand_assets: string
  content_status: string
  sections_needed: string[]
  features_needed: string[]
  integrations_needed: string[]
  pages_count: number
  deadline?: string
  budget_range?: string
  technical_notes: string
  maintenance_ack: boolean
  updates_ack: boolean
  annual_maintenance_mxn: number
  quote?: ProjectQuote | null
  quoted_at?: string
  sent_at?: string
  created_at?: string
  updated_at?: string
}
export type QuoteLine = { label: string; description?: string; amount: number }
export type ProjectQuote = {
  quote_number: string
  currency: 'MXN' | 'USD'
  service_title: string
  lines: QuoteLine[]
  subtotal: number
  discount_percent: number
  discount_amount: number
  annual_maintenance_mxn: number
  total: number
  notes: string
  valid_until: string
  created_at: string
  exchange_rate_mxn_per_usd?: number
}

export type QuoteClient = {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  country: string
  website: string
  tax_id: string
  billing_name: string
  billing_address: string
  marketing_consent: boolean
  notes: string
  source: string
  created_at?: string
  updated_at?: string
}

export type QuoteProduct = {
  id: string
  name: string
  description: string
  unit_price_mxn: number
  cost_mxn?: number
  unit_type: 'total' | 'hour'
  taxable: boolean
  product_type: 'service' | 'product' | 'maintenance' | 'domain' | 'email' | 'other'
  active: boolean
  created_at?: string
  updated_at?: string
}

export type SalesQuoteItem = {
  id?: string
  quote_id?: string
  product_id?: string | null
  name: string
  description: string
  quantity: number
  unit_price: number
  cost_unit_mxn?: number
  unit_type?: 'total' | 'hour'
  taxable: boolean
  hidden: boolean
  position: number
}

export type SalesQuote = {
  id: string
  quote_number: string
  client_id?: string | null
  project_request_id?: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived' | 'ordered'
  title: string
  currency: 'MXN' | 'USD'
  exchange_rate_mxn_per_usd?: number | null
  invoice_required: boolean
  vat_rate: number
  subtotal: number
  discount_percent: number
  discount_amount: number
  vat_amount: number
  sat_isr_rate?: number
  sat_other_tax_rate?: number
  sat_income_tax_amount?: number
  sat_other_tax_amount?: number
  cost_total?: number
  gross_margin?: number
  converted_order_id?: string | null
  total: number
  notes: string
  internal_notes: string
  valid_until?: string | null
  sent_at?: string | null
  created_at?: string
  updated_at?: string
  quote_clients?: QuoteClient | null
  sales_quote_items?: SalesQuoteItem[]
}

export type SalesOrderItem = {
  id?: string
  order_id?: string
  quote_item_id?: string | null
  product_id?: string | null
  name: string
  description: string
  quantity: number
  unit_price: number
  unit_type?: 'total' | 'hour'
  cost_unit_mxn: number
  hidden: boolean
  position: number
}

export type SalesOrder = {
  id: string
  order_number: string
  quote_id?: string | null
  client_id?: string | null
  status: 'draft' | 'confirmed' | 'in_progress' | 'delivered' | 'paid' | 'cancelled'
  title: string
  currency: 'MXN' | 'USD'
  exchange_rate_mxn_per_usd?: number | null
  invoice_required: boolean
  vat_rate: number
  sat_isr_rate: number
  sat_other_tax_rate: number
  subtotal: number
  discount_amount: number
  vat_amount: number
  sat_income_tax_amount: number
  sat_other_tax_amount: number
  total: number
  cost_total: number
  gross_margin: number
  paid_amount: number
  notes: string
  confirmed_at?: string
  created_at?: string
  updated_at?: string
  quote_clients?: QuoteClient | null
  sales_order_items?: SalesOrderItem[]
}
