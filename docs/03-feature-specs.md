# Fourth Pay — Product Brain
## Document 3: Feature Specifications (YAML)

**Version:** 1.0  
**Format:** Structured YAML specs — these are the source of truth for Claude Code implementation  
**Usage:** Each spec below maps exactly to one screen/module in the prototype and one NestJS module in the service

---

## How to use these specs

Each spec is in the format Claude Code expects. When given a spec and the codebase context from Document 2, Claude Code should:

1. Identify which files need to be created or modified
2. Implement the feature against the business_rules exactly
3. Write tests for every acceptance_criteria item
4. Emit the instrumentation events defined
5. Return for human review at any FCA-flagged step

---

```yaml
#═══════════════════════════════════════════════════════════════════
# SPEC 1: EWA BALANCE & TRANSFER (CORE)
#═══════════════════════════════════════════════════════════════════
feature: ewa_core_transfer
version: 1.0
module: src/modules/ewa
regulatory: [fca_consumer_duty, fca_ewa_code]
priority: P0

description: >
  The core earned wage access flow. Employee views their available balance,
  selects an amount and transfer speed, sees FCA disclosure with full fee 
  breakdown, confirms, and receives their money.

inputs:
  requested_amount:
    type: decimal
    min: 10.00
    max: derived_from_available_balance
    source: employee_input
  transfer_speed:
    type: enum
    values: [instant, standard]
    default: instant
  bank_account_id:
    type: uuid
    source: employee_account
  fca_disclosure_acknowledged:
    type: boolean
    required: true
    must_be: true

business_rules:
  - employee_must_be_eligible_per_hr_config
  - requested_amount_cannot_exceed_available_balance
  - requested_amount_cannot_exceed_monthly_self_control_limit
  - requested_amount_cannot_exceed_per_transfer_self_control_limit
  - if_cooling_off_active_and_no_override_block_transfer
  - if_account_paused_block_transfer
  - fee_is_195_for_instant_unless_employer_subsidises
  - fee_is_000_for_standard_always
  - net_amount_equals_requested_minus_fee
  - fca_disclosure_must_be_shown_before_confirmation
  - fca_disclosure_must_be_acknowledged_before_transfer_executes
  - deduction_record_must_be_written_to_payroll_queue_on_completion
  - if_in_payroll_lockdown_queue_deduction_do_not_block_transfer

acceptance_criteria:
  - employee_cannot_submit_transfer_without_fca_disclosure_acknowledged_true
  - transfer_with_amount_exceeding_available_balance_returns_EWA_INSUFFICIENT_BALANCE
  - transfer_with_cooling_off_active_returns_EWA_COOLING_OFF_ACTIVE
  - instant_transfer_fee_is_195_when_employer_subsidy_false
  - instant_transfer_fee_is_000_when_employer_subsidy_true
  - standard_transfer_fee_is_always_000
  - net_amount_shown_in_confirmation_equals_requested_minus_actual_fee
  - payroll_deduction_queue_record_created_on_transfer_completed
  - audit_log_records_fca_disclosure_shown_and_acknowledged

fca_flags:
  consumer_duty: [price_and_value, consumer_understanding]
  disclosure_required_before_confirmation: true
  disclosure_content: [fee_amount, net_amount, deduction_at_pay_run, available_remaining]
  audit_required: true

fourth_integration:
  wfm: read_confirmed_hours
  payroll: write_deduction_queue
  hr: read_eligibility_and_employer_config

instrumentation:
  - ewa.balance.viewed
  - ewa.transfer.initiated
  - ewa.transfer.completed
  - ewa.transfer.failed
  - ewa.fca.disclosure_shown
  - ewa.fca.disclosure_acknowledged

non_goals:
  - this_feature_does_not_send_push_notifications_on_completion
  - this_feature_does_not_handle_transfer_reversal
  - this_feature_does_not_validate_bank_account_details

human_gates:
  - payroll_deduction_boundary: engineer_must_review_deduction_queue_logic
  - fca_disclosure_content: pm_must_approve_disclosure_text


#═══════════════════════════════════════════════════════════════════
# SPEC 2: SELF-CONTROLS
#═══════════════════════════════════════════════════════════════════
feature: ewa_self_controls
version: 1.0
module: src/modules/self-controls
regulatory: [fca_consumer_duty, fca_ewa_code]
priority: P0

description: >
  Employee-owned controls that limit their own EWA access. Includes monthly
  cap, per-transfer limit, cooling-off period, auto-save on access, wellbeing
  nudges, and pause all access. These are EMPLOYEE controls — employers cannot
  see or override them.

inputs:
  monthly_limit_enabled: { type: boolean }
  monthly_limit_amount: { type: decimal, min: 50.00, max: derived_from_employer_max }
  per_transfer_limit_enabled: { type: boolean }
  per_transfer_limit_amount: { type: decimal, min: 10.00 }
  cooling_off_enabled: { type: boolean }
  cooling_off_hours: { type: enum, values: [24, 48, 168] }
  auto_save_enabled: { type: boolean }
  auto_save_percent: { type: integer, min: 5, max: 30, step: 5 }
  wellbeing_nudges_enabled: { type: boolean }
  pause_duration_days: { type: integer, values: [30], optional: true }

business_rules:
  - self_controls_are_employee_owned_employer_cannot_read_or_write
  - monthly_limit_cannot_exceed_employer_configured_maximum
  - cooling_off_period_applies_from_last_completed_transfer
  - cooling_off_override_requires_reason
  - cooling_off_override_reason_must_be_logged_to_audit
  - pause_sets_paused_until_to_now_plus_duration
  - all_self_control_changes_written_to_audit_log
  - auto_save_triggers_on_each_completed_transfer_if_enabled

acceptance_criteria:
  - employer_cannot_read_self_controls_endpoint
  - monthly_limit_above_employer_max_returns_validation_error
  - cooling_off_override_without_reason_returns_validation_error
  - cooling_off_override_with_reason_writes_audit_record_with_reason
  - pause_sets_correct_paused_until_timestamp
  - self_control_change_always_writes_to_audit_log
  - auto_save_transfer_fires_on_ewa_transfer_completed_if_enabled

fca_flags:
  consumer_duty: [consumer_support]
  prominence_required: true
  override_audit_required: true

instrumentation:
  - ewa.self_control.updated
  - ewa.self_control.override
  - ewa.account.paused


#═══════════════════════════════════════════════════════════════════
# SPEC 3: EARNINGS TRACKER
#═══════════════════════════════════════════════════════════════════
feature: earnings_tracker
version: 1.0
module: src/modules/ewa (balance sub-feature)
regulatory: [fca_consumer_duty]
priority: P0

description: >
  Real-time view of the employee's earnings for the current pay period.
  Shows shift-by-shift breakdown from WFM, period summary stats, and
  history of EWA accesses. Data comes from Fourth WFM — it reflects
  confirmed shifts only.

inputs:
  pay_period_start: { type: date, source: query_param, optional: true }

business_rules:
  - only_show_confirmed_shifts_not_scheduled_shifts
  - earnings_calculated_per_document_1_formula
  - show_gross_per_shift_not_net_per_shift
  - period_summary_shows_gross_earned_available_and_accessed
  - previous_period_history_available_for_last_3_periods

acceptance_criteria:
  - response_contains_only_confirmed_shifts
  - shift_earnings_match_hours_times_rate
  - period_summary_available_amount_matches_balance_endpoint
  - unconfirmed_scheduled_shifts_are_not_included
  - previous_period_accessible_via_query_param

fourth_integration:
  wfm: read_confirmed_shifts_and_rates
  payroll: read_pay_period_dates

instrumentation:
  - earnings.tracker.viewed


#═══════════════════════════════════════════════════════════════════
# SPEC 4: PAYSLIP
#═══════════════════════════════════════════════════════════════════
feature: payslip
version: 1.0
module: src/modules/payslip
regulatory: [employment_rights_act, fca_consumer_duty]
priority: P0

description: >
  Digital payslip showing full gross-to-net breakdown including EWA advances
  as a line item deduction. Includes YTD summary. PDF download available.
  Data sourced from Fourth Payroll.

inputs:
  pay_period_start: { type: date, source: path_param }

business_rules:
  - payslip_data_sourced_from_fourth_payroll_not_calculated_by_fourth_pay
  - ewa_advances_shown_as_explicit_deduction_line_item
  - ytd_figures_include_all_periods_since_tax_year_start
  - pdf_must_meet_employment_rights_act_requirements
  - employee_can_only_view_their_own_payslips

acceptance_criteria:
  - payslip_shows_ewa_deductions_as_separate_line_item
  - net_pay_equals_gross_minus_all_deductions_including_ewa
  - ytd_gross_sums_correctly_across_periods
  - pdf_endpoint_returns_valid_pdf_binary
  - accessing_another_employees_payslip_returns_403

fourth_integration:
  payroll: read_payslip_data_and_deduction_breakdown

instrumentation:
  - payslip.viewed
  - payslip.pdf.downloaded


#═══════════════════════════════════════════════════════════════════
# SPEC 5: SAVINGS POTS
#═══════════════════════════════════════════════════════════════════
feature: savings_pots
version: 1.0
module: src/modules/savings
regulatory: [fca_consumer_duty, fscs_disclosure]
priority: P1

description: >
  Employee savings pots with competitive interest rate (4.5% AER), FSCS 
  protection up to £85,000, auto-save from wages, and round-up saving 
  (rounds each shift pay down to nearest £1, saves the difference).

inputs:
  pot_name: { type: string, max_length: 128 }
  emoji: { type: string, optional: true }
  target_amount: { type: decimal, optional: true }
  auto_save_amount: { type: decimal, optional: true }
  auto_save_trigger: { type: enum, values: [per_pay_period, per_ewa_transfer] }
  round_up_enabled: { type: boolean }
  round_up_pot_id: { type: uuid, optional: true }

business_rules:
  - interest_accrued_daily_at_aer_rate
  - fscs_disclosure_shown_on_pot_creation
  - round_up_calculates_per_confirmed_shift_pay
  - auto_save_triggers_at_pay_period_end_or_per_transfer_based_on_config
  - withdrawal_available_any_time_same_day
  - maximum_pots_per_employee: 10

acceptance_criteria:
  - pot_creation_shows_fscs_disclosure_before_completing
  - interest_calculation_correct_for_daily_accrual
  - round_up_amount_equals_shift_pay_minus_floor_shift_pay
  - withdrawal_creates_transaction_record_and_reduces_balance
  - cannot_create_more_than_10_pots

fca_flags:
  fscs_disclosure_required: true
  interest_rate_must_be_current: true

instrumentation:
  - savings.pot.created
  - savings.pot.deposit
  - savings.pot.withdrawal
  - savings.roundup.enabled


#═══════════════════════════════════════════════════════════════════
# SPEC 6: BUDGET PLANNER
#═══════════════════════════════════════════════════════════════════
feature: budget_planner
version: 1.0
module: src/modules/spending (budget sub-feature)
regulatory: [fca_consumer_duty]
priority: P1

description: >
  Employee sets category-level spending budgets. Three methods: 50/30/20 
  (auto-calculates from income), zero-based (assign every pound a job), 
  or custom. Budget tracks against actual spending from open banking.
  Real-time alerts when approaching or exceeding category limits.

inputs:
  budget_method: { type: enum, values: ['503020', 'zerobased', 'custom'] }
  categories:
    - name: string
      budget_amount: decimal
      color: string (hex)

business_rules:
  - 503020_method_calculates_automatically_from_last_net_pay
  - 503020_needs: 50_percent_of_net
  - 503020_wants: 30_percent_of_net
  - 503020_savings: 20_percent_of_net
  - zerobased_total_must_equal_net_pay
  - category_spending_sourced_from_open_banking_transactions
  - alert_fires_at_80_percent_of_category_budget
  - alert_fires_at_100_percent_of_category_budget
  - budget_resets_at_pay_period_start

acceptance_criteria:
  - 503020_category_amounts_sum_to_net_pay
  - zerobased_with_categories_not_summing_to_net_returns_validation_error
  - category_spend_vs_budget_calculates_correctly
  - budget_reset_fires_at_pay_period_start
  - alert_notification_fires_at_80_and_100_percent

instrumentation:
  - budget.created
  - budget.category.exceeded
  - budget.method.changed


#═══════════════════════════════════════════════════════════════════
# SPEC 7: BILL REMINDERS
#═══════════════════════════════════════════════════════════════════
feature: bill_reminders
version: 1.0
module: src/modules/spending (bills sub-feature)
regulatory: [fca_consumer_duty]
priority: P1

description: >
  Employee adds regular bills (rent, utilities, phone, etc.) with due date
  and amount. Reminders sent 3 days before due date. Visual urgency 
  indicators in the spending screen. Bills due today shown in red.

inputs:
  bill_name: { type: string, max_length: 128 }
  amount: { type: decimal }
  due_day_of_month: { type: integer, min: 1, max: 31 }
  category: { type: string, optional: true }
  reminder_days_before: { type: integer, default: 3, min: 1, max: 7 }

business_rules:
  - reminder_notification_fires_reminder_days_before_due_date
  - bill_due_today_shown_with_urgent_visual_treatment
  - due_date_calculated_as_next_occurrence_of_due_day
  - if_due_day_does_not_exist_in_month_use_last_day_of_month

acceptance_criteria:
  - reminder_notification_created_at_correct_days_before_due
  - bill_with_due_day_31_in_february_uses_28th_or_29th
  - bill_due_today_status_is_urgent
  - bill_not_yet_due_shows_days_remaining

instrumentation:
  - bill.created
  - bill.reminder.sent
  - bill.due.today


#═══════════════════════════════════════════════════════════════════
# SPEC 8: NOTIFICATIONS
#═══════════════════════════════════════════════════════════════════
feature: notifications
version: 1.0
module: src/modules/notifications
regulatory: [fca_consumer_duty]
priority: P0

description: >
  In-app and push notification system. Seven notification categories:
  pay access, savings, payslips, wellbeing, pension, bills, and system.
  Employees can filter by category and mark as read. Unread count shown
  on bell icon in nav.

notification_types:
  - name: ewa_transfer_confirmed
    category: pay
    trigger: ewa.transfer.completed
    urgency: normal
    
  - name: ewa_monthly_limit_80_percent
    category: wellbeing
    trigger: monthly_usage_reaches_80_percent
    urgency: warning
    fca_required: true
    
  - name: payslip_ready
    category: payslip
    trigger: new_payslip_available
    urgency: normal
    
  - name: auto_save_completed
    category: savings
    trigger: savings.pot.deposit (auto_save source)
    urgency: normal
    
  - name: pension_found
    category: pension
    trigger: pension_finder.pot_found
    urgency: normal
    
  - name: bill_due_reminder
    category: bills
    trigger: bill_reminder.due
    urgency: warning
    
  - name: bill_due_today
    category: bills
    trigger: bill_due_today check (daily cron)
    urgency: urgent
    
  - name: wellbeing_score_change
    category: wellbeing
    trigger: weekly_score_calculation
    urgency: normal

acceptance_criteria:
  - unread_count_in_bell_icon_matches_actual_unread_count
  - category_filter_returns_only_matching_notifications
  - mark_all_read_sets_all_to_read_for_employee
  - fca_required_notifications_cannot_be_disabled
  - notification_links_to_correct_screen_on_tap

instrumentation:
  - notification.sent
  - notification.read
  - notification.tapped


#═══════════════════════════════════════════════════════════════════
# SPEC 9: BENEFITS CHECKER
#═══════════════════════════════════════════════════════════════════
feature: benefits_checker
version: 1.0
module: src/modules/benefits
regulatory: [fca_consumer_duty]
priority: P2

description: >
  Calculator that estimates government benefits the employee may be entitled
  to but not claiming. Uses employment status, income (from payroll), 
  household information (employee-provided), and postcode for local
  benefit availability.

inputs:
  employment_status: { type: enum, values: [employed, part_time, zero_hours] }
  household_type: { type: enum, values: [single, couple, family] }
  number_of_children: { type: integer, min: 0 }
  has_disability: { type: boolean }
  postcode: { type: string, optional: true }

business_rules:
  - income_sourced_from_payroll_not_manually_entered
  - benefit_estimates_are_indicative_not_guaranteed
  - disclaimer_shown_prominently_before_results
  - never_store_disability_status_or_household_data_longer_than_session
  - results_show_how_to_claim_not_just_eligibility

acceptance_criteria:
  - disclaimer_shown_before_results_every_time
  - disability_status_not_persisted_to_database
  - total_unclaimed_estimate_sums_correctly
  - each_benefit_shows_how_to_claim_link

fca_flags:
  consumer_duty: [consumer_support]
  disclaimer_required: true

instrumentation:
  - benefits.checker.completed
  - benefits.checker.benefit_identified


#═══════════════════════════════════════════════════════════════════
# SPEC 10: PENSION FINDER
#═══════════════════════════════════════════════════════════════════
feature: pension_finder
version: 1.0
module: src/modules/pension
regulatory: [fca_consumer_duty, pension_schemes_act]
priority: P2

description: >
  Finds lost or dormant pension pots from previous employers using the
  government pension tracing service. Shows consolidated view of all pots
  with current values, growth, and a retirement forecast. Offers pot
  consolidation into a Stream/Fourth personal pension.

inputs:
  national_insurance_number: { type: string, encrypted: true }
  date_of_birth: { type: date }
  previous_employer_names: { type: string[], optional: true }

business_rules:
  - ni_number_encrypted_at_rest_never_logged
  - pension_search_uses_government_tracing_service
  - consolidation_requires_explicit_consent
  - retirement_forecast_uses_4_percent_real_growth_assumption
  - forecast_shows_state_pension_estimate_separately
  - forecast_is_illustrative_not_advice_disclaimer_required

acceptance_criteria:
  - ni_number_not_present_in_any_log_output
  - consolidation_request_requires_explicit_consent_field_true
  - retirement_forecast_calculation_correct_for_given_inputs
  - disclaimer_shown_on_forecast_screen

fca_flags:
  consumer_duty: [consumer_support]
  not_financial_advice_disclaimer_required: true
  data_sensitivity: high

instrumentation:
  - pension.finder.initiated
  - pension.pot.found
  - pension.consolidation.requested


#═══════════════════════════════════════════════════════════════════
# SPEC 11: AI MONEY COACH
#═══════════════════════════════════════════════════════════════════
feature: ai_money_coach
version: 1.0
module: src/modules/coach
regulatory: [fca_consumer_duty]
priority: P2

description: >
  AI-powered financial coaching chat. The coach has access to the employee's
  anonymised financial profile (spending patterns, savings progress, EWA
  usage, payslip data) and provides personalised guidance. Uses Claude API
  (claude-sonnet-4-20250514). NOT financial advice — this is guidance and
  education only.

system_prompt_principles:
  - always_preface_with_not_financial_advice_when_discussing_products
  - reference_employees_actual_data_for_personalisation
  - never_recommend_specific_external_financial_products
  - always_signpost_to_human_support_for_complex_situations
  - never_store_conversation_history_beyond_current_session
  - never_include_account_numbers_or_sort_codes_in_context

data_provided_to_coach:
  - current_period_earnings_and_access_amount
  - monthly_spending_by_category (anonymised — no merchant names)
  - savings_pot_balances_and_progress
  - wellbeing_score_and_trend
  - ewa_access_frequency_last_3_periods

data_never_provided_to_coach:
  - bank_account_details
  - payslip_tax_codes
  - hr_data_beyond_employment_status
  - other_employees_data

acceptance_criteria:
  - coach_response_time_under_5_seconds
  - coach_never_claims_to_be_a_financial_advisor
  - conversation_history_not_persisted_after_session_ends
  - sensitive_data_fields_never_present_in_api_request_to_claude

fca_flags:
  not_financial_advice: true
  disclaimer_on_session_start: true

instrumentation:
  - coach.session.started
  - coach.message.sent
  - coach.session.ended


#═══════════════════════════════════════════════════════════════════
# SPEC 12: WELLBEING SCORE
#═══════════════════════════════════════════════════════════════════
feature: wellbeing_score
version: 1.0
module: src/modules/wellbeing
regulatory: [fca_consumer_duty]
priority: P2

description: >
  Composite financial wellbeing score (0–100) calculated weekly from five
  dimensions. Shown with trend (up/down vs last week) and personalised
  insights linked to specific actions.

score_dimensions:
  savings_buffer:
    weight: 25
    signal: emergency_fund_weeks_of_income
    max_score_at: 4_weeks
    
  ewa_dependency:
    weight: 25
    signal: ewa_accesses_per_period
    max_score_at: 0_accesses
    zero_score_at: 4_or_more_accesses
    
  budget_adherence:
    weight: 20
    signal: percent_categories_within_budget
    requires: budget_feature_active
    
  benefits_claimed:
    weight: 15
    signal: benefits_checker_completed
    
  learning_progress:
    weight: 15
    signal: learning_modules_completed

business_rules:
  - score_calculated_weekly_not_per_request
  - score_cached_and_served_from_cache
  - trend_compares_to_7_days_ago
  - insights_generated_for_dimensions_with_lowest_scores
  - insights_always_link_to_actionable_screen

acceptance_criteria:
  - score_is_between_0_and_100
  - score_sums_weighted_dimensions_correctly
  - trend_direction_matches_score_delta
  - insights_array_contains_at_least_one_item
  - each_insight_has_screen_link

instrumentation:
  - wellbeing.score.calculated
  - wellbeing.insight.tapped
```

