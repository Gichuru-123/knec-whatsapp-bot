# Phase 2: Knowledge-base foundation — retrospective report

Prepared: 2026-10-20. Status: **content/storage foundation exists; schema and verified-content exit criteria remain incomplete**.

[Documentation index](README.md) | [Phase 1](phase1-engineering-foundation.md) | [Phase 3](phase3-backend-foundation.md)

## Purpose and planned scope

The local draft roadmap calls for a defined article/FAQ schema, source-authority metadata, a first verified content set, versioning and human review before verified status. Its planned scope includes examination information, orientation to public services and fraud awareness. It does not authorize individual candidate-record access.

The planned exit is both structural and editorial: schema and content must be reviewed. Parsing JSON or recording a source URL cannot establish factual accuracy.

## Historical implementation evidence

| Git reference | Observed contribution |
| --- | --- |
| [`5da51dc`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/5da51dc), 2026-09-30 | Four initial articles, a JSON parsing validator and an npm validation command |
| [`3bf3c73`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/3bf3c73), 2026-10-01 | Metadata/required-field validation and documentation corrections |
| [`30a284f`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/30a284f), 2026-10-01 | KPSEA/KJSEA, TVET and scam-awareness coverage |
| [`b61b022`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/b61b022), 2026-10-01 | Verification-label and documentation corrections |
| [`627b740`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/627b740) and [`521c372`](https://github.com/Gichuru-123/knec-whatsapp-bot/commit/521c372), 2026-10-01 | Character/UTF-8 BOM corrections |

The initial validator only parsed JSON. The later required-field validator is stronger but remains substantially narrower than the roadmap's schema and content-review requirements. The [KB changelog](../knowledge-base/CHANGELOG.md) summarizes the content work.

## Current article inventory

These values are read from the files at `11d6c33`. They are labels, not an independent factual verification by this report.

| Article | ID | `status` | `verification_status` |
| --- | --- | --- | --- |
| [Certificate replacement](../knowledge-base/certificates/replacement.json) | `cert-replacement` | `active` | `unverified` |
| [General FAQs](../knowledge-base/faqs/general.json) | `faq-general` | `active` | `unverified` |
| [Scam awareness](../knowledge-base/faqs/scam-awareness.json) | `faq-scam-awareness` | `active` | `verified_domain` |
| [KCSE registration](../knowledge-base/registration/kcse.json) | `reg-kcse` | `draft` | `unverified` |
| [KPSEA/KJSEA registration](../knowledge-base/registration/kpsea-kjsea.json) | `reg-kpsea-kjsea` | `draft` | `unverified` |
| [TVET registration](../knowledge-base/registration/tvet.json) | `reg-tvet` | `draft` | `unverified` |
| [Results verification](../knowledge-base/verifications/results.json) | `ver-results` | `active` | `unverified` |

Six articles are `unverified`; one is `verified_domain`. Neither the `active` label nor `verified_domain` establishes that all advice, procedures, fees or dates in an article are approved and current. No article has the roadmap's exact `verified` label. The changelog's broad description of unverified content should be read alongside this exact inventory.

## Validation actually implemented

[`scripts/validate-kb.js`](../scripts/validate-kb.js) recursively parses JSON and requires truthy values for eight fields:

`id`, `category`, `title`, `source_url`, `source_date`, `status`, `verification_status`, `version`.

It does not enforce field types, allowed enum values, URL authority, date validity, a complete article/FAQ shape, global ID uniqueness or factual accuracy. Its output saying "Schema Verified" or "fully verified" overstates the checks; it must be interpreted as required-field validation only. That wording has not been changed by this documentation work.

The backend's [startup loader](../src/repository/kbRepository.js) has a different boundary: it checks truthy `id`, `title` and `category`, rejects duplicate IDs and an empty collection, and freezes article objects. It is not equivalent to the command-line validator or a full schema.

## Comparison with the roadmap

| Planned requirement | Observed state / remaining work |
| --- | --- |
| Schema files under `knowledge-base/schema/` | No schema definition files found. Implementing and testing a complete schema requires separate approval. |
| Storage under `knowledge-base/articles/` | Articles are instead grouped directly by topic under `knowledge-base/`. Record this layout difference; do not move files without an approved migration. |
| Standard taxonomy and vocabulary | Fields exist, but statuses use `active`/`draft` and verification uses `unverified`/`verified_domain`, differing from the roadmap vocabulary. Reconcile deliberately before enforcing a schema. |
| Article/FAQ metadata and authority | Files include source, date, authority-tier and record/escalation fields, but the validator does not enforce all of them or their correctness. Uniform question/intents/related-question structures are not established across the set. |
| Verified content for each initial scope area | Not established by the current labels or reviewed records. Seven files do not prove complete or verified topic coverage. |
| Human review and versioning workflow | Changelog and contribution guidance exist; no complete reviewer assignment, approval history and publication procedure was found. |
| Publication gate | KB services can return unverified articles through explicitly enabled inspection routes. There is no verified-only public-answer gate; current WhatsApp handling does not answer from the KB. |

## Test evidence and approval

Before the Phase 4 checkpoint push, `npm run validate-kb` passed for seven files, including in an isolated copy. [CI for `11d6c33`](https://github.com/Gichuru-123/knec-whatsapp-bot/actions/runs/39477949964) also passed that step. These checks are structural evidence only.

No external source verification, historical snapshot test run or candidate-data audit was performed for this documentation task. No content was edited or promoted to a verified status. No standalone Phase 2 schema/content sign-off was located in the reviewed repository documents. Earlier approvals outside those records are not assumed absent, but cannot be reconstructed as facts.

## Recommended follow-up and exit assessment

Phase 2's storage and metadata foundation is evidenced; its full verified-content exit gate remains open. Approve a separate schema/governance work order, define controlled vocabularies and reviewer responsibility, verify each proposed public answer against authoritative sources, and establish a publication gate. Keep unknowns explicit. These are prerequisites to reliable public knowledge delivery, not work implemented by this report.
