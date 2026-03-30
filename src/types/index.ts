// ── Enums ────────────────────────────────────────────────────
export type MovementType = 'ingreso' | 'gasto'
export type Partner = 'mau' | 'juani'
export type Currency = 'ARS' | 'USD' | 'EUR'

// ── DB row types ─────────────────────────────────────────────
export interface Profile {
  id: string
  name: string
  role: 'partner' | 'admin'
  created_at: string
}

export interface Business {
  id: string
  name: string
  color: string
  active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface SplitRule {
  id: string
  business_id: string | null
  category_id: string | null
  pct_mau: number
  pct_juani: number
  businesses?: Business
  categories?: Category
}

export interface Template {
  id: string
  name: string
  business_id: string
  category_id: string
  type: MovementType
  default_paid_by: Partner
  description: string | null
  is_favorite: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  businesses?: Business
  categories?: Category
}

export interface Movement {
  id: string
  date: string
  amount: number
  currency: Currency
  exchange_rate: number
  amount_ars: number
  type: MovementType
  business_id: string
  category_id: string
  paid_by: Partner
  created_by: string | null
  description: string | null
  affects_balance: boolean
  split_override: boolean
  pct_mau: number
  pct_juani: number
  template_id: string | null
  created_at: string
  updated_at: string
  businesses?: Business
  categories?: Category
  profiles?: Profile
}

export interface ExchangeRate {
  id: string
  currency: string
  rate: number
  valid_from: string
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  user_id: string | null
  created_at: string
  profiles?: Profile
}

// ── Balance types ─────────────────────────────────────────────
export interface PartnerBalance {
  paid: number       // lo que pagó/cobró realmente
  should: number     // lo que le correspondía según regla
  balance: number    // paid - should  →  >0 le deben, <0 debe
}

export interface PeriodBalance {
  mau: PartnerBalance
  juani: PartnerBalance
  totalIncome: number
  totalExpense: number
  netResult: number
  movementCount: number
  /** Quién debe a quién y cuánto (para mostrar en el hero) */
  debtor: Partner | null
  creditor: Partner | null
  debtAmount: number
}

export interface BusinessBalance extends PeriodBalance {
  business: Business
}

export interface DashboardData {
  globalBalance: PeriodBalance
  byBusiness: BusinessBalance[]
  recentMovements: Movement[]
  periods: string[] // 'YYYY-MM'
}

// ── Form / API payloads ───────────────────────────────────────
export interface MovementPayload {
  date: string
  amount: number
  currency: Currency
  exchange_rate: number
  type: MovementType
  business_id: string
  category_id: string
  paid_by: Partner
  description?: string
  affects_balance: boolean
  split_override: boolean
  pct_mau: number
  pct_juani: number
  template_id?: string
}

export interface TemplatePayload {
  name: string
  business_id: string
  category_id: string
  type: MovementType
  default_paid_by: Partner
  description?: string
  is_favorite?: boolean
}

export interface SplitRulePayload {
  business_id: string | null
  category_id: string | null
  pct_mau: number
  pct_juani: number
}

// ── Filter types ──────────────────────────────────────────────
export interface MovementFilters {
  period?: string       // 'YYYY-MM' o vacío
  business_id?: string
  category_id?: string
  type?: MovementType
  paid_by?: Partner
  currency?: Currency
  search?: string
  affects_balance?: boolean
  page?: number
  limit?: number
}

// ── API response wrapper ──────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ── Supabase DB type (para el cliente tipado) ─────────────────
export interface Database {
  public: {
    Tables: {
      profiles:       { Row: Profile;      Insert: Omit<Profile, 'created_at'>;      Update: Partial<Profile> }
      businesses:     { Row: Business;     Insert: Omit<Business, 'id'|'created_at'>; Update: Partial<Business> }
      categories:     { Row: Category;     Insert: Omit<Category, 'id'|'created_at'>; Update: Partial<Category> }
      split_rules:    { Row: SplitRule;    Insert: Omit<SplitRule, 'id'>;             Update: Partial<SplitRule> }
      templates:      { Row: Template;     Insert: Omit<Template, 'id'|'created_at'|'updated_at'>; Update: Partial<Template> }
      movements:      { Row: Movement;     Insert: Omit<Movement, 'id'|'amount_ars'|'created_at'|'updated_at'>; Update: Partial<Movement> }
      exchange_rates: { Row: ExchangeRate; Insert: Omit<ExchangeRate, 'id'|'created_at'>; Update: Partial<ExchangeRate> }
      audit_log:      { Row: AuditLog;     Insert: Omit<AuditLog, 'id'|'created_at'>; Update: never }
    }
    Views: {
      v_balance_by_period: { Row: Record<string, unknown> }
    }
    Functions: {
      calculate_balance: {
        Args: { p_period_start?: string; p_period_end?: string; p_business_id?: string }
        Returns: Array<{
          mau_paid: number; juani_paid: number
          mau_should: number; juani_should: number
          mau_balance: number; juani_balance: number
          total_income: number; total_expense: number
          net_result: number; movement_count: number
        }>
      }
    }
  }
}