---

#═══════════════════════════════════════════════════════════════════
# SPEC 13: BENEFITS CHECKER (employment-statutory) — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Supersedes Spec 9 for the v1.0 shipped scope. Spec 9 was scoped to
> means-tested state benefits (Working Tax Credit, Council Tax
> Support, etc.) — a household-data flow that's deferred. Spec 13 is
> the simpler employment-statutory checker that's actually wired:
> nothing the employee has to type, everything derived from data we
> already hold.

```yaml
feature: benefits_checker
version: 2.0
status: implemented
module: src/modules/benefits
endpoint: GET /api/v1/benefits
regulatory: [fca_consumer_duty]
priority: P2

description: >
  Calculates five statutory employment entitlements directly from
  the HR + Payroll data the API already has — no questionnaire,
  no household data collection.

inputs_used:
  - hr.employment_profile.date_of_birth         # for age + NMW bracket
  - hr.employment_profile.employment_start_date # for tenure-based gates
  - hr.employment_profile.is_fulltime           # for assumed weekly hours
  - hr.employment_profile.rate_of_pay           # for NMW, SSP, pension thresholds
  - payroll.deductions                          # current pension contribution

calculations:
  holiday:
    annual_days: 28 if is_fulltime else 16     # statutory 5.6 weeks pro-rated
    accrued_days: round(annual_days × tenure_days / 365), capped at annual
  statutory_sick_pay:
    weekly_earnings_estimate: rate × (37.5 if FT else 16) hours
    eligible: weekly_earnings >= £123 (LEL 2025/26)
  pension_auto_enrolment:
    age_eligible: age >= 22
    earnings_eligible: annual_earnings >= £10,000
    current_contribution: sum of deduction rows where elementName matches /pension/i
  nmw_compliance:
    bracket_rate: { 21+: £12.21, 18-20: £10.00, under_18_or_apprentice: £7.55 }
    compliant: rate_of_pay >= bracket_rate
  maternity_paternity:
    qualifying_weeks: 26
    eligible: tenure_days >= 182

business_rules:
  - never_collect_disability_status_or_household_data
  - thresholds_centralised_at_top_of_service_for_april_2026_update
  - non_compliant_nmw_surfaces_as_warning_with_back_pay_copy

acceptance_criteria:
  - jordan_persona_returns_all_five_entitlements_active
  - marcus_persona_flags_nmw_non_compliant_and_pension_below_threshold
  - response_never_includes_ni_number_or_dob_raw_string

fca_flags:
  consumer_duty: [consumer_support]
  disclaimer_required: false  # surfaces statutory entitlements, not advice

instrumentation:
  - benefits.viewed
```


