// Ortak tipler — DB şeması ile hizalı

export type UserRole = "admin" | "market_manager" | "viewer";
export type TranslationStatus = "draft" | "translated" | "approved";
export type SchemaType = "Article" | "Product" | "FAQ";
export type ExecutionType = "audit" | "schema" | "redirect" | "geo" | "optimization";
export type ExecutionStatus = "todo" | "in_progress" | "done";

export interface Market {
  id: string;
  code: string;
  name: string;
  locale: string;
  is_source: boolean;
  sort_order: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  market_id: string | null;
}

export interface Content {
  id: string;
  title: string;
  target_keyword: string | null;
  slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  body: string | null;
  schema_type: SchemaType;
  created_at: string;
  updated_at: string;
}

export interface ContentTranslation {
  id: string;
  content_id: string;
  market_id: string;
  title: string | null;
  target_keyword: string | null;
  slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  body: string | null;
  status: TranslationStatus;
  needs_local_review: boolean;
  translated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
}

export interface Guideline {
  id: string;
  title: string;
  category: string | null;
  body: string | null;
  updated_at: string;
}

export interface GuidelineTranslation {
  id: string;
  guideline_id: string;
  market_id: string;
  title: string | null;
  body: string | null;
  status: TranslationStatus;
  translated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
}

export interface Execution {
  id: string;
  market_id: string;
  type: ExecutionType;
  description: string | null;
  urls: string | null;
  status: ExecutionStatus;
  due_date: string | null;
  output_file_url: string | null;
  created_at: string;
}

// UI etiketleri (TR)
export const STATUS_LABELS_TR: Record<TranslationStatus, string> = {
  draft: "Taslak",
  translated: "Çevrildi",
  approved: "Onaylandı",
};

export const EXEC_STATUS_LABELS_TR: Record<ExecutionStatus, string> = {
  todo: "Yapılacak",
  in_progress: "Devam",
  done: "Tamamlandı",
};

export const EXEC_TYPE_LABELS_TR: Record<ExecutionType, string> = {
  audit: "Audit",
  schema: "Schema",
  redirect: "Redirect",
  geo: "GEO",
  optimization: "Optimizasyon",
};

export const ROLE_LABELS_TR: Record<UserRole, string> = {
  admin: "Admin (NextCode)",
  market_manager: "Pazar yöneticisi",
  viewer: "İzleyici (GM)",
};
