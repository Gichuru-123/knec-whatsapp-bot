# Phase 2 KB engineering handover

Final review checkpoint: 4 November 2026. Branch: `codex/kb-source-audit`.

## Delivered behavior

The KB contains 33 draft records, 15 catalogued sources (14 inspected to the extent recorded in their notes), 137 authored question examples and four offline procedure plans. Thirty-one records are public drafts; two broad comparison records are internal-only. No article has institutional content approval, and no KB answer is connected to live WhatsApp delivery.

Runtime loading validates the entire corpus before use. Invalid structure, unknown citations, source-hash mismatches and invalid approval records stop loading. The approved-answer selector requires public, approved, current content with matching language, examination, audience and year. Where specified, programme and examination series must also match. Approval hashes bind article content; they do not authenticate a reviewer's identity or replace organizational review controls.

Development inspection endpoints can expose draft/internal records only when explicitly enabled in development or test. They are forbidden in production. Future public callers must use the approved-answer boundary, not inspection methods.

## Content and procedure work

Official charter, procedure, registration and contact evidence is represented by claim-level source references and hashes. Original downloaded files remain outside Git; reviewers can retrieve originals using the catalog URLs, but changing remote bytes must be reviewed before updating stored hashes. Upload-path years are not treated as publication dates.

KPSEA, KJSEA, KILEA and KPLEA guidance is separated. Ten Business/Technical fee categories and three examination series have scoped records. The original multi-assessment and TVET records remain internal comparison material. Article counts include these splits and do not measure service completeness.

Four procedure plans describe certification, confirmation, equation and biodata orientation. They are editorial drafts with conditions and review gates, not executable menus. The 137 examples contain development and reserved sets; they are authored expectations, not measured LLM or classifier accuracy. Kiswahili and mixed-language wording needs fluent review.

## Audit findings and corrections

- Corrected an answer example that still targeted the internal TVET comparison; evaluation validation now rejects internal answer targets.
- Added coverage and procedure validation to the local check command and CI.
- Kept source conflicts explicit instead of treating all newer text as a universal replacement.
- Kept portal-screen claims historical where only 2017/2018 manuals were available; the public poster corroborates the broad submission sequence.
- Reviewed the AJV dependency change: version 8.20.0 becomes an explicit runtime dependency; the lockfile rearranges already locked versions rather than introducing a new package-version set.
- Preserved the unrelated local trailing-character edit in `phase2-knowledge-base-foundation.md`; it is excluded from this change set.

## Remaining release constraints

Certification timing and attachment count, equation timing start, query deadlines/penalties, confirmation dispatch/payment terminology, current QMIS screens and qualification-specific eligibility need authoritative review. Fraud-awareness content remains an explicitly incomplete draft. No assertion of full service coverage or production readiness is made.

Use [the review package](kb-review-package.md) for the nine questions prepared for KNEC. They have not been sent. Use [the coverage report](kb-coverage-report.md) for per-service gaps and [procedure design](kb-step-by-step-guidance.md) for the future conversation behavior.

## Verification and reproduction

Use Node 24 and the locked dependencies. Run `npm ci --ignore-scripts` in a clean checkout, then `npm run check` with the existing disposable PostgreSQL test connection supplied privately as `TEST_DATABASE_URL`. The command runs lint, secret scanning, corpus validation, evaluation/procedure validation and tests. CI provisions its own PostgreSQL 18.6 fixture. No live Twilio account is needed for these checks.

The secret scanner checks selected repository files; it is not a complete Git-history audit. Local success does not imply hosted CI has passed. The pull request records the final run result and hosted status separately.

## Phase 5 entry plan

Start with a reviewed design for menu routes, minimal session state, clarification, back/next/start-over behavior and escalation. Use synthetic content for conversation tests while public content remains unapproved. All factual replies must pass approval and scope checks; unavailable or conflicting evidence must yield clarification or support, not invention. Do not put reserved evaluation examples into retrieval or prompts.

Phase 5 implementation must define approval for procedural wording before loading these draft plans, and must avoid treating “next” as proof of a submission or payment. Live publication, institutional approval and PR merge are separate decisions from committing this engineering foundation.

Final local audit result: npm run check passed with 123 tests, zero failures and zero skips on 4 November 2026. Coverage and procedure validation passed, and git diff --check reported no whitespace errors. The branch base matched origin/main before publication. Hosted CI is reported separately on the pull request.
