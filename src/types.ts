export type Equipment = { id?: string; name: string; weight: string; length: string; width: string; height: string }
export type DocumentFile = { id?: string; name: string; url: string; file_path?: string; kind: 'datasheet' | 'manual' }
export type Solution = {
  id: string; slug: string; name: string; excerpt: string; description: string; category: string;
  cover_url: string; cover_file_path?: string; video_url?: string; website_url?: string; featured: boolean; published: boolean; created_at?: string;
  seo_keywords: string[]; seo_description: string;
  base_price_mxn: number; vat_rate: number; quote_enabled: boolean;
  item_type: 'solution' | 'product'; has_vat: boolean; payment_type: 'one_time' | 'monthly';
  shipping_weight_kg: number; shipping_length_cm: number; shipping_width_cm: number; shipping_height_cm: number;
  equipment: Equipment[]; documents: DocumentFile[]
}
export type SiteSettings = { whatsapp: string; email: string; address: string }
export type SuccessCase = {
  id: string; slug: string; title: string; client_type: string; problem: string; result: string;
  description: string; cover_url: string; cover_file_path?: string; featured: boolean; published: boolean;
  created_at?: string; updated_at?: string
}
