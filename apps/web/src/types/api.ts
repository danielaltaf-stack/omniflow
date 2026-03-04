/** OmniFlow — Shared TypeScript types */

export interface User {
  id: string
  email: string
  name: string
  is_active: boolean
  is_verified: boolean
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirm: string
}

export interface LoginPayload {
  email: string
  password: string
}

// ── Phase 1B: Bank types ────────────────────────────────────
export interface BankField {
  id: string
  label: string
  type: string
  placeholder: string
  pattern?: string
  choices?: Record<string, string>
}

export interface Bank {
  module: string
  name: string
  logo_url: string
  fields: BankField[]
  sca_type: string
}

export interface BankConnection {
  id: string
  bank_module: string
  bank_name: string
  status: string
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  accounts_count: number
}

export interface SyncResponse {
  connection_id: string
  status: string
  accounts_synced: number
  transactions_synced: number
  error: string | null
  process_id?: string | null
}

export interface Account {
  id: string
  connection_id: string
  external_id: string
  type: string
  label: string
  balance: number // centimes
  currency: string
  bank_name: string
  bank_module: string
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  external_id: string
  date: string
  amount: number // centimes
  label: string
  raw_label: string | null
  type: string
  category: string | null
  subcategory: string | null
  merchant: string | null
  is_recurring: boolean
  created_at: string
}

