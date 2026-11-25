# QMIS guide evidence inspection

Checkpoint: 16 November 2026. This inspection records what the official guides document. It does not assert that every historical screenshot is unchanged on the live portal, provide access to an individual account, or grant KNEC publication approval.

## Documents inspected

### QMIS user guide, copyright 2018

- Source ID: `qmis-manual-2018`
- File: `qmis-manual.pdf`
- SHA-256: `4f67a0032187376ec74c7fcf5770735eafa7c13e7dee57e76796ddd19c56d181`
- Visual inspection: all six PDF pages, including every screenshot and diagram.

| PDF pages | Documented information extracted |
| --- | --- |
| 2 | Online purpose; browser access; displayed QMIS address; Register control; registration fields begin. |
| 3 | Registration submission and feedback; credentials sent through email; login fields and Log In control. |
| 4 | Home controls: Query, Status, Confirmation, Certification, Equation, Change Password and Logout; Query menu categories. |
| 5 | Direct Recovery example; examination, year, index/centre number and document fields; attachment area; Submit; successful-submission feedback; payment message after document verification; Status navigation begins. |
| 6 | Status lookup inputs; email/SMS collection notification; definitions of nine service/query categories; credential confidentiality and valid-contact warning. |

### External QMS User Manual, September 2017 edition

- Source ID: `qmis-external-2017`
- File: `qmis-external-manual.pdf`
- SHA-256: `4c6a3f796aa72a0025c7aeae2cf7da792e4e1f9d2be40dff0c9d61a9692f966d`
- Visual inspection: all ten PDF pages, including every screenshot and diagram.

| PDF pages | Documented information extracted |
| --- | --- |
| 1-2 | Cover, September 2017 edition and contents. |
| 3 | External/internal module distinction; HTTPS portal address; login and Register controls. |
| 4 | Registration fields; registration feedback; login sequence; Forgot Password behavior. |
| 5-6 | Candidate Biodata Amendment selection, lookup fields, current/proposed values, Required List, attachments and submission. |
| 6-7 | Candidate Photo Amendment selection, candidate lookup, current/new photo, required attachments and submission. |
| 7-8 | Contracted Professionals payment-query selection and fields: National ID, examination, year, series, position, query nature, amounts, institution, description and attachments. |
| 8-10 | Results Confirmation selection; candidate lookup; recipient fields; required attachments; submission. |
| 10 | Online Query Status screen and lookup fields. The manual does not provide a complete glossary for every possible status label. |

## Evidence decision

The earlier `qmis-current-workflow` conflict was too broad. The guides do explicitly document the screens and workflows above, and no contradiction was found between them on the common navigation sequence. That conflict record has therefore been removed.

Three matters remain separate:

1. The article may explain what the official guides document.
2. KNEC must still confirm whether historical labels and sequences remain applicable to the live portal and provide a current status-label glossary.
3. The assistant cannot access, inspect, approve or alter an individual application and must never request passwords, OTPs or candidate records.

The project owner approved the extracted guide-based content for project use. This is recorded in `evaluation/kb/source-decisions.json`; it is not institutional KNEC publication approval.

## Menu integrity

No menu node was added, removed or redesigned. QMIS enrichment remains behind the existing `online-services.qmis` knowledge hook. The menu retains 32 active article mappings, while `reg-kpsea-kjsea` remains an internal, unmapped comparison article.

## KJSEA placement research boundary

Two additional official documents were inspected:

- `kjsea-regulations-2026.pdf`, SHA-256 `875ae1aea3445a1efc75dcfa2ae82599651d68def63dbfac52777c8eb927f3b3`: all 19 pages checked; PDF page 17 supplies pathway strength, 20/20/60 score composition and Individual Learner Report evidence.
- `moe-kjsea-placement-2025.pdf`, SHA-256 `b1bb97bb2c9cbdb5e0f1c9ea18a3f08211adbcdfc9fb309c6554e16b749ce82a`: all three pages inspected; pages 1-2 describe 12 C1-C4 choices, pathway/subject-combination selection, automated placement factors and the historical December 2025 review route.

No inspected current official source names a public placement/selection website for the current cohort. The project therefore records the placement model and historical route but does not invent a portal URL or reuse the 2025 review window.
