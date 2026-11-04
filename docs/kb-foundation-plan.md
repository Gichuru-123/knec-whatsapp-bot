# Knowledge-base audit and implementation plan

**Implementation follow-up:** the approved next step now has a [local implementation report](phase2-kb-implementation.md). The design/audit below records the earlier checkpoint; the report is authoritative for current schema, content counts, evidence access and testing.

Prepared 2026-11-03 after the Phase 4 development sign-off. Status: **local research and proposed design**, not implemented answer delivery or institutional approval.

## Purpose

Build a maintained service knowledge base from traceable public information before designing Phase 5 menus. The same reviewed service records should later support deterministic responses and retrieval for an LLM. More documents alone will not make answers reliable: every actionable instruction needs scope, evidence, review and a response when facts are unknown.

This package contains a [source register](kb-public-source-register.md) and [draft service cards](kb-service-cards-draft.md). Research is authorized by the owner's request. Runtime/schema migration, publication and promotion of content remain distinct reviewable changes. Existing seven runtime articles are unchanged in this pass.

## Findings in the current repository

| Finding | Consequence | Proposed repair |
| --- | --- | --- |
| Seven articles: six unverified, one `verified_domain` | Domain ownership does not verify advice | Review each claim; separate editorial approval from source origin |
| `cert-replacement` mixes replacement/confirmation | Wrong service may be recommended | Separate lost-certificate certification, confirmation, direct recovery and digital certificate discovery |
| `ver-results` expands QMIS as Quality | Incorrect terminology | Correct to Query with evidence and an explicit article revision |
| Generic portal URLs and dates without claim locators | Cannot reconstruct why a checklist or fee is correct | Link each consequential claim to exact source revision and section |
| Validator only tests eight truthy fields | Invalid types/statuses/dates can pass; “fully verified” message is misleading | Introduce a versioned schema and accurate structural-validation wording |
| Repository recursively loads JSON outside `schema/`; service returns articles without publication filtering | Draft metadata cannot safely be dropped into the runtime article tree | Keep research in `docs/`; implement an explicit approved-answer selection gate before public KB responses |
| Menus and retrieval are not yet implemented | No evidence of answer quality | Create reviewed intent cases before wiring Phase 5 |

The existing owner edit in `docs/phase2-knowledge-base-foundation.md` is preserved. This report supersedes no historical evidence and does not change article status labels.

## Coverage map

These are proposed service families, not approved menu options. Each row needs separate records where procedure, audience or examination differs.

| Priority | Service family | Example questions | Evidence / gap |
| --- | --- | --- | --- |
| First | Lost certificate and certification letter | I lost my certificate; which service do I need? | S01/S03/S06; full checklist missing |
| First | Confirmation of results | My employer/university needs confirmation | S03/S08; destination requirements to verify |
| First | Biodata and photo amendments | My name is misspelt; can I correct my photo? | S02/S04; distinguish fields and eligibility |
| First | Results queries | Missing mark, absentee entry, pending result | S02/S04; exam-specific branches needed |
| First | Foreign qualification equation | Can KNEC equate my foreign certificate? | S07; full document needed |
| First | Direct recovery and uncollected documents | My result slip was never printed | S02/S10; distinguish lost from never issued |
| First | QMIS navigation and status guidance | How do I apply or check progress? | S01/S02/S20; current manual needed |
| Next | Registration | School/private/repeater; which year and examination? | S11-S15/S18; split by programme and series |
| Next | Results access and collection | Where do I collect a result slip/certificate? | S09/S10; current release notices needed |
| Next | Special assessment arrangements | How does a school request an accommodation? | S13/S14; no blanket eligibility promises |
| Next | Complaints and escalation | Where do I raise a service complaint? | S05/S16; verify contacts and commitments |
| Next | Fees, timing and fraud prevention | What do I pay, where, and how long? | Cross-cutting; current tariff + procedure required |
| Later | Teacher and business/technical programmes | Which registration route applies to my programme? | S17/S18; programme-specific guidance needed |
| Later | Timetables, centres and personnel services | Which timetable or official portal should I use? | Discover current originals; audience separation |
| Later | E-certificates | Is my examination/year supported? | S19; rollout and service boundaries unresolved |

## Proposed content contract

Define a JSON Schema before migrating the seven articles. Fields below are design requirements, not a claim that a schema currently exists.

| Group | Fields / rule |
| --- | --- |
| Identity | Stable `service_id`, `article_id`, schema version, content version, language and title; IDs independent of menu numbering |
| Scope | Audience, examination, year/series, location where relevant, eligibility conditions and exclusions; explicit unknowns |
| Discovery | Intent IDs, English/Kiswahili aliases reviewed by humans, example questions, related services and disambiguation questions |
| Answer | Short answer, ordered steps, required versus conditional documents, official channel, exceptions and escalation |
| Claims | Stable claim ID, paraphrased fact, source IDs with page/section locator, applicability, effective interval and evidence status |
| Source | Publisher, exact URL, document title/reference, edition, publication/effective dates when known, retrieved timestamp, content hash and archival reference |
| Volatile facts | Fee amount/currency/unit, conditions, payment instruction and service timeline; nullable when unknown, with source and review deadline |
| Governance | `draft`, `in_review`, `approved`, `retired`; reviewer identity/role, approval timestamp, change rationale, supersedes links and next review date |
| Access | Public/protected classification; whether guidance needs a candidate record versus actual transaction execution; never store credentials or candidate documents in public content |
| Answer policy | Allowed claims, required qualifiers, unsupported questions and approved fallback; expired or conflicted claims cannot be served as current facts |