export interface PaginatedTransactions {
  items: Transaction[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Phase 2A: Net Worth & Categories ───────────────────────
export interface NetWorthData {
  total: number       // centimes
  currency: string
  breakdown: Record<string, number>
  change: {
    absolute: number  // centimes
    percentage: number
    period: string
  }
}

export interface NetWorthHistoryPoint {
  date: string
  total: number
}

export interface CategoryStat {
  category: string
  count: number
  total: number      // centimes
  color: string
  icon: string
}

// ── Phase 2B: Crypto ──────────────────────────────────────
export interface CryptoWallet {
  id: string
  platform: string
  label: string
  chain: string
  status: string
  last_sync_at: string | null
  sync_error: string | null
  holdings_count: number
  total_value: number
  created_at: string
}

export interface CryptoHolding {
  token_symbol: string
  token_name: string
  quantity: number
  current_price: number   // centimes
  value: number           // centimes
  pnl: number
  pnl_pct: number
  change_24h: number
  allocation_pct: number
  wallet_id: string
  // B4
  is_staked: boolean
  staking_apy: number
  staking_source: string | null
}

export interface CryptoPortfolio {
  total_value: number
  change_24h: number
  holdings: CryptoHolding[]
  wallets: CryptoWallet[]
}

// B4: Tax
export interface CryptoDisposal {
  date: string
  token: string
  quantity: number
  prix_cession: number
  prix_acquisition_pmpa: number
  plus_ou_moins_value: number
}

export interface CryptoTaxSummary {
  year: number
  realized_pv: number
  realized_mv: number
  net_pv: number
  seuil_305_atteint: boolean
  taxable_pv: number
  flat_tax_30: number
  disposals_count: number
  disposals: CryptoDisposal[]
  unrealized_total: number
}

export interface CryptoTransaction {
  id: string
  wallet_id: string
  tx_type: string
  token_symbol: string
  quantity: number
  price_eur: number
  total_eur: number
  fee_eur: number
  counterpart: string | null
  tx_hash: string | null
  executed_at: string
  source: string
  created_at: string
}

export interface CryptoTransactionList {
  transactions: CryptoTransaction[]
  total: number
}

export interface CryptoPMPA {
  token_symbol: string
  pmpa_centimes: number
  total_quantity: number
  total_invested_centimes: number
}

// B4: Staking
export interface CryptoStakingPosition {
  token_symbol: string
  token_name: string
  quantity: number
  value: number
  apy: number
  source: string
  projected_annual_reward: number
}

export interface CryptoStakingSummary {
  total_staked_value: number
  projected_annual_rewards: number
  positions: CryptoStakingPosition[]
}

export interface SupportedChain {
  id: string
  name: string
  native_symbol: string
}

// ── Phase 2B: Stocks ──────────────────────────────────────
export interface StockPortfolio {
  id: string
  label: string
  broker: string
  envelope_type: string | null
  positions_count: number
  total_value: number
  created_at: string
}

export interface StockPosition {
  id: string
  portfolio_id: string
  symbol: string
  name: string
  quantity: number
  avg_buy_price: number | null
  current_price: number | null
  value: number
  pnl: number
  pnl_pct: number
  total_dividends: number
  sector: string | null
  currency: string
  allocation_pct: number
  // Phase B2 fields
  country: string | null
  isin: string | null
  annual_dividend_yield: number | null
  dividend_frequency: string | null
}

export interface StockSummary {
  total_value: number
  total_pnl: number
  total_pnl_pct: number
  total_dividends: number
  positions: StockPosition[]
  portfolios: StockPortfolio[]
}

// ── Phase B2: Performance vs Benchmark ────────────────────
export interface BenchmarkSeriesPoint {
  date: string
  value: number
}

export interface BenchmarkData {
  twr: number
  series: BenchmarkSeriesPoint[]
}

export interface PerformanceData {
  portfolio_twr: number
  benchmarks: Record<string, BenchmarkData>
  portfolio_series: BenchmarkSeriesPoint[]
  alpha: number
  period: string
}

// ── Phase B2: Dividend Calendar ───────────────────────────
export interface MonthlyDividend {
  month: number
  amount: number
}

export interface UpcomingDividend {
  symbol: string
  name: string
  ex_date: string
  pay_date: string | null
  amount_per_share: number
  total: number
}

export interface PositionDividend {
  symbol: string
  name: string
  annual_amount: number
  yield_pct: number
  frequency: string
  next_ex_date: string | null
}

export interface DividendCalendar {
  year: number
  total_annual_projected: number
  portfolio_yield: number
  monthly_breakdown: MonthlyDividend[]
  upcoming: UpcomingDividend[]
  by_position: PositionDividend[]
}

// ── Phase B2: Allocation & Diversification ────────────────
export interface SectorAllocation {
  sector: string
  value: number
  weight_pct: number
  positions_count: number
}

export interface CountryAllocation {
  country: string
  value: number
  weight_pct: number
  positions_count: number
}

export interface CurrencyAllocation {
  currency: string
  value: number
  weight_pct: number
}

export interface TopPosition {
  symbol: string
  name: string
  weight_pct: number
}

export interface AllocationAnalysis {
  by_sector: SectorAllocation[]
  by_country: CountryAllocation[]
  by_currency: CurrencyAllocation[]
  hhi_score: number
  diversification_score: number
  diversification_grade: string
  concentration_alerts: string[]
  suggestions: string[]
  top_positions: TopPosition[]
}

// ── Phase B2: Enveloppes Fiscales ─────────────────────────
export interface EnvelopeData {
  type: string
  label: string
  total_value: number
  total_pnl: number
  total_deposits: number
  positions_count: number
  portfolios: string[]
  ceiling: number | null
  ceiling_usage_pct: number | null
  management_fee_annual: number | null
  tax_rate: number
}

export interface EnvelopeSummary {
  envelopes: EnvelopeData[]
  total_value: number
  fiscal_optimization_tips: string[]
}

// ── Phase 2B: Real Estate ─────────────────────────────────
export interface RealEstateProperty {
  id: string
  label: string
  address: string | null
  city: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  property_type: string
  surface_m2: number | null
  purchase_price: number
  purchase_date: string | null
  current_value: number
  dvf_estimation: number | null
  monthly_rent: number
  monthly_charges: number
  monthly_loan_payment: number
  loan_remaining: number
  net_monthly_cashflow: number
  gross_yield_pct: number
  net_yield_pct: number
  net_net_yield_pct: number
  capital_gain: number
  annual_tax_burden: number
  // B3 detail fields
  fiscal_regime: string
  tmi_pct: number
  taxe_fonciere: number
  assurance_pno: number
  vacancy_rate_pct: number
  notary_fees_pct: number
  provision_travaux: number
  loan_interest_rate: number
  loan_insurance_rate: number
  loan_duration_months: number
  loan_start_date: string | null
  created_at: string
}

export interface RealEstateSummary {
  total_value: number
  total_purchase_price: number
  total_capital_gain: number
  total_capital_gain_pct: number
  total_monthly_rent: number
  total_monthly_charges: number
  total_monthly_loan: number
  total_loan_remaining: number
  net_monthly_cashflow: number
  avg_gross_yield_pct: number
  properties_count: number
  properties: RealEstateProperty[]
}

// ── Phase B3: Real Estate Analytics ───────────────────────
export interface ValuationHistoryEntry {
  id: string
  source: string
  price_m2_centimes: number
  estimation_centimes: number | null
  nb_transactions: number
  recorded_at: string | null
  created_at: string | null
}

export interface ValuationHistory {
  property_id: string
  valuations: ValuationHistoryEntry[]
}

export interface DVFRefreshResult {
  id: string
  source: string
  price_m2_centimes: number
  estimation_centimes: number | null
  nb_transactions: number
  recorded_at: string
  significant_change: boolean
  delta_pct: number
}

export interface CashFlowMonthly {
  month: number
  date: string
  rent: number
  charges: number
  loan_principal: number
  loan_interest: number
  loan_insurance: number
  tax_monthly: number
  cashflow: number
  cumulative_cashflow: number
  remaining_capital: number
}

export interface CashFlowProjection {
  property_id: string
  duration_months: number
  avg_monthly_cashflow: number
  total_interest_paid: number
  total_insurance_paid: number
  total_tax_paid: number
  total_rent_collected: number
  roi_at_end_pct: number
  payback_months: number
  monthly: CashFlowMonthly[]
}

// ── Phase 2B: Cash Flow ───────────────────────────────────
export interface CashFlowPeriod {
  date: string | null
  income: number
  expenses: number
  net: number
  savings_rate: number
  tx_count: number
}

export interface CashFlowSummary {
  total_income: number
  total_expenses: number
  total_net: number
  avg_income: number
  avg_expenses: number
  avg_net: number
  avg_savings_rate: number
  periods_count: number
}

export interface CashFlowTrends {
  income_ma: number[]
  expense_ma: number[]
  income_trend: string
  expense_trend: string
  income_change_pct: number
  expense_change_pct: number
}

export interface CashFlowData {
  periods: CashFlowPeriod[]
  summary: CashFlowSummary
  trends: CashFlowTrends
  top_categories: { category: string; count: number; total: number; percentage: number }[]
}

// ── Phase 2B: Currency ────────────────────────────────────
export interface ExchangeRates {
  base: string
  rates: Record<string, number>
}

// ── Phase 4A: AI Intelligence ─────────────────────────────

export interface ForecastPoint {
  date: string
  predicted: number      // centimes
  lower_bound: number    // centimes
  upper_bound: number    // centimes
}

export interface RecurringItem {
  merchant: string
  avg_amount: number     // centimes
  avg_interval_days: number
  next_expected: string
  occurrences: number
}

export interface ForecastData {
  current_balance: number
  forecast: ForecastPoint[]
  recurring: RecurringItem[]
  expected_income: number
  expected_expenses: number
  overdraft_risk: boolean
  overdraft_date: string | null
  method: string
  confidence_level: number
}

export interface Anomaly {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  confidence: number
  data: Record<string, any>
  is_read: boolean
  created_at: string | null
  transaction_id: string | null
}

export interface InsightTip {
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  data: Record<string, any>
}

export interface BudgetItem {
  category: string
  limit: number          // centimes
  spent: number          // centimes
  progress_pct: number
  level: string
  is_auto: boolean
  days_remaining: number
  remaining: number      // centimes
  daily_available: number // centimes
}

export interface BudgetGenerated {
  category: string
  limit: number
  avg_spent: number
  median_spent: number
  data_months: number
  is_volatile: boolean
}

export interface BudgetSummary {
  total_limit: number
  total_spent: number
  total_progress_pct: number
  categories_on_track: number
  categories_over_budget: number
  days_remaining: number
}

export interface BudgetCurrentResponse {
  month: string
  budgets: BudgetItem[]
  summary: BudgetSummary
}

export interface BudgetAutoGenerateResponse {
  budgets: BudgetGenerated[]
  summary: {
    total_categories: number
    total_limit: number
    total_avg_spent: number
    savings_potential: number
    level: string
    months_analyzed: number
  }
}

export interface AnomalyResponse {
  anomalies: Anomaly[]
  count: number
}

export interface TipsResponse {
  tips: InsightTip[]
  count: number
}

// ── Phase 4B: Nova AI Advisor ─────────────────────────────

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string | null
}

export interface ConversationData {
  id: string
  title: string
  message_count: number
  is_pinned?: boolean
  summary?: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ConversationDetail {
  id: string
  title: string
  messages: ChatMessageData[]
  created_at: string | null
}

export interface ConversationsResponse {
  conversations: ConversationData[]
  count: number
}

export interface ChatSuggestion {
  icon: string
  text: string
}

export interface SuggestionsResponse {
  suggestions: ChatSuggestion[]
}

export interface AdvisorStatus {
  available: boolean
  model: string
  provider?: string
  providers_count?: number
  rate_limit: {
    allowed: boolean
    remaining: number
    used: number
    limit: number
  }
  name: string
  version: string
  capabilities?: string[]
}

// ── Nova Memory types ─────────────────────────────────────

export type MemoryType = 'fact' | 'preference' | 'goal' | 'insight' | 'personality'
export type MemoryCategory = 'general' | 'finance' | 'investment' | 'budget' | 'lifestyle' | 'tax' | 'retirement' | 'heritage' | 'real_estate' | 'career' | 'family'

export interface NovaMemory {
  id: string
  memory_type: MemoryType
  category: MemoryCategory
  content: string
  importance: number
  source_conversation_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface MemoriesResponse {
  memories: NovaMemory[]
  count: number
}

export interface MemoryStats {
  total: number
  by_type: Record<string, number>
  by_category: Record<string, number>
  avg_importance: number
}

// ── Phase 4B: Investment Simulator ────────────────────────

export interface SimulationParams {
  initial_amount: number
  monthly_contribution: number
  years: number
  scenario: string
  annual_return_pct: number
  annual_volatility_pct: number
  inflation_rate_pct: number
  monte_carlo_paths: number
}

export interface ProjectionPoint {
  month: number
  value: number
  invested: number
}

export interface MonteCarloResult {
  months: number[]
  percentiles: {
    p10: number[]
    p25: number[]
    p50: number[]
    p75: number[]
    p90: number[]
  }
  paths_count: number
}

export interface ScenarioResult {
  label: string
  description: string
  color: string
  annual_return_pct: number
  final_nominal: number
  final_real: number
  total_invested: number
  total_gain_nominal: number
}

export interface SimulationSummary {
  total_invested: number
  final_value_nominal: number
  final_value_real: number
  total_gain_nominal: number
  total_gain_real: number
  gain_pct: number
  monte_carlo_median: number
  monte_carlo_best_case: number
  monte_carlo_worst_case: number
}

export interface SimulationResult {
  params: SimulationParams
  projection: {
    nominal: ProjectionPoint[]
    real: ProjectionPoint[]
  }
  monte_carlo: MonteCarloResult
  scenarios: Record<string, ScenarioResult>
  summary: SimulationSummary
}

// ── Phase B1: Debts ───────────────────────────────────────

export interface Debt {
  id: string
  label: string
  debt_type: string
  creditor: string | null
  initial_amount: number    // centimes
  remaining_amount: number  // centimes
  interest_rate_pct: number
  insurance_rate_pct: number | null
  monthly_payment: number   // centimes
  start_date: string | null
  end_date: string | null
  duration_months: number
  early_repayment_fee_pct: number
  payment_type: string
  is_deductible: boolean
  linked_property_id: string | null
  progress_pct: number
  remaining_months: number
  total_cost: number        // centimes
  created_at: string
}

export interface DebtSummary {
  total_remaining: number
  total_monthly: number
  total_initial: number
  weighted_avg_rate: number
  debt_ratio_pct: number
  debts_count: number
  next_end_date: string | null
  debts: Debt[]
}

export interface AmortizationRow {
  payment_number: number
  date: string | null
  total: number
  principal: number
  interest: number
  insurance: number
  remaining: number
}

export interface AmortizationTable {
  rows: AmortizationRow[]
  total_interest: number
  total_insurance: number
  total_cost: number
  total_paid: number
  end_date: string | null
}

export interface EarlyRepaymentScenario {
  name: string
  new_monthly_payment: number
  new_duration_months: number
  new_end_date: string | null
  interest_saved: number
  penalty_amount: number
  net_savings: number
}

export interface EarlyRepaymentResult {
  current_remaining: number
  repayment_amount: number
  at_month: number
  reduced_duration: EarlyRepaymentScenario
  reduced_payment: EarlyRepaymentScenario
}

export interface InvestVsRepayResult {
  amount: number
  return_rate_pct: number
  horizon_months: number
  invest_gross_value: number
  invest_gross_gain: number
  invest_tax: number
  invest_net_gain: number
  repay_interest_saved: number
  repay_penalty: number
  repay_net_gain: number
  verdict: string
  advantage: number
}

export interface ConsolidationResult {
  total_remaining: number
  total_monthly: number
  weighted_avg_rate: number
  debt_ratio_pct: number
  debts_count: number
  last_end_month: number
  avalanche_order: string[]
  snowball_order: string[]
  months_saved_with_extra: number
}

export interface DebtChartDataPoint {
  month: number
  date: string | null
  principal: number
  interest: number
  insurance: number
  remaining: number
}

// ── Profiles & Joint Accounts ─────────────────────────────

export interface ProfileAccountLink {
  link_id: string
  account_id: string
  share_pct: number
}

export interface Profile {
  id: string
  name: string
  type: 'personal' | 'partner' | 'child' | 'other'
  avatar_color: string
  is_default: boolean
  accounts: ProfileAccountLink[]
  created_at: string | null
}

export interface JointAccount {
  account_id: string
  account_label: string
  account_number: string | null
  balance: number
  profiles: {
    profile_id: string
    profile_name: string
    avatar_color: string
    share_pct: number
  }[]
}

// ── Project Budgets (Savings Goals) ───────────────────────

export interface ProjectContribution {
  id: string
  amount: number        // centimes
  date: string
  note: string | null
  created_at: string | null
}

export interface ProjectBudget {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  target_amount: number   // centimes
  current_amount: number  // centimes
  deadline: string | null
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  monthly_target: number | null
  progress_pct: number
  is_archived: boolean
  contributions_count: number
  contributions?: ProjectContribution[]
  created_at: string | null
}

export interface ProjectProgress {
  project_id: string
  name: string
  target_amount: number
  current_amount: number
  remaining: number
  progress_pct: number
  monthly_target: number | null
  days_remaining: number | null
  estimated_completion: string | null
  monthly_contributions: Record<string, number>
  total_contributions: number
}

// ── Phase B5: Cross-Asset Cash-Flow Projection ────────────

export interface CashFlowSource {
  source_type: string
  label: string
  amount_monthly: number  // centimes
  details: Record<string, any>
}

export interface MonthlyProjection {
  month: string           // "YYYY-MM"
  date: string
  income: number          // centimes
  expenses: number        // centimes
  net: number             // centimes
  cumulative: number      // centimes
  income_breakdown: Record<string, number>
  expense_breakdown: Record<string, number>
  alerts: string[]
  suggestions: string[]
}

export interface AnnualSummary {
  total_income: number
  total_expenses: number
  total_net: number
  passive_income: number
  passive_income_ratio: number
  months_deficit: number
  largest_surplus: number
  largest_surplus_month: string | null
}

export interface DeficitAlert {
  month: string
  shortfall: number       // centimes
  main_cause: string
  recommendation: string
}

export interface SurplusSuggestion {
  month: string
  surplus: number         // centimes
  suggestion_type: string
  message: string
}

export interface HealthScoreComponent {
  score: number
  max: number
  label: string
  value?: number
  target?: number
}

export interface CashFlowHealthScore {
  score: number
  max_score: number
  components: Record<string, HealthScoreComponent>
  grade: string
}

export interface CrossAssetProjection {
  monthly_projection: MonthlyProjection[]
  annual_summary: AnnualSummary
  deficit_alerts: DeficitAlert[]
  surplus_suggestions: SurplusSuggestion[]
  health_score: CashFlowHealthScore
  income_sources: CashFlowSource[]
  expense_sources: CashFlowSource[]
}

export interface CashFlowSourcesResponse {
  income_sources: CashFlowSource[]
  expense_sources: CashFlowSource[]
  total_monthly_income: number
  total_monthly_expenses: number
  net_monthly: number
}

// ── OmniAlert — Unified cross-asset alerts ─────────────────

export type AlertAssetType = 'stock' | 'crypto' | 'realestate' | 'index'
export type AlertCondition = 'price_above' | 'price_below' | 'pct_change_24h_above' | 'pct_change_24h_below' | 'volume_spike'

export interface UserAlert {
  id: string
  name: string
  asset_type: AlertAssetType
  symbol: string
  condition: AlertCondition
  threshold: number
  is_active: boolean
  cooldown_minutes: number
  last_triggered_at: string | null
  notify_in_app: boolean
  notify_push: boolean
  notify_email: boolean
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface AlertCreateRequest {
  name: string
  asset_type: AlertAssetType
  symbol: string
  condition: AlertCondition
  threshold: number
  cooldown_minutes?: number
  notify_in_app?: boolean
  notify_push?: boolean
  notify_email?: boolean
}

export interface AlertUpdateRequest {
  name?: string
  threshold?: number
  is_active?: boolean
  cooldown_minutes?: number
  notify_in_app?: boolean
  notify_push?: boolean
  notify_email?: boolean
}

export interface AlertHistoryEntry {
  id: string
  alert_id: string
  alert_name: string
  symbol: string
  asset_type: AlertAssetType
  condition: AlertCondition
  threshold: number
  triggered_at: string
  price_at_trigger: number
  message: string
}

export interface AlertSuggestion {
  name: string
  asset_type: AlertAssetType
  symbol: string
  condition: AlertCondition
  threshold: number
  reason: string
}

export interface AlertSuggestionsResponse {
  suggestions: AlertSuggestion[]
}

// ── Phase C1: Retirement & FIRE ─────────────────────────────
export interface RetirementProfile {
  id: string
  user_id: string
  birth_year: number
  target_retirement_age: number
  current_monthly_income: number   // centimes
  current_monthly_expenses: number // centimes
  monthly_savings: number          // centimes
  pension_quarters_acquired: number
  pension_estimate_monthly: number | null
  target_lifestyle_pct: number
  inflation_rate_pct: number
  life_expectancy: number
  include_real_estate: boolean
  asset_returns: Record<string, { mean: number; std: number }>
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface RetirementProfileUpdate {
  birth_year?: number
  target_retirement_age?: number
  current_monthly_income?: number
  current_monthly_expenses?: number
  monthly_savings?: number
  pension_quarters_acquired?: number
  pension_estimate_monthly?: number | null
  target_lifestyle_pct?: number
  inflation_rate_pct?: number
  life_expectancy?: number
  include_real_estate?: boolean
}

export interface YearProjection {
  age: number
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  is_accumulation: boolean
  pension_income: number
  withdrawal: number
}

export interface SimulationResponse {
  median_fire_age: number | null
  fire_age_p10: number | null
  fire_age_p90: number | null
  success_rate_pct: number
  ruin_probability_pct: number
  patrimoine_at_retirement_p50: number
  serie_by_age: YearProjection[]
  fire_number: number
  fire_progress_pct: number
  coast_fire: number
  lean_fire: number
  fat_fire: number
  swr_recommended_pct: number
  monthly_withdrawal_recommended: number
  pension_estimate_used: number
  num_simulations: number
}

export interface OptimizationLever {
  lever_name: string
  description: string
  delta_monthly_savings: number
  new_fire_age: number | null
  years_gained: number
  new_success_rate: number
}

export interface OptimizationResponse {
  levers: OptimizationLever[]
  best_lever: string
  summary: string
}

export interface FireDashboard {
  fire_number: number
  fire_progress_pct: number
  coast_fire: number
  lean_fire: number
  fat_fire: number
  swr_pct: number
  monthly_withdrawal: number
  patrimoine_total: number
  passive_income_monthly: number
  current_age: number
  target_retirement_age: number
  years_to_retirement: number
}

export interface PatrimoineSnapshot {
  total: number
  stocks: number
  stocks_pct: number
  bonds: number
  bonds_pct: number
  real_estate: number
  real_estate_pct: number
  crypto: number
  crypto_pct: number
  savings: number
  savings_pct: number
  cash: number
  cash_pct: number
}

// ── Phase C2: Heritage / Succession ─────────────────────────
export interface Heir {
  name: string
  relationship: 'conjoint' | 'enfant' | 'petit_enfant' | 'frere_soeur' | 'neveu_niece' | 'tiers'
  age?: number | null
  handicap: boolean
}

export interface DonationRecord {
  heir_name: string
  amount: number  // centimes
  date: string    // YYYY-MM-DD
  type: 'donation_simple' | 'donation_partage' | 'don_manuel'
}

export interface HeritageProfile {
  id: string
  user_id: string
  marital_regime: string
  heirs: Heir[]
  life_insurance_before_70: number
  life_insurance_after_70: number
  donation_history: DonationRecord[]
  include_real_estate: boolean
  include_life_insurance: boolean
  custom_patrimoine_override: number | null
  created_at: string
  updated_at: string
}

export interface HeritageProfileUpdate {
  marital_regime?: string
  heirs?: Heir[]
  life_insurance_before_70?: number
  life_insurance_after_70?: number
  donation_history?: DonationRecord[]
  include_real_estate?: boolean
  include_life_insurance?: boolean
  custom_patrimoine_override?: number | null
}

export interface HeirResult {
  name: string
  relationship: string
  part_brute: number
  abattement: number
  taxable: number
  droits: number
  net_recu: number
  taux_effectif_pct: number
}

export interface SuccessionSimulation {
  patrimoine_brut: number
  patrimoine_taxable: number
  total_droits: number
  total_net_transmis: number
  taux_effectif_global_pct: number
  heirs_detail: HeirResult[]
  life_insurance_detail: Record<string, any> | null
  demembrement_detail: Record<string, any> | null
}

export interface DonationScenario {
  label: string
  donation_per_heir: number
  economy_vs_no_donation: number
  new_total_droits: number
  description: string
}

export interface DonationOptimization {
  scenarios: DonationScenario[]
  best_scenario: string
  economy_max: number
  summary: string
}

export interface TimelinePoint {
  year: number
  patrimoine_projete: number
  droits_si_succession: number
  net_transmis: number
  donation_abattement_available: boolean
}

export interface HeritageTimeline {
  points: TimelinePoint[]
  donation_renewal_years: number[]
}

// ── Phase C3: Fee Negotiator ─────────────────────────────────

export interface FeeBreakdownItem {
  fee_type: string
  label: string
  annual_total: number
  monthly_avg: number
  count: number
}

export interface MonthlyFeeDetail {
  month: string
  total: number
  details: FeeBreakdownItem[]
}

export interface BankAlternative {
  bank_slug: string
  bank_name: string
  is_online: boolean
  total_there: number
  saving: number
  pct_saving: number
}

export interface FeeScan {
  total_fees_annual: number
  fees_by_type: FeeBreakdownItem[]
  monthly_breakdown: MonthlyFeeDetail[]
  overcharge_score: number
  top_alternatives: BankAlternative[]
  best_alternative_slug: string | null
  best_alternative_saving: number
}

export interface NegotiationLetter {
  letter_markdown: string
  arguments: string[]
}

export interface FeeAnalysis {
  id: string
  user_id: string
  total_fees_annual: number
  fees_by_type: Record<string, number>
  monthly_breakdown: any[]
  best_alternative_slug: string | null
  best_alternative_saving: number
  top_alternatives: BankAlternative[]
  overcharge_score: number
  negotiation_status: string
  negotiation_letter: string | null
  negotiation_sent_at: string | null
  negotiation_result_amount: number
}

export interface BankFeeSchedule {
  bank_slug: string
  bank_name: string
  is_online: boolean
  fee_account_maintenance: number
  fee_card_classic: number
  fee_card_premium: number
  fee_card_international: number
  fee_overdraft_commission: number
  fee_transfer_sepa: number
  fee_transfer_intl: number
  fee_check: number
  fee_insurance_card: number
  fee_reject: number
  fee_atm_other_bank: number
}

// ── Phase C4: Fiscal Radar ───────────────────────────────────

export interface FiscalProfile {
  id: string
  user_id: string
  tax_household: string
  parts_fiscales: number
  tmi_rate: number
  revenu_fiscal_ref: number
  pea_open_date: string | null
  pea_total_deposits: number
  per_annual_deposits: number
  per_plafond: number
  av_open_date: string | null
  av_total_deposits: number
  total_revenus_fonciers: number
  total_charges_deductibles: number
  deficit_foncier_reportable: number
  crypto_pv_annuelle: number
  crypto_mv_annuelle: number
  dividendes_bruts_annuels: number
  pv_cto_annuelle: number
  fiscal_score: number
  total_economy_estimate: number
  analysis_data: Record<string, any>
  alerts_data: any[]
  export_data: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface FiscalAlertItem {
  alert_type: string
  priority: 'urgent' | 'high' | 'info'
  title: string
  message: string
  economy_estimate: number
  deadline: string | null
  domain: string
}

export interface FiscalAlertList {
  alerts: FiscalAlertItem[]
  count: number
  total_economy: number
}

export interface DomainAnalysis {
  domain: string
  label: string
  score: number
  status: 'optimal' | 'good' | 'improvable' | 'critical'
  details?: Record<string, any>
  recommendations?: string[]
}

export interface FiscalOptimizationItem {
  domain: string
  label: string
  current_value: number
  optimized_value: number
  economy: number
  recommendation: string
}

export interface FiscalAnalysis {
  fiscal_score: number
  domain_analyses: DomainAnalysis[]
  alerts: FiscalAlertItem[]
  optimizations: FiscalOptimizationItem[]
  total_economy_estimate: number
  analysis_date: string
}

export interface FiscalExportRevenusF {
  brut: number
  regime: string
  charges_deductibles: number
  revenu_net_foncier: number
  deficit_foncier: number
  cases_cerfa: Record<string, number>
}

export interface FiscalExportPVMob {
  pv_cto: number
  mv_cto: number
  pv_nette_cto: number
  dividendes_bruts: number
  option_retenue: string
  impot_estime: number
  cases_cerfa: Record<string, number>
}

export interface FiscalExportCrypto {
  pv_nette: number
  abattement_305: number
  base_imposable: number
  flat_tax_estime: number
  cases_cerfa: Record<string, number>
}

export interface FiscalExportPER {
  versements: number
  plafond_utilise: number
  economie_ir: number
  cases_cerfa: Record<string, number>
}

export interface FiscalExportSynthese {
  total_impot_estime: number
  economies_realisees: number
  score_fiscal: number
}

export interface FiscalExport {
  year: number
  revenus_fonciers: FiscalExportRevenusF
  plus_values_mobilieres: FiscalExportPVMob
  crypto_actifs: FiscalExportCrypto
  per_deductions: FiscalExportPER
  synthese: FiscalExportSynthese
}

export interface TMISimulation {
  current_tmi: number
  current_ir: number
  new_tmi: number
  new_ir: number
  marginal_tax: number
  marginal_rate_effective: number
  extra_income: number
  income_type: string
}

export interface FiscalScoreBreakdown {
  overall_score: number
  domain_scores: DomainAnalysis[]
  total_economy_estimate: number
  optimization_count: number
}

export interface FiscalScoreResponse {
  breakdown: FiscalScoreBreakdown
}

// ── Phase C5: Wealth Autopilot ─────────────────────────────────

export interface AllocationItem {
  priority: number
  type: string
  label: string
  target: number
  current: number
  pct: number
  account_type?: string | null
  project_id?: string | null
  deadline?: string | null
  asset_class?: string | null
  target_monthly: number
}

export interface SuggestionBreakdown {
  allocation_label: string
  allocation_type: string
  amount: number
  reason: string
}

export interface SavingsSuggestion {
  suggestion_id: string
  total_available: number
  suggested_amount: number
  breakdown: SuggestionBreakdown[]
  message: string
  status: 'suggested' | 'accepted' | 'executed' | 'skipped' | 'expired'
  created_at?: string
}

export interface AutopilotConfig {
  id: string
  user_id: string
  is_enabled: boolean
  safety_cushion_months: number
  min_savings_amount: number
  savings_step: number
  lookback_days: number
  forecast_days: number
  monthly_income: number
  income_day: number
  other_income: number
  allocations: AllocationItem[]
  last_available: number
  last_suggestion: Record<string, any>
  suggestions_history: Record<string, any>[]
  autopilot_score: number
  savings_rate_pct: number
  analysis_data: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface DCAItem {
  type: string
  label: string
  target_monthly: number
  actual_this_month: number
  remaining: number
  suggestion: string
  performance_12m: number | null
}

export interface ComputeResponse {
  suggestion: SavingsSuggestion
  dca_items: DCAItem[]
  checking_balance: number
  savings_balance: number
  monthly_expenses_avg: number
  safety_cushion_target: number
  safety_cushion_current: number
  safety_gap: number
  upcoming_debits: number
  savings_rate_pct: number
}

export interface ScenarioProjection {
  total_savings_6m: number
  total_savings_12m: number
  total_savings_24m: number
  safety_cushion_full_months: number | null
  projects_reached: Record<string, any>[]
  patrimoine_projected: number
}

export interface SimulateResponse {
  prudent: ScenarioProjection
  moderate: ScenarioProjection
  ambitious: ScenarioProjection
}

export interface AutopilotScoreBreakdown {
  overall_score: number
  savings_rate_score: number
  safety_cushion_score: number
  regularity_score: number
  diversification_score: number
  projects_score: number
}

export interface AutopilotScoreResponse {
  breakdown: AutopilotScoreBreakdown
}

export interface SuggestionHistoryItem {
  suggestion_id: string
  total_available: number
  suggested_amount: number
  status: string
  created_at: string
  breakdown: SuggestionBreakdown[]
}

export interface SuggestionHistoryResponse {
  history: SuggestionHistoryItem[]
  total_suggested: number
  total_accepted: number
  acceptance_rate: number
}

// ═══════════════════════════════════════════════════════════════
// Phase G — Digital Vault & Shadow Wealth
// ═══════════════════════════════════════════════════════════════

// ── Tangible Assets ──
export interface TangibleAsset {
  id: string
  user_id: string
  name: string
  category: 'vehicle' | 'tech' | 'collectible' | 'furniture' | 'jewelry' | 'other'
  subcategory?: string
  brand?: string
  model?: string
  serial_number?: string
  purchase_price: number
  purchase_date: string
  current_value: number
  depreciation_type: 'linear' | 'declining' | 'none' | 'market'
  depreciation_rate: number
  residual_pct: number
  condition: 'mint' | 'excellent' | 'good' | 'fair' | 'poor'
  warranty_expires?: string
  image_url?: string
  notes?: string
  extra_data: Record<string, any>
  depreciation_pct?: number
  warranty_status?: string
  created_at: string
  updated_at: string
}

export interface TangibleAssetCreate {
  name: string
  category: string
  subcategory?: string
  brand?: string
  model?: string
  serial_number?: string
  purchase_price: number
  purchase_date: string
  current_value?: number
  depreciation_type?: string
  depreciation_rate?: number
  residual_pct?: number
  condition?: string
  warranty_expires?: string
  image_url?: string
  notes?: string
  extra_data?: Record<string, any>
}

export interface TangibleAssetUpdate {
  name?: string
  current_value?: number
  condition?: string
  warranty_expires?: string
  notes?: string
  image_url?: string
  extra_data?: Record<string, any>
}

// ── NFT Assets ──
export interface NFTAsset {
  id: string
  user_id: string
  collection_name: string
  token_id: string
  blockchain: 'ethereum' | 'polygon' | 'solana' | 'other'
  contract_address?: string
  name: string
  image_url?: string
  purchase_price_eth?: number
  purchase_price_eur?: number
  current_floor_eur?: number
  marketplace?: string
  traits: Record<string, any>
  last_price_update?: string
  extra_data: Record<string, any>
  gain_loss_eur?: number
  gain_loss_pct?: number
  created_at: string
  updated_at: string
}

export interface NFTAssetCreate {
  collection_name: string
  token_id: string
  blockchain?: string
  contract_address?: string
  name: string
  image_url?: string
  purchase_price_eth?: number
  purchase_price_eur?: number
  current_floor_eur?: number
  marketplace?: string
  traits?: Record<string, any>
}

export interface NFTAssetUpdate {
  current_floor_eur?: number
  image_url?: string
  traits?: Record<string, any>
  extra_data?: Record<string, any>
}

// ── Card Wallet ──
export interface CardWallet {
  id: string
  user_id: string
  card_name: string
  bank_name: string
  card_type: 'visa' | 'mastercard' | 'amex' | 'cb' | 'other'
  card_tier: 'standard' | 'gold' | 'platinum' | 'premium' | 'infinite' | 'other'
  last_four: string
  expiry_month: number
  expiry_year: number
  is_active: boolean
  monthly_fee: number
  annual_fee: number
  cashback_pct: number
  insurance_level: 'none' | 'basic' | 'extended' | 'premium'
  benefits: Record<string, any>[]
  notes?: string
  is_expired?: boolean
  total_annual_cost?: number
  created_at: string
  updated_at: string
}

export interface CardWalletCreate {
  card_name: string
  bank_name: string
  card_type?: string
  card_tier?: string
  last_four: string
  expiry_month: number
  expiry_year: number
  monthly_fee?: number
  annual_fee?: number
  cashback_pct?: number
  insurance_level?: string
  benefits?: string[]
  notes?: string
}

export interface CardWalletUpdate {
  card_name?: string
  is_active?: boolean
  expiry_month?: number
  expiry_year?: number
  monthly_fee?: number
  annual_fee?: number
  cashback_pct?: number
  notes?: string
}

export interface CardRecommendation {
  recommended_card: CardWallet | null
  reason: string
  benefits_used: string[]
  potential_savings: number
}

// ── Loyalty Programs ──
export interface LoyaltyProgram {
  id: string
  user_id: string
  program_name: string
  provider: string
  program_type: 'airline' | 'hotel' | 'retail' | 'bank' | 'fuel' | 'other'
  points_balance: number
  points_unit: string
  eur_per_point: number
  estimated_value: number
  expiry_date?: string
  last_updated: string
  notes?: string
  extra_data: Record<string, any>
  days_until_expiry?: number | null
  created_at: string
  updated_at: string
}

export interface LoyaltyProgramCreate {
  program_name: string
  provider: string
  program_type?: string
  points_balance?: number
  points_unit?: string
  eur_per_point?: number
  expiry_date?: string
  notes?: string
}

// ── Financial Calendar ────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  event_type: string
  event_date: string
  amount?: number | null
  is_income: boolean
  recurrence: string
  recurrence_end_date?: string | null
  reminder_days_before: number
  is_acknowledged: boolean
  color?: string | null
  icon?: string | null
  linked_entity_type?: string | null
  linked_entity_id?: string | null
  extra_data: Record<string, any>
  is_active: boolean
  created_at: string
}

export interface CalendarEventCreate {
  title: string
  description?: string
  event_type?: string
  event_date: string
  amount?: number
  is_income?: boolean
  recurrence?: string
  recurrence_end_date?: string
  reminder_days_before?: number
  color?: string
  icon?: string
  linked_entity_type?: string
  linked_entity_id?: string
}

export interface CalendarEventUpdate {
  title?: string
  description?: string
  event_type?: string
  event_date?: string
  amount?: number
  is_income?: boolean
  recurrence?: string
  recurrence_end_date?: string
  reminder_days_before?: number
  color?: string
  icon?: string
  is_acknowledged?: boolean
  is_active?: boolean
}

export interface AggregatedCalendarEvent {
  id: string
  source: string
  title: string
  description?: string | null
  date: string
  amount?: number | null
  is_income: boolean
  category: string
  color?: string | null
  icon?: string | null
  linked_entity_type?: string | null
  linked_entity_id?: string | null
  extra: Record<string, any>
  is_essential: boolean
  urgency: 'normal' | 'warning' | 'critical'
}

export interface DaySummary {
  date: string
  total_income: number
  total_expenses: number
  net: number
  projected_balance: number
  is_green_day: boolean
  events: AggregatedCalendarEvent[]
  alert_level: 'ok' | 'warning' | 'danger'
}

export interface CashflowLifelinePoint {
  date: string
  projected_balance: number
  day_income: number
  day_expenses: number
  alert: boolean
}

export interface GreenDayStreak {
  current_streak: number
  best_streak: number
  total_green_days: number
  total_days_elapsed: number
  pct: number
}

export interface PaydayCountdown {
  next_payday: string | null
  days_remaining: number
  daily_budget: number
  remaining_budget: number
  payday_amount: number
}

export interface RentTrackerEntry {
  property_id: string
  property_name: string
  expected_date: string
  expected_amount: number
  received: boolean
  days_overdue: number
  status: 'pending' | 'received' | 'overdue'
}

export interface CalendarMonthResponse {
  month: string
  days: DaySummary[]
  lifeline: CashflowLifelinePoint[]
  green_streak: GreenDayStreak
  payday: PaydayCountdown
  rent_tracker: RentTrackerEntry[]
  total_income: number
  total_expenses: number
  net: number
  upcoming_alerts: AggregatedCalendarEvent[]
}

export interface LoyaltyProgramUpdate {
  points_balance?: number
  eur_per_point?: number
  expiry_date?: string
  notes?: string
}

// ── Subscriptions ──
export interface Subscription {
  id: string
  user_id: string
  name: string
  provider: string
  category: string
  amount: number
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  next_billing_date?: string
  contract_start_date?: string
  contract_end_date?: string
  cancellation_deadline?: string
  auto_renew: boolean
  cancellation_notice_days: number
  is_active: boolean
  notes?: string
  monthly_cost?: number
  annual_cost?: number
  days_until_renewal?: number | null
  cancellation_urgent?: boolean
  created_at: string
  updated_at: string
}

export interface SubscriptionCreate {
  name: string
  provider: string
  category?: string
  amount: number
  billing_cycle?: string
  next_billing_date?: string
  contract_start_date?: string
  contract_end_date?: string
  cancellation_deadline?: string
  auto_renew?: boolean
  cancellation_notice_days?: number
  notes?: string
}

export interface SubscriptionUpdate {
  name?: string
  amount?: number
  next_billing_date?: string
  cancellation_deadline?: string
  is_active?: boolean
  notes?: string
}

export interface SubscriptionAnalytics {
  total_monthly_cost: number
  total_annual_cost: number
  active_count: number
  essential_count: number
  non_essential_count: number
  category_breakdown: Record<string, number>
  optimization_score: number
  upcoming_renewals: Subscription[]
  cancellation_suggestions: Subscription[]
  potential_annual_savings: number
}

// ── Vault Documents ──
export interface VaultDocument {
  id: string
  user_id: string
  name: string
  category: 'identity' | 'diploma' | 'certificate' | 'insurance' | 'contract' | 'tax' | 'medical' | 'other'
  document_type?: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reminder_days: number
  file_url?: string
  notes?: string
  extra_data: Record<string, any>
  has_document_number?: boolean
  days_until_expiry?: number | null
  is_expired?: boolean
  expiry_status?: string
  created_at: string
  updated_at: string
}

export interface VaultDocumentCreate {
  name: string
  category?: string
  document_type?: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  document_number?: string
  reminder_days?: number
  file_url?: string
  notes?: string
}

export interface VaultDocumentUpdate {
  name?: string
  expiry_date?: string
  document_number?: string
  reminder_days?: number
  notes?: string
}

// ── Peer Debts ──
export interface PeerDebt {
  id: string
  user_id: string
  counterparty_name: string
  counterparty_email?: string
  counterparty_phone?: string
  direction: 'lent' | 'borrowed'
  amount: number
  currency: string
  description?: string
  date_created: string
  due_date?: string
  is_settled: boolean
  settled_date?: string
  settled_amount?: number
  reminder_enabled: boolean
  reminder_interval_days: number
  last_reminder_sent?: string
  notes?: string
  is_overdue?: boolean
  days_overdue?: number
  created_at: string
  updated_at: string
}

export interface PeerDebtCreate {
  counterparty_name: string
  counterparty_email?: string
  counterparty_phone?: string
  direction: 'lent' | 'borrowed'
  amount: number
  currency?: string
  description?: string
  due_date?: string
  reminder_enabled?: boolean
  reminder_interval_days?: number
  notes?: string
}

export interface PeerDebtUpdate {
  counterparty_name?: string
  amount?: number
  due_date?: string
  reminder_enabled?: boolean
  notes?: string
}

export interface PeerDebtSettle {
  settled_amount?: number
  settled_date?: string
}

export interface PeerDebtAnalytics {
  total_lent: number
  total_borrowed: number
  net_balance: number
  active_count: number
  settled_count: number
  overdue_count: number
  counterparty_balances: Array<{ name: string; net: number; count: number }>
  repayment_rate: number
}

// ── Vault Summary (Shadow Wealth) ──
export interface VaultSummary {
  tangible_assets_total: number
  tangible_assets_count: number
  tangible_depreciation_total: number
  nft_total: number
  nft_count: number
  nft_gain_loss: number
  loyalty_total: number
  loyalty_count: number
  subscription_monthly: number
  subscription_annual: number
  subscription_count: number
  documents_count: number
  documents_expiring_soon: number
  peer_debt_lent_total: number
  peer_debt_borrowed_total: number
  peer_debt_net: number
  cards_count: number
  cards_total_annual_fees: number
  shadow_wealth_total: number
  warranties_expiring_soon: number
  upcoming_cancellations: number
  upcoming_renewals: number
}

// ─── RGPD / Settings / Consent ───────────────────────────────────

export interface ConsentStatus {
  consent_analytics: boolean
  consent_push_notifications: boolean
  consent_ai_personalization: boolean
  consent_data_sharing: boolean
  consent_updated_at: string | null
  privacy_policy_version: string
}

export interface ConsentUpdateRequest {
  consent_analytics?: boolean
  consent_push_notifications?: boolean
  consent_ai_personalization?: boolean
  consent_data_sharing?: boolean
}

export interface AuditLogEntry {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface ExportMetadata {
  tables_exported: number
  total_records: number
  anonymized: boolean
}

export interface DataExportResponse {
  export_version: string
  exported_at: string
  user: Record<string, unknown>
  data: Record<string, unknown[]>
  metadata: ExportMetadata
}

export interface PrivacyPolicySection {
  title: string
  content: string
}

export interface PrivacyPolicyResponse {
  version: string
  last_updated: string
  language: string
  dpo_contact: string
  sections: PrivacyPolicySection[]
}

// ─── Feedback & Changelog ────────────────────────────────────────

export interface FeedbackRequest {
  category: 'bug' | 'feature' | 'improvement' | 'other'
  message: string
  metadata?: Record<string, unknown>
  screenshot_b64?: string
}

export interface FeedbackResponse {
  id: string
  message: string
}

export interface ChangelogEntry {
  type: 'feature' | 'fix' | 'security' | 'performance'
  title: string
  description: string
}

export interface ChangelogVersion {
  version: string
  date: string
  entries: ChangelogEntry[]
}

export interface ChangelogResponse {
  versions: ChangelogVersion[]
}

// ─── Password Change ─────────────────────────────────────────────

export interface PasswordChangeRequest {
  current_password: string
  new_password: string
}

export interface AccountDeletionRequest {
  confirmation: string
  password: string
}

export interface AccountDeletionResponse {
  deleted_records: number
  tables_affected: number
  message: string
}