#═══════════════════════════════════════════════════════════════════
# SPEC 14: DISCOUNTS & PERKS — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════

```yaml
feature: discounts
version: 1.0
status: implemented
module: src/modules/discounts
endpoint: GET /api/v1/discounts
priority: P2

description: >
  Curated catalogue of hospitality-relevant partner discounts plus
  an employer-specific perks slot. Static catalogue today; partner-
  management UI is a future iteration.

response_shape:
  categories:                              # 7 categories, 54 partners total
    - { name: 'Food & drink',  count: 12 } # Greggs, Costa, McDonald's, Subway, Nando's, Pizza Hut, KFC, Domino's, Wagamama, Pret, Caffe Nero, Starbucks
    - { name: 'Supermarkets',  count: 7 }  # Tesco, Sainsbury's, Lidl, Aldi, Morrisons, Co-op, Iceland
    - { name: 'Travel',        count: 8 }  # National Express, Trainline, Uber, Zipcar, Europcar, Booking.com, Premier Inn, Travelodge
    - { name: 'Fitness',       count: 5 }  # PureGym, The Gym Group, Hussle, Anytime Fitness, Nuffield Health
    - { name: 'Entertainment', count: 8 }  # Cineworld, Vue, Odeon, Spotify, Amazon Prime, Disney+, NOW TV, Sky Sports
    - { name: 'Retail',        count: 9 }  # Boots, Argos, ASOS, Next, Currys, Amazon, H&M, New Look, TK Maxx
    - { name: 'Wellbeing',     count: 5 }  # Headspace, Calm, Holland & Barrett, Specsavers, Vision Express
  employer_perks: from EmployerConfig.perks   # see hr.adapter.ts

partner_record:
  name: string
  description: string
  percentOff: number | null
  redemption: 'in-app' | 'code' | 'link'
  code: string (optional, present when redemption === 'code')
  accentBg / accentFg: brand colour for UI tile

employer_perks (Crown Pub Group):
  - { name: 'Staff meal allowance', value: '50%', description: '50% off any meal during your shift' }
  - { name: 'Crown Hotel staff rate', value: '£25/night', description: 'staff + 1 guest at any Crown Hotel' }
  - { name: 'Refer a friend', value: '£250', description: 'bonus for any colleague who joins and stays 90 days' }

business_rules:
  - partners_are_static_today_no_user_personalisation
  - employer_perks_read_from_employer_config_no_separate_table
  - voucher_codes_rendered_monospace_easy_to_copy

acceptance_criteria:
  - response_contains_seven_categories_with_54_partners_total
  - employer_perks_only_present_when_employer_config_has_them
  - voucher_codes_returned_for_redemption_eq_code

instrumentation:
  - discounts.viewed
```


