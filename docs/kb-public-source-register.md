# Public knowledge source register

**Retrieval update:** Windows HTTPS retrieval subsequently succeeded without disabling TLS verification. Six PDFs and the query-page HTML were saved and inspected locally. See [the implementation report](phase2-kb-implementation.md) and `knowledge-base/sources/catalog.json` for exact source URLs, dates and hashes. Initial access failures below describe the earlier discovery pass, not the current evidence state.

Research date: 2026-11-03. Status: discovery and preliminary evidence review; **not an approved answer corpus**.

## Evidence limitations

Official-domain search results exposed useful text and document links. Direct web-reader requests to QMIS, the charter landing page, downloads hub, FAQs, query page and two procedure PDFs failed with timeouts, cache misses or gateway errors. Direct Node fetch attempts to the charter and downloads pages also failed. No authenticated QMIS session was opened. No complete PDF, current portal form, payment screen or full charter tariff table was reviewed. Search crawl dates and upload-directory dates are not publication or effective dates.

The register distinguishes **indexed text** (some source text available through search), **listing** (title/link found), and **unread** (destination attempted but not readable). None constitutes editorial approval. Original files, page/section locators, retrieval timestamps and SHA-256 hashes remain to be captured before approving procedural claims. URLs below are discovery evidence, not proof that each destination currently loads.

## Official sources discovered

