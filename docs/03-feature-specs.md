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

## Implementation priority

```
P0 — Must ship for FCA compliance and core product:
  - ewa_core_transfer
  - ewa_self_controls
  - earnings_tracker
  - payslip
  - notifications (ewa_transfer_confirmed + limit warnings)

P1 — Ship in first major release:
  - savings_pots
  - budget_planner
  - bill_reminders
  - spending_tracker (open banking)

P2 — Ship to reach Stream feature parity:
  - benefits_checker
  - pension_finder
  - ai_money_coach
  - wellbeing_score
  - workplace_loans
  - discounts (catalogue)
  - financial_learning
```