#═══════════════════════════════════════════════════════════════════
# SPEC 15: PENSION FINDER (auto-enrolment + projection) — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Supersedes Spec 10 for the v1.0 shipped scope. The lost-pot
> tracing flow from Spec 10 is now a *nudge* (link to the GOV.UK
> tracing service) rather than an in-app search; full consolidation
> is deferred.

```yaml
feature: pension_finder
version: 2.0
status: implemented
module: src/modules/pension
endpoint: GET /api/v1/pension
regulatory: [fca_consumer_duty, pension_schemes_act]
priority: P2

description: >
  Current contribution + employer match + simple flat-rate projection
  to age 67, three "what if I increased my contribution" scenarios,
  and a tenure-based lost-pension nudge.

response_shape:
  current_contribution_percent: number       # employee %, derived from payslip pension deduction
  employer_contribution_percent: number      # from EmployerConfig.pensionEmployerContributionPercent
  total_monthly_contribution: number         # only counts employer match when status === 'enrolled'
  projected_pot: number                      # total_monthly × 12 × years_to_retirement
  auto_enrolment_status: enum [enrolled, eligible, opted_out, below_threshold]
  increase_scenarios: [{ +1%, +2%, +3% } each with newEmployeePercent, extraMonthlyCost, projectedPot, potUplift]
  lost_pension_nudge: boolean                # true if tenure_days > 730
  government_tracing_url: 'https://www.gov.uk/find-pension-contact-details'

business_rules:
  - projection_is_flat_rate_no_growth_no_inflation_no_salary_escalation
  - employer_match_only_in_current_total_when_employee_actually_enrolled
  - scenarios_assume_enrolment_so_include_employer_match_in_projection
  - ni_number_never_appears_in_response
  - thresholds_match_benefits_checker_so_status_lines_up
  - retirement_age_67_default_30_years_if_dob_unknown

acceptance_criteria:
  - jordan_persona_returns_3_percent_employee_3_percent_employer_status_enrolled
  - marcus_persona_returns_0_employee_status_below_threshold_total_eq_0
  - increase_scenarios_array_length_is_3
  - lost_pension_nudge_threshold_is_strictly_greater_than_2_years

fca_flags:
  consumer_duty: [consumer_support]
  not_financial_advice_disclaimer_required: true

instrumentation:
  - pension.viewed (with auto_enrolment_status property)
```


