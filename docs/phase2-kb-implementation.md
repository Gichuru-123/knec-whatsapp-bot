# Phase 2 knowledge-base implementation checkpoint

> Current consolidated status: [Phase 2 handover](phase2-kb-handover.md). Dated checkpoints below retain the history of this work.


Date: 2026-11-03. Branch: `codex/kb-source-audit`. Status: implemented and locally tested; **not committed, published, institutionally approved or connected to WhatsApp answers**.

## Outcome

The repository now contains 16 draft article records and 10 machine-readable source records. Seven sources have inspected local evidence: six official PDFs and one public query page. The original seven article IDs and paths remain, with nine additional records. No public answer has been approved. Article count measures inventory, not completeness.

Strict JSON Schema validation and cross-record checks replace the old required-field checker. The backend uses the same validation before loading. A dedicated selector returns only approved, public, applicable, current content with citations. Existing development inspection endpoints can still show drafts when explicitly enabled; they are not public-answer APIs.

## Source retrieval and findings

Initial web-reader requests failed, and Node reported a certificate-chain validation error. Windows `Invoke-WebRequest` retrieved the originals with normal certificate verification; TLS checks were not disabled. Originals, extracted text and rendered images are stored outside Git in the sibling `.knec-public-sources` folder. The source catalog records URLs, file names, document dates where known and SHA-256 hashes. Upload-directory years were not treated as document dates.

| Evidence | Inspection | Finding |
| --- | --- | --- |
| 2026 English charter | All eight pages visually inspected | Service commitments, responsibilities and conflicts with older procedures |
| Certification guideline, 2024-05-31 | Both scanned pages visually inspected | Distinct from confirmation; old checklist cannot simply be carried forward |
| Confirmation guideline, 2024-05-31 | Both scanned pages visually inspected | Recipient restrictions and charging exceptions matter |
| Equation guideline, 2025-04-02 | Both scanned pages visually inspected | Eligibility, authentication and conditional evidence depend on qualification |
| QMIS manual | Six-page text read; category page visually checked | Copyright 2018: useful taxonomy, not verified current screens |
| Complaints procedure | One-page flowchart visually inspected | Frontline handling, investigation and escalation are distinct stages |
| Handling Queries page | Full HTML retrieved; table and relevant paragraphs read | Deadline and penalty wording differs from the charter |

Open conflicts include certification timing (15 working days in the guideline versus 10 in the charter), equation timing start events (payment versus complete documentation), confirmation dispatch terminology (fax versus email), and query windows/penalties. Neither an automatic newest-document rule nor an LLM should silently resolve these. A named reviewer must record the applicable rule. The charter also retains an editorial placeholder on its final page; it is a source-quality observation, not bot content.

## Migration and coverage

Existing IDs are preserved. The certification title is corrected and QMIS terminology corrected in confirmation content. Unsupported generic requirement lists and unsubstantiated fixed metadata dates were removed; previous text remains recoverable in Git history. Registration, generic FAQ and fraud-awareness records remain drafts with explicit evidence gaps. A generic KCSE prerequisite referring to KPSEA/KJSEA was not carried forward without examination-specific evidence.

Nine added records cover equation, biodata, photo, results queries, direct recovery, contracted-professional payment queries, complaints, information requests and QMIS navigation. Claims have source IDs, hashes, exact locators, kinds and evidence states. Some records contain orientation only; these are not complete procedures. Non-sensitive clarifying questions prepare for later menus. English content exists; the schema permits Kiswahili but no translation is claimed.

## Implementation map

| File | Responsibility |
| --- | --- |
| `knowledge-base/schema/article.schema.json` | Version 2 article contract, status, scope, claims and approvals |
| `knowledge-base/schema/sources.schema.json` | Source catalog contract |
| `knowledge-base/sources/catalog.json` | Ten source records, separate from article loading |
| `src/services/kbValidation.js` | Shared schema checks, valid dates, KNEC URL boundary, unique IDs, references, hashes and approval consistency |
| `src/repository/kbRepository.js` | Validates the complete corpus, freezes data and fails closed on reload error |
| `src/services/kbAnswerPolicy.js` | Public-answer eligibility and minimal cited projection |
| `src/services/kbService.js` | Adds internal `getApprovedAnswer(id, context)`; retains inspection methods |
| `scripts/validate-kb.js` | Accurate structural/reference check messaging |
| `scripts/kb-report.js` | Read-only editorial inventory |
| `tests/unit/kbGovernance.test.js` | Seven test groups for approval, scope, malformed content and reload failure |

Runtime dependency `ajv` is pinned to `8.20.0`. It already existed transitively; npm hoisted it for runtime use and moved ESLint's Ajv 6 beneath ESLint. Existing package versions were not intentionally upgraded. Installation used `--ignore-scripts` and reported zero advisories.

## Answer eligibility

The internal caller supplies examination, audience, year and language. Exact matches are required unless the reviewed scope explicitly includes `all`. Missing context returns null. Null means no eligible answer, not a nonexistent service.

An answer requires a valid approved article, verified status, public visibility, supported claims and no unresolved questions. Approval needs a named reviewer/role, approval date, effective start, review deadline and matching content hash. Future or expired article/source dates are blocked. Every claim requires inspected evidence with matching revision hash. Replacing or superseding evidence blocks its use.

The hash covers article wording, scope, citations, status and review date; changing them invalidates the approval. It is an accidental-change control, not a digital signature: Git permissions and human review remain essential. Validation cannot determine whether a claim is true.