An unknown effective date must remain null with a reason; do not manufacture dates from retrieval time. Requirements need individual evidence, not one homepage citation for the whole article. An official source can be old, incomplete or superseded. A project owner approving a draft is distinct from a KNEC departmental expert confirming policy.

## Review and publication process

1. Discover primary sources and record access status. Read complete relevant sections, appendices and footnotes. Visually inspect PDF tables before extracting charges/timelines.
2. Record source identity, exact revision and checksums; compare newer notices/amendments. Preserve small evidence excerpts and links under appropriate access/copyright rules rather than copying entire websites into Git.
3. Write service cards with narrowly scoped claims. Mark missing facts and conflicts explicitly. Separate a user's task from the institution's internal SOP.
4. Have a named content reviewer verify each procedural claim. Obtain departmental confirmation where public material cannot answer the question; keep those claims blocked meanwhile.
5. Validate schema, references, unique IDs, dates, service scope and approved-state requirements. Human review is still required for factual accuracy.
6. Build a versioned release manifest and approved-only answer selector. Test then publish the reviewed bundle; support rollback to the previous approved version.
7. Review volatile facts before each release and on official notices. Proposed cadence: weekly during active registration/results windows for deadlines; monthly for fees/contact routes; quarterly for stable guidance. The owner must assign responsibility; no scheduled monitoring is installed by this document.

## How Phase 5 should use this work

First identify the service; ask the minimum non-sensitive clarifying question; select the applicable approved article; give a short answer with an official source and next step. The caller should not have to supply an ID number merely to learn a public procedure.

Example: “I need a new certificate” is ambiguous. Ask whether the original was lost, was never received, or an institution wants results confirmed. Those answers map to different service IDs. Do not begin with a guessed document checklist or fee.

Menu numbers are presentation choices over stable service IDs. Sessions retain only necessary interaction state with an explicit expiry. Date/examination/audience filters should apply before answering. If the necessary article is missing, stale or conflicted, say which detail could not be confirmed and direct to the relevant official service. Do not invent missing policy to complete a conversation.

## Future LLM and database role

Use the same approved corpus for retrieval-augmented generation: the LLM retrieves relevant reviewed evidence and composes an answer with citations. It is not the authority on fees, eligibility or results. Source text is data, never instructions that can override system policy. Retrieved content must retain service ID, scope, version, source and approval metadata; a chunk should not separate a rule from its exceptions.

Keep canonical reviewed content versioned in Git initially. PostgreSQL already stores delivery events; a later dedicated KB schema can store source revisions, approval history, article releases and retrieval metadata. Keep candidate transactions separate from public knowledge. Add full-text search first when justified; assess embeddings/vector storage against evaluation results rather than choosing a model now. Indexes should be rebuildable from canonical records. No new database schema, vector extension, LLM account or embedding upload is created in this pass.

Future departmental SOPs need classification and access controls. An internal document is not automatically eligible for public answers or an external model. Publicly approved extracts can enrich the same service IDs without redesigning the content structure.

## Acceptance gates and evaluation

Approve a bounded first release covering the seven first-priority service families above. Every published procedural claim must have an exact source locator, applicability and named reviewer. Unresolved critical conflicts block that article, not unrelated approved services. Each family needs a normal question, an ambiguous question, a missing-fact fallback, a wrong-exam/year case and a privacy boundary case.

Measure intent routing, citation support, applicability, completeness of mandatory steps, and correct abstention separately. Require zero invented fees, deadlines, document requirements or claims of accessing candidate records in the agreed critical-case set. Report numerator/denominator; a score is not a guarantee of universal correctness. A separate held-out question set should test ordinary language and spelling variations. Future LLM evaluation must also cover prompt injection, irrelevant retrieval and unsupported answers.

Before public KB answers: implement schema enforcement, migration of existing articles, publication filtering, expiry/conflict handling and response tests. Do not equate a passing JSON validator with an institution-ready corpus.

## Work completed in this pass and next boundary

Completed: repository gap review; public-source discovery; 20-source register with access limits; service coverage map; proposed content/review/retrieval contract; six draft routing cards. No article was promoted or runtime code changed. Next: acquire full primary documents, complete the claim evidence, and implement the reviewed schema/publication gate as a separate concrete change. Commit/push requires the owner's publication approval.

Validation at this checkpoint: `git diff --check` passed; local Markdown link destinations in the three new documents exist; `npm run check` passed lint, secret scanning, existing seven-article required-field validation and all 109 tests using the existing disposable PostgreSQL test database. These checks verify repository compatibility, not the accuracy or completeness of researched procedures. No live messaging was used. The unrelated Phase 2 file retains SHA-256 `60986A5B20BC7B3F286FAF3207C7B8814EEC341333E336E53FA3C44587BF815E`.