#═══════════════════════════════════════════════════════════════════
# SPEC 16: BUDGET PLANNER v2 — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Updates Spec 6. v1 imagined Open-Banking spend tracking; v2 ships
> the 50/30/20 split with EWA-accessed counting as Needs spend.
> Full discretionary tracking still needs Open Banking — deferred.

```yaml
feature: budget_planner
version: 2.0
status: implemented
module: src/modules/budget
endpoint: GET /api/v1/budget
priority: P1

description: >
  Classic 50/30/20 envelope split derived from the current pay
  period's gross earnings. EWA accessed counts as drawing from the
  Needs envelope; Wants and Savings have allocation but no "used"
  tracking until Open Banking lands.

response_shape:
  pay_period_start: string (ISO)
  pay_period_end: string (ISO)
  monthly_earnings: number
  needs: { allocated, used, remaining }   # allocated = 50% × earnings, used = ewa_accessed
  wants: { allocated, used, remaining }   # allocated = 30%, used = 0 today
  savings: { allocated, used, remaining } # allocated = 20%, used = 0 today

business_rules:
  - allocation_fractions_centralised_constants_easy_to_swap
  - ewa_accessed_counted_as_needs_spend_not_wants
  - wants_and_savings_used_stay_zero_until_open_banking_integration

acceptance_criteria:
  - jordan_persona_returns_312_50_needs_allocated_160_used
  - allocation_fractions_sum_to_exactly_100_percent

instrumentation:
  - budget.viewed
```