Output contains identity, version, title, language and cited claims. It excludes draft descriptions and editorial notes. The selector is not yet called by a Phase 5 menu, LLM or WhatsApp handler. It adds no public endpoint, QMIS transaction or candidate-record lookup. The fixed Phase 4 diagnostic reply remains separate.

## Reviewer workflow

From the project folder:

```powershell
npm run validate-kb
npm run kb:report
```

Expected: 16 structurally valid articles, 10 sources, seven inspected sources and zero approved articles. Prioritize gaps rather than changing all statuses to approved.

Before approval, inspect originals and exceptions, resolve review questions, confirm scope/dates/claims, and assign an accountable reviewer. After setting verified/approved state and legitimate effective/review dates, calculate `contentHash(article)` from the validation module and put the result in `approval.content_sha256` with reviewer, role and approval date. Run validation and inspect the full diff. No automatic approval command is provided. An unknown official effective date needs an explicit reviewer applicability decision, not an invented publication date.

Refresh sources by downloading originals again and comparing hashes and content. Reconcile affected citations and renew approvals. A changed source hash intentionally invalidates old references. Startup does not fetch external sources. Keep originals accessible for reviewer reinspection and use their recorded hashes to identify the exact revision.

The full `npm run check` needs the existing disposable `TEST_DATABASE_URL` loaded privately as described in the database runbook. Never paste it into chat. Synthetic provider fixtures are used; no live messaging is needed.

## Verification and remaining work

The full local check passed lint, secret scan, schema/reference validation and **116 tests**, with zero failures/skips. Seven new groups cover stale approvals, source revisions, invalid dates/types/URLs, duplicate IDs, draft/internal/conflicted/expired/future content, wrong scope, missing context, citation projection, failed reload and the real corpus's zero-approved-answer state. Existing inspection count assertions changed from seven to sixteen; original behavior tests passed.

Before a verified release: obtain named editorial review, resolve conflicts, complete procedure/exception coverage, validate current portal behavior where necessary, review registration circulars/amendments, verify fraud guidance, expand evaluation questions and integrate the selector in Phase 5. Inspecting these originals does not prove there are no later amendments.

Further relevant batches include document collection, library/bookshop services, resource-centre facilities, training/consultancy, examiner recruitment and contracted-personnel enquiries. Keep supplier/procurement workflows separate from candidate-facing menus unless that audience is explicitly included. No institutional deployment, LLM upload, live send, commit or push occurred at this checkpoint.


## 3 November 2026: coverage and question-design follow-up

The working corpus now contains 16 draft articles and 13 source records, with 12 inspected to the extent documented in their notes. Registration records include scoped 2026 guidance and the 2026-2027 Business and Technical circular. None is approved for public answers.

The [coverage report](kb-coverage-report.md) lists gaps and conflicts. The [question-design guide](kb-question-design.md) explains 112 authored examples (64 development, 48 reserved), evidence labels, multilingual review and future evaluation. These examples are not measured model performance. General support includes the independently corroborated switchboard number 0719093000.

Validation for this checkpoint: npm run check passed (lint, secret scan of 115 selected files, corpus validation and 118 tests). The question inventory validation and report generation also passed. No live messages were sent; no commit or push was performed.

Follow-up review: added 12 sourced certification/confirmation claims and completed evidence labels for all 22 factual-answer examples. The question validator now rejects empty answer evidence and unresolved claim references. See [review decisions](kb-review-decisions.md) for policy conflicts and the inaccessible public QMIS manual. Articles remain drafts.


4 November 2026: completed registration annex inspection, added 23 registration/fee claims, and expanded the question bank to 116 cases (26 factual-answer cases). See the review-decisions document and regenerated coverage report for current gaps. All articles remain drafts.

4 November 2026: added three offline procedure plans for certification, confirmation and equation, with conditional steps, claim references and review gates. See [step-by-step guidance](kb-step-by-step-guidance.md). These plans are not loaded by the runtime; Phase 5 execution and procedural approval remain outstanding.


Latest checkpoint, 4 November 2026: 20 records, 13 sources, 124 question examples. Four assessment-specific records replace the combined record for future public guidance; the original remains internal-only. See kb-review-decisions.md and kb-coverage-report.md for remaining work.

Verification completed 4 November 2026 after assessment separation: npm run check passed, including lint, secret scanning, corpus validation and 121 tests with zero failures or skips. Initial failures were an unavailable local PostgreSQL instance and obsolete article/category count assertions; the existing instance was restarted and the expectations corrected before the successful rerun. No live messaging was performed. Changes remain local and uncommitted.


## 4 November 2026: TVET scope separation

Added ten programme fee records and three series registration records; retained reg-tvet as internal comparison. The corpus now contains 33 records (31 public drafts, two internal drafts), with 137 authored question examples (64 development, 73 reserved). Added optional programme/series scope and exact-context checks at the approved-answer boundary. See [TVET scope](kb-tvet-scope.md). All records remain unapproved; no live flow or calculator was activated.

TVET scope verification: npm run check passed on 4 November 2026, including lint, secret scanning, corpus validation and 123 tests with zero failures or skips. Procedure-reference validation and git diff --check also passed. Changes remain local and uncommitted.


4 November 2026 QMIS review: retrieved the September 2017 external manual and inspected the official procedure poster. Added three evidence-linked workflow claims and a fourth, review-gated biodata procedure plan. Corpus: 33 records, 15 sources; question bank: 137 examples. See [review package](kb-review-package.md) for journey walkthroughs, source limits and precise questions for KNEC.


Equation follow-up: extracted nine additional claims from the inspected 2025 guideline and updated the procedure plan and evidence expectations. Counts remain 33 records, 15 sources, 137 questions and four procedure plans. No content approval or public activation.