| ID | Official source | Evidence available | Intended use and unresolved work |
| --- | --- | --- | --- |
| S01 | [QMIS overview](https://www.knec.ac.ke/qmis/) | Indexed text; direct access failed | Service discovery: certification letter, confirmation, biodata amendment, foreign qualification equation. Retrieve complete current page. |
| S02 | [Legacy QMIS explanation](https://www2.knec.ac.ke/qmis/) | Indexed text; dated 2021-01-25; direct access failed | Additional query categories and general application journey. Historical context; recheck against current manual. |
| S03 | [QMIS procedure PDF](https://www.knec.ac.ke/wp-content/uploads/2022/10/QMIS-PROCEDURE.pdf) | Indexed text; full PDF unread | Separates confirmation and lost-certificate certification. Mentions seven documents without identifying all of them in the visible flow. Cannot supply a complete checklist. |
| S04 | [Handling queries](https://knec.ac.ke/services/queries/index.html) | Indexed text; direct access failed | Misspelt names, results queries and time-sensitive amendments. Inspect full table and applicability before publishing penalties/deadlines. |
| S05 | [8th Edition Service Charter 2026, English](https://www.knec.ac.ke/8th-edition-service-charter-2026-english/index.html) | Listing; full document unread | Priority source for service commitments, charges and responsibilities. Obtain original PDF and visually verify table rows/footnotes. |
| S06 | [Downloads hub](https://knec.ac.ke/downloads/index.html) | Indexed text; direct access failed | Locates distinct certification, confirmation and equation guidelines. Follow links to current originals; landing-page labels are not procedures. |
| S07 | [Equation guidelines, 2 April 2025](https://www.knec.ac.ke/wp-content/uploads/2025/04/doc02574520250411100900.pdf) | Indexed first-page text; full PDF unread | Qualification scope, authentication and translation requirements. Full remaining pages and later revisions required. |
| S08 | [Confirmation guidelines](https://knec.ac.ke/wp-content/uploads/2018/11/Confirmation-Guidelines-2.pdf) | Indexed text; full PDF unread | Online application route. Embedded upload year does not establish current policy; do not copy old payment instructions. |
| S09 | [FAQs](https://www.knec.ac.ke/faq-page/index.html) | Indexed text; direct access failed | User vocabulary, result slips, certificates and application-status questions. Check each answer against service-specific documents. |
| S10 | [KCSE service page](https://knec.ac.ke/services/school-exams/k-c-s-e/index.html) | Indexed text | Distinguish school and private candidate document-collection routes. Revalidate against current applicable guidance. |
| S11 | [2026 KCSE registration circular landing page](https://www.knec.ac.ke/registration-of-candidates-for-the-2026-kcse-examination/index.html) | Listing dated 2026-02-17 | Locate the original circular and any extensions/amendments. Do not treat 2026 dates as next-year dates. |
| S12 | [2026 KJSEA/KPLEA registration circular](https://www.knec.ac.ke/wp-content/uploads/2026/02/REGISTRATION-OF-CANDIDATES-FOR-THE-2026-KJSEA-AND-KPLEA.pdf) | Indexed first-page text dated 2026-02-11 | Distinct assessment pathways and registration context. Full document and subsequent notices required. |
| S13 | [KPSEA/KJSEA user guide](https://www.knec.ac.ke/wp-content/uploads/2026/02/KPSEA-KJSEA-USER-GUIDE-1.pdf) | Indexed excerpt; full PDF unread | Assessment procedures and accommodations; verify document edition and relevant sections. |
| S14 | [Candidate registration](https://www.knec.ac.ke/services/registration-of-candidates/) | Indexed text | General registration responsibilities and accommodations. Current exam-specific circular controls applicability. |
| S15 | [Official portal directory](https://www.knec.ac.ke/our-portals/index.html) | Indexed text | Route people by examination/service; verify actual target URLs and ownership before adding answer links. |
| S16 | [Services directory](https://www.knec.ac.ke/services/) | Indexed text | Service taxonomy, QMIS and Sema Nasi discovery. Do not infer complaint turnaround from a directory label. |
| S17 | [Teacher examinations](https://www.knec.ac.ke/services/teacher-exam/) | Indexed text | Identify programme families; obtain current programme-specific circulars before eligibility or duration advice. |
| S18 | [Business/technical registration portal](https://registration.knec.ac.ke/online-tech/Default) | Indexed text containing older manuals | Find current bulletins and series-specific policies; older manuals remain historical until reviewed. |
| S19 | [E-certificate platform](https://ecertificate.knec.ac.ke/) | Indexed text | Potential additional service. Verify rollout, eligible examination/year range and links from main KNEC site before recommending use. Do not assume it replaces certification letters. |
| S20 | [QMIS public login](https://qmis.knec.ac.ke/externalLogin) | Direct access attempted; unread | Public navigation/manual discovery only. Login is not required for this research stage. |

## Sources to expand next

Use the official KNEC website and linked portals for current circulars, timetables, regulations, forms, results-release notices, service charters in English/Kiswahili, public manuals, fraud alerts and contact directories. Locate current KPSEA/KILEA, teacher assessment and business/technical circulars separately; coverage is not established by a generic registration article.

Ministry of Education publications can establish Ministry-owned context; Kenya Law can establish legislation; KNQA publications can explain KNQA-owned services. They must not be silently treated as KNEC procedure owners. Locate and review exact primary sources before making claims. Official social posts may reveal changes but should lead to the underlying notice where available. News sites, scraped manuals, forums and commercial guidance are discovery leads only, not approved procedural authority.

## Conflict and uncertainty queue

1. **Certification versus confirmation:** current `cert-replacement` combines them. Separate service intents before adding requirements (S01/S03/S06).
2. **QMIS expansion:** current `ver-results` says Quality; official indexed text says Query Management Information System (S01/S02/S03).
3. **Charter editions:** old sixth/seventh editions remain searchable. Do not import their fees or timelines while the eighth edition remains unread (S05).
4. **Registration rules:** generic portal text and year-specific circulars may describe late registration differently. Resolve using the correct examination, year, circular and amendments; do not merge them into a universal rule (S11/S12/S15).
5. **Payment:** retain no bank details, personal payment numbers or fixed fee from old/search-only material. Verify the applicable tariff and current official payment instruction together (S05/S08).
6. **Biodata:** spelling corrections, change of name/order, photo, gender and other fields need separate applicability checks. No assumption that every requested identity change is permitted (S04).
7. **E-certificates:** published portal text suggests additional digital services; relationship to lost-document services is unresolved (S19).
8. **Contacts:** directories and older PDFs expose different contacts. Assign each contact a source, service scope and last-checked date; do not combine them into an unverified contact list.

## Next retrieval checkpoint

Priority order: current charter original; current certification/confirmation/equation originals; current public QMIS manual; query table; current examination-specific circulars. If official access remains unavailable, request public copies with their original URLs. An authenticated manual can later be reviewed through user-controlled login only if needed; exclude account records and private application details from the research corpus. Never request a password or OTP in chat.