#═══════════════════════════════════════════════════════════════════
# SPEC 17: SAVINGS POTS v2 — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Updates Spec 5 with the actual shipped surface: per-pot CRUD, an
> is_default pot that auto-save credits, and the auto-save sink
> wired into TransferService.

```yaml
feature: savings_pots
version: 2.0
status: implemented
module: src/modules/savings
endpoints:
  - GET  /api/v1/savings/pots                       # list
  - POST /api/v1/savings/pots                       # create
  - POST /api/v1/savings/pots/:id/contribute        # manual deposit
priority: P1

description: >
  Named savings pots with optional targets. Each employee can have
  many pots; exactly one is is_default and receives the auto-save
  side-effect of every successful EWA transfer. Each pot displays a
  headline 4.5% AER and a projected annual interest amount — these
  are display figures only; no interest is paid until pots are wired
  to the cash-ISA partner.

storage: savings_pots table (migration 20260528000005)

response_extras:                     # per-pot, computed on read
  aerRate: 4.5                       # AER_RATE * 100
  dailyInterestAccrued: balance * 0.045 / 365   # 2dp
  projectedAnnualInterest: balance * 0.045      # 2dp

business_rules:
  - exactly_one_default_pot_per_employee_enforced_by_partial_unique_index
  - auto_save_credits_default_pot_only_when_self_controls_auto_save_enabled
  - cross_employee_pot_lookups_return_404_not_403_no_existence_leak
  - balance_check_constraint_prevents_negative
  - aer_rate_is_display_only_until_cash_isa_partner_live
  - ui_must_disclose_interest_paid_when_connected_to_banking_infrastructure

acceptance_criteria:
  - jordan_persona_starts_with_emergency_fund_45_of_500_default
  - marcus_persona_starts_with_no_pots
  - first_pot_for_an_employee_is_automatically_is_default
  - auto_save_writes_to_default_pot_after_successful_transfer
  - every_pot_in_response_carries_aer_rate_and_projected_interest_fields

instrumentation:
  - savings.pot.viewed (with pot_count property)
  - savings.interest.viewed (with total_pot_balance, projected_annual_interest)
```


#═══════════════════════════════════════════════════════════════════
# SPEC 18: WELLBEING SCORE v2 — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Updates Spec 12 with the actual shipped component weights and
> sub-score formulas. Insights array removed — the per-component
> `detail` string drives the UI directly.

