# Draft service cards for review

**Follow-up:** full primary sources have since been retrieved and structured drafts implemented. These six early design cards are historical planning examples; consult [the implementation report](phase2-kb-implementation.md) and current article JSON for revised evidence and remaining conflicts.

Date: 2026-11-03. All six cards are **draft, not approved for public answers**. Source IDs refer to the [source register](kb-public-source-register.md). These are routing examples and an evidence backlog, not completed procedural checklists. No deadlines, tariffs or document lists are asserted from unread originals.

## qmis.certification-letter

- User task: obtain guidance after losing an examination certificate.
- Example phrases: “I lost my certificate”; “replace my certificate”. These are user vocabulary, not a promise that a replacement original is issued.
- Draft orientation: official public QMIS material identifies a certification-letter service for lost certificates (S01/S03).
- Disambiguation: was it lost after receipt, never received, or requested for confirmation by an organisation?
- Must verify: eligible exams/years; current required and conditional documents; applicant/representative rules; tariff; payment sequence; collection/delivery; processing commitment.
- Boundary: no promise to issue a replacement original or certification letter; no candidate-document collection in WhatsApp.
- Related services: direct recovery; confirmation; e-certificate eligibility review.

## qmis.confirmation

- User task: understand confirmation of results for a receiving institution.
- Example phrases: “my employer wants verification”; “university needs confirmation”.
- Draft orientation: confirmation is separately identified from certification in official guidance (S03/S06/S08).
- Disambiguation: is the goal confirmation to an organisation or help after losing a document?
- Must verify: applicant eligibility, receiving destination, consent/authorization, attachments, domestic/overseas distinctions, dispatch and fees.
- Boundary: cannot confirm a person's grades, authenticity or completed delivery from public KB content.

## qmis.biodata-amendment

- User task: find the applicable correction process for personal details on an examination record.
- Example phrases: “my name is misspelt”; “wrong gender”; “wrong photo”.
- Draft orientation: QMIS public material lists biodata amendments; query guidance distinguishes incorrectly captured names (S02/S04).
- Disambiguation: which field, which examination/year, and is the issue incorrect capture or a later requested change? Ask for the type of error, not the actual ID or full name.
- Must verify: correction versus legal change of name; timing; institutional submission routes; supporting documents; applicable charges and restrictions.
- Boundary: do not say every change is permitted or substitute a legal-name-change process for an examination correction.

## qmis.results-query

- User task: identify the route for a result discrepancy.
- Example phrases: “shown absent”; “missing mark”; “results pending”.
- Draft orientation: official query material identifies result-related queries (S02/S04).
- Disambiguation: which category of discrepancy and examination/year? Do not ask for grades or index numbers just to explain the route.
- Must verify: who submits; subject/entry distinctions; query windows; appeal versus correction; documents and current service commitments.
- Boundary: no promise of changed results; no interpretation of an individual record.

## qmis.equation

- User task: determine where to seek guidance on a foreign qualification.
- Example phrases: “equate foreign certificate”; “is my qualification equivalent?”
- Draft orientation: KNEC publishes an equation service and an April 2025 guideline (S01/S07).
- Disambiguation: qualification type, awarding body/country and intended purpose; do not infer individual equivalence.
- Must verify: scope/exclusions, complete supporting evidence, authentication, translation, fees and any later amendments; distinguish KNEC from another agency's qualification-recognition service.
- Boundary: no automatic grade conversion or claim that every foreign qualification is eligible.

## qmis.navigation

- User task: find the official application route and general status guidance.
- Example phrases: “how do I apply?”; “where is my application?”; “forgot password”.
- Draft orientation: official material points to QMIS for these service requests (S01/S02). Current screen-by-screen steps remain unverified because direct portal access failed (S20).
- Disambiguation: help finding a service, account navigation, or status of an existing request?
- Must verify: current manual, registration/recovery flow, status labels, payment sequence and escalation route.
- Boundary: explain navigation only; cannot retrieve personal status without a separately approved integration. Never request password, OTP or private payment credentials in chat. The old generic journey is not a verified current UI walkthrough.

## Starter evaluation cases

| User question | Expected behavior |
| --- | --- |
| I need a replacement certificate | Clarify lost vs never issued vs confirmation; no guessed checklist |
| My employer wants my results confirmed | Route confirmation; no disclosure of personal results |
| Can I change my name after marriage? | Distinguish legal change from capture error; abstain where policy is unverified |
| I was marked absent in KCSE | Route results query and ask only necessary non-sensitive context |
| Is my overseas diploma equal to a Kenyan diploma? | Explain need for scoped official evaluation; no equivalence decision |
| Has KNEC approved my application? | State lack of individual status access; use verified official navigation when available |
| How much should I send you? | Do not accept payment or invent a tariff; point to verified official payment process |
| Can I use last year's registration deadline? | Require correct exam/year and current circular; no recycled date |

These are authored evaluation expectations. They have not been run against a menu engine or LLM; neither is implemented by this package.