```yaml
feature: wellbeing_score
version: 2.0
status: implemented
module: src/modules/wellbeing
endpoint: GET /api/v1/wellbeing/score
priority: P2

description: >
  Single 0–100 score with four weighted components and a band
  label. Every input is live: savings pot vs target, monthly limit
  usage, transfer frequency this period, cooling-off enabled.

formula:
  weights: { savings: 0.30, monthly_limit: 0.25, transfer_frequency: 0.25, cooling_off: 0.20 }
  savings_sub_score:
    no_pot: 0
    pot_exists: 75 + 25 × min(1, balance / target)
  monthly_limit_sub_score:
    not_enabled: 30
    enabled: 60 + 40 × (1 - accessed / cap)
  transfer_frequency_sub_score:
    zero_transfers: 100
    n_transfers: max(30, 95 - 8 × n)
  cooling_off_sub_score:
    on: 100
    off: 50
  total_score: round(sum of weight × sub_score)
  band:
    thriving: score >= 80
    steady:   score >= 60
    building: score < 60

response_shape:
  score: number
  band: enum
  components: { savings, monthlyLimit, transferFrequency, coolingOff }
    each: { weight, score, contribution, detail }

business_rules:
  - score_data_driven_no_persona_hardcoded_outputs
  - jordans_seeded_state_must_land_at_68_for_demo_continuity

acceptance_criteria:
  - jordan_persona_score_eq_68_band_steady
  - marcus_persona_score_eq_54_band_building
  - component_contributions_sum_to_overall_score_within_rounding

instrumentation:
  - wellbeing.score.viewed (with score + band properties)
```


#═══════════════════════════════════════════════════════════════════
# SPEC 19: FINANCIAL LEARNING — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════

```yaml
feature: financial_learning
version: 1.0
status: implemented
module: src/modules/learning
endpoints:
  - GET /api/v1/learning              # list, grouped by category
  - GET /api/v1/learning/:id          # single article (fires article.viewed)
priority: P2

description: >
  Hand-written financial guidance for UK hospitality workers.
  15 articles across 5 categories (budgeting, saving, debt,
  pensions, benefits) — 3 per category. Content is static today;
  a CMS-backed version is a future iteration. Every article cites
  UK-current figures (NMW, SSP, auto-enrolment thresholds) — when
  these change each April, search the file for £ amounts.

response_shape:
  list:
    categories:
      - { category: 'budgeting', label, emoji, articles: [Article × 3] }
      - { category: 'saving',    ... }
      - { category: 'debt',      ... }
      - { category: 'pensions',  ... }
      - { category: 'benefits',  ... }
  article:
    id: kebab-case slug
    title: string
    summary: string (2 sentences)
    readTimeMinutes: number
    category: enum (5 values above)
    content: string[] (3-4 paragraphs)

business_rules:
  - article_content_must_be_uk_specific_not_generic_us_personal_finance
  - figures_cite_current_uk_rates_and_statutory_thresholds
  - no_promotion_of_third_party_credit_or_bnpl_products
  - bnpl_article_is_explicitly_cautionary_per_fca_consumer_duty
  - pension_tracing_article_warns_against_paid_tracing_services

acceptance_criteria:
  - list_returns_five_categories_with_three_articles_each
  - get_by_id_returns_full_content_array
  - get_by_unknown_id_returns_404
  - missing_headers_returns_400

fca_flags:
  consumer_duty: [consumer_understanding, consumer_support]
  disclaimer_required: false  # educational content, not advice
  notes: >
    Articles are guidance, not regulated financial advice. They
    must not recommend specific products. The 'good vs bad debt'
    article uses APR thresholds, not product names. The pension
    articles signpost gov.uk and the Pension Tracing Service, not
    consolidation providers.

instrumentation:
  - learning.list.viewed (with category_count, article_count)
  - learning.article.viewed (with article_id, category)
```


#═══════════════════════════════════════════════════════════════════
# SPEC 20: SPENDING TRACKER (simulated) — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Spec 16's spending_tracker line said "Open Banking — UI-only";
> this spec replaces that with a simulated tracker that uses real
> data we already own (EWA accessed amount + savings pot balance)
> blended with realistic UK hospitality spending percentages.
> Open Banking integration is still future work — this surface
> ships with a "Connect your bank" CTA that's intentionally
> non-functional until the partner is live.

```yaml
feature: spending_tracker
version: 1.0
status: implemented
module: src/modules/spending
endpoint: GET /api/v1/spending
priority: P1

description: >
  Simulated spending breakdown for UK hospitality workers. The
  tracker estimates monthly outgoings from net pay using typical
  category percentages, then blends in the real EWA accessed
  amount and savings pot balance. Returns a categorical breakdown
  for the chart plus per-persona seeded transactions.

inputs_from_other_modules:
  - BalanceService.getBalance → earnedAmount (gross), accessedAmount
  - PayrollAdapter.getPayPeriodConfig → averageDeductionRate (for net pay)
  - SavingsService.listPots → pot balances (per-period contributions proxy)

response_shape:
  total_income: number      # gross earned this period
  total_spent: number       # max(70% of net pay, sum of categories)
  remaining: number         # total_income - total_spent
  categories:               # 8 entries, in this order
    - { name: 'Housing',        amount, color }   # 35% of net pay
    - { name: 'Food and drink', amount, color }   # 15% of net pay
    - { name: 'Transport',      amount, color }   # 10% of net pay
    - { name: 'Entertainment',  amount, color }   #  8% of net pay
    - { name: 'Shopping',       amount, color }   #  7% of net pay
    - { name: 'EWA accessed',   amount, color }   # real, from BalanceService
    - { name: 'Savings',        amount, color }   # real, sum of pot balances
    - { name: 'Other',          amount, color }   # max(0, 70%·net - others)
  transactions:             # 8 seeded entries, per persona
    - { id, merchant, amount, category, daysAgo }
  estimated_disclaimer: string  # always present, surfaces in UI

business_rules:
  - hard_categories_use_net_pay_percentages_not_gross
  - ewa_and_savings_are_real_data_not_estimates
  - total_spent_floors_at_sum_of_categories_to_keep_bar_chart_balanced
  - other_clamped_to_zero_when_category_sum_exceeds_70pc_net_pay
  - disclaimer_always_present_in_response_and_visible_in_ui
  - jordan_seed_uses_uk_high_street_brands_typical_of_28yo_FT_bar_supervisor
  - marcus_seed_amounts_are_proportionally_smaller_he_is_PT_at_lower_rate

acceptance_criteria:
  - response_contains_eight_categories_in_documented_order
  - jordan_first_transaction_is_tesco_at_£34.50_three_days_ago
  - marcus_first_transaction_is_lidl_at_£22.40
  - estimated_disclaimer_text_present_for_every_persona
  - remaining_equals_total_income_minus_total_spent

fca_flags:
  consumer_duty: [consumer_understanding]
  disclaimer_required: true
  notes: >
    Spending figures are *estimates* derived from typical patterns,
    not real bank transactions. The estimated_disclaimer copy is
    rendered verbatim in the UI per Consumer Duty consumer-
    understanding rules.

instrumentation:
  - spending.viewed (with category_count, has_open_banking: false)
```


#═══════════════════════════════════════════════════════════════════
# SPEC 21: EMPLOYER-CONFIGURABLE ACCESS CAP — IMPLEMENTED
#═══════════════════════════════════════════════════════════════════
> Replaces the hard-coded FCA_MAX_ACCESS_FRACTION = 0.5 constant
> in BalanceService + TransferService with an employer_config
> field readable via GET /api/v1/employer/config and writable via
> PATCH. CLAUDE.md rule 1 historically pinned the 50% multiplier
> as part of the earnings formula — but the formula stays the
> same shape, only the multiplier is now a per-employer field
> with a defended default of 50.

```yaml
feature: employer_access_cap
version: 1.0
status: implemented
module: src/modules/employer + src/integrations/hr/{adapter,mock}
endpoints:
  - GET   /api/v1/employer/config
  - PATCH /api/v1/employer/config
priority: P1

description: >
  Adds an accessCapPercent field to employer_config with a default
  of 50 and a constrained range of {50, 60, 70}. BalanceService
  and TransferService both use this field (employerConfig.accessCapPercent)
  as the binding cap for the access calculation. The dashboard
  surfaces it as three selectable pills; PATCH validates the
  value is in the allow-list before writing.

request_shape:
  patch:
    body: { access_cap_percent: 50 | 60 | 70 }  # IsIn class-validator
  response: { employer_id, access_cap_percent }

formula_change:
  before: estimatedNetEarned * 0.5 - previouslyAccessed
  after:  estimatedNetEarned * (employerConfig.accessCapPercent / 100) - previouslyAccessed
  applied_in:
    - BalanceService.getBalance (TRANSFER_AMOUNT_MAX)
    - TransferService.executeTransfer (availableAmount validation)
  note: >
    The formerly-separate maxAccessPercent ratchet term has been
    folded out of the access formula because the two fields were
    in practice always equal; maxAccessPercent stays on the type
    because self-controls still reads it as a £-multiplier for
    monthly-limit ceilings.

business_rules:
  - access_cap_default_is_50_percent_fca_baseline
  - access_cap_must_be_in_allowed_values_50_60_70
  - raising_above_50_requires_active_fca_permission_letter
  - patch_is_idempotent_repeated_calls_emit_event_each_time

acceptance_criteria:
  - get_returns_50_by_default_for_crown_pub_group
  - patch_with_60_changes_jordans_available_from_90_to_140
  - patch_with_70_changes_jordans_available_from_90_to_190
  - patch_with_55_returns_400_class_validator_rejects
  - missing_employer_header_returns_400

fca_flags:
  consumer_duty: [consumer_understanding, consumer_protection]
  disclaimer_required: true
  notes: >
    UI surfaces the line "The FCA EWA Code of Practice recommends
    50% as the standard ceiling — caps above 50% require an active
    FCA permission letter for your organisation." Production must
    add an audit_log entry per CLAUDE.md rule 6 — the in-memory
    mock writer mutates the config object without persistence.

instrumentation:
  - employer.config.updated (with access_cap_percent property)
```

---

## Implementation priority

```
P0 — FCA compliance + core product (IMPLEMENTED):
  ✓ ewa_core_transfer            (Spec 1)
  ✓ ewa_self_controls            (Spec 2)
  ✓ earnings_tracker             (Spec 3)
  ✓ payslip                      (Spec 4)
  ✓ notifications                (Spec 8)

P1 — First major release:
  ✓ savings_pots                 (Spec 17 — supersedes Spec 5)
  ✓ budget_planner               (Spec 16 — supersedes Spec 6)
  ✓ shifts                       (week + upcoming + recent — new)
  ✓ spending_tracker             (Spec 20 — simulated, awaiting Open Banking)
  ⌛ bill_reminders               (Spec 7 — not started)

P2 — Stream feature parity:
  ✓ benefits_checker             (Spec 13 — supersedes Spec 9; employment-statutory only)
  ✓ pension_finder               (Spec 15 — supersedes Spec 10; lost-pot is a nudge today)
  ✓ ai_money_coach               (Spec 11 — keyword-routed, Anthropic SDK ready)
  ✓ wellbeing_score              (Spec 18 — supersedes Spec 12)
  ✓ discounts                    (Spec 14 — new)
  ✓ financial_learning           (Spec 19 — new)
  ⌛ workplace_loans              (UI-only)

Cross-cutting infrastructure (IMPLEMENTED):
  ✓ employer_dashboard           (anonymised aggregate stats + access cap settings)
  ✓ employer_access_cap          (50/60/70 dashboard knob — see SPEC 21 below)
  ✓ demo_reset                   (POST /api/v1/demo/reset, gated off in Pg mode)
  ✓ iq360_instrumentation        (25 event types across the service)
  ✓ persona_switcher             (Jordan + Marcus, localStorage-backed)
  ✓ pg_backed_stores             (DatabaseModule.forRoot, NODE_ENV + DATABASE_URL gate)
```
