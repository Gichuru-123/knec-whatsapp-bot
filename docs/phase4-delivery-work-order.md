# Phase 4 PostgreSQL delivery implementation work order

Revised: **2026-10-26**. **PostgreSQL architectural direction approved by the owner.** This document supersedes the unimplemented SQLite proposal.

[Completion checklist](phase4-completion-plan.md) | [Documentation index](README.md)

## 1. Purpose and checkpoint

Finish the WhatsApp channel foundation with durable acceptance, duplicate protection, controlled delivery and recorded outcomes. The finish line remains a signed live Sandbox message followed by one diagnostic reply received on the permitted phone, with sanitized evidence and owner sign-off.

PR #3 merged at `34b41770fab23137af42ae9a696b163babaf609c`; its recorded baseline is 97 passing tests. Existing Twilio processing is test-only with fake outbound transport. The owner reports joining a KNEC development Sandbox; its last reported inbound URL is the Twilio demo reply and its status callback is blank. Backend round-trip evidence remains outstanding.

The owner approved PostgreSQL as the long-term database direction. This revised implementation plan makes that direction concrete. Preparation changes documentation only. No database, installed driver, new runtime behavior or live connection is claimed.

## 2. Database decision

Use PostgreSQL 18 with a supported stable minor release, accessed asynchronously through the `pg` driver and a bounded connection pool behind `deliveryStore.js`. Resolve and exactly pin a compatible stable driver release during implementation; review its transitive additions and preserve unrelated lockfile resolutions. Retain Node >=24.0.0 <25 and Twilio 6.2.0. No SQLite runtime API or Node floor change is needed.

Development and integration tests use real PostgreSQL. The setup guide must support a dedicated local database, with native installation or a container selected according to the available environment. Installation of a service, enabling Docker, paid hosting and institutional deployment are separate environment decisions. Never reuse or modify the apartment project's database.

Use parameterized SQL, foreign keys, uniqueness constraints, UTC timestamps and short transactions on one checked-out pool connection. No provider request runs inside a database transaction. Bound connection acquisition, query time and lock waits; release clients in finally blocks. Safe error categories must exclude connection strings, SQL parameters and raw driver exceptions.

Numbered SQL migrations run through an explicit command with separate migration credentials. Record version and checksum history; serialize migration commands with an advisory lock. The runtime role has only required table/sequence permissions. Startup checks connectivity, expected schema and run bindings before listening; it does not migrate automatically or recreate a failing store.

Remote connections require certificate and hostname verification. Explicit loopback development may use a local non-TLS connection. Secrets stay outside source control. Development, disposable test and future production databases must be separate.

Document backup and isolated restore procedures, retention and recovery ownership. Demonstrate a synthetic backup/restore into a fresh test database. Production backup scheduling, point-in-time recovery, availability and recovery objectives remain deployment requirements; installing PostgreSQL does not establish them.

References: [PostgreSQL concurrency](https://www.postgresql.org/docs/current/mvcc.html), [version support](https://www.postgresql.org/support/versioning/), [node-postgres transactions](https://node-postgres.com/features/transactions).

## 3. Persisted records and privacy

| Record | Purpose |
| --- | --- |
| Migration history | Applied versions and checksums; reject unsupported schema |
| Sandbox run | UUID, account/sender binding, participant fingerprint, identity-key version/fingerprint, immutable attempt cap, used budget, timestamps |
| Inbound receipt | Unique provider/account/message SID, run/conversation identifier, receipt time and supported/ignored decision |
| Outbound job | Unique receipt link, fixed template version, state, attempt count, eligibility time, claim token, provider SID and safe outcome |
| Attempt | Job/attempt number, dispatch/completion time, safe HTTP/provider category and known SID |
| Callback event | Account/SID, normalized status, optional numeric code, time and conflict evidence |
| Worker lease | Owner, expiry and fencing generation scoped to dispatch coordination |

Do not persist raw phone numbers, incoming text, attachments, tokens or full provider payloads in this diagnostic implementation. The single permitted recipient comes from private configuration; its fingerprint must match the stored run before dispatch. Changing account, recipient or identity key must fail rather than redirect queued work.

Conversation IDs use versioned HMAC-SHA256 over unambiguous provider/account/sender/participant fields with a separate random secret of at least 32 bytes. They are pseudonymous, not anonymous. Never use an unkeyed phone hash or the Twilio Auth Token. Rotation with pending work needs an explicit migration design.

Close the demonstration run and retain minimal records for seven days, then perform bounded cleanup while retaining closed-run tombstones. Never requeue uncertain work during cleanup. Deduplication is limited by retention and database preservation; logical deletion is not secure physical erasure.

Per-run bounds: 1,000 receipts/jobs, 3,000 attempts and 5,000 callback events, including ignored/unmatched records. Enforce counters transactionally; do not evict unresolved work. Capacity failure returns a safe failure before acknowledgement.

## 4. Acceptance and delivery flow

1. Preserve provider routing, form validation, configured-URL signature verification, rate limits and account/address checks.
2. Sandbox mode permits only the configured participant. Other participants receive fixed rejection and create no job.
3. Unsupported media/empty content creates bounded receipt metadata only; never download media.
4. Atomically insert the receipt and one pending diagnostic reply before acknowledging with empty TwiML.
5. A repeated provider/account/message SID produces no additional job, including concurrent arrivals and restarts. Inconsistent identity on the same SID fails safely. Uniqueness spans runs during retention.
6. Database or budget failure must not acknowledge successful durable acceptance. Do not assume Twilio retries every error automatically.
7. The worker transactionally claims work and reserves an attempt and run budget before submission. Persist sending before external I/O.
8. Record provider acceptance and reconcile exact account/SID callbacks. Provider acceptance does not prove handset receipt.

Fixed reply:

> KNEC Digital Assistant development test: your message reached the test system. This is a connectivity check; no KNEC service request has been submitted.

The first Sandbox runtime has one active dispatcher with at least three seconds between dispatches. PostgreSQL row locks serialize budget/capacity changes. A database-time lease and fencing token coordinate independent processes; verify ownership before dispatch and before finalizing. No worker starts on import. Recovery of an expired sending claim marks it uncertain. A lease cannot retract an already submitted external request.

## 5. Outcomes and retries

| Outcome | Action |
| --- | --- |
| Valid create response, expected account/SID/status | Persist accepted outcome and reconcile matching callbacks |
| Confirmed HTTP 429 with validated Twilio code 20429 | Bounded retry within age, job and run limits |
| Explicit 400/401/403/404 rejection | Fixed failure; no automatic retry |
| Timeout, reset, 5xx, malformed/truncated success, redirect or ambiguous acceptance | Uncertain; no automatic resend |
| Accepted message later fails delivery | Record failure; do not create a replacement message |
| Interrupted sending attempt | Uncertain after lease expiry |
| Pending job older than ten minutes | Expire without sending |

Maximum three attempts per job for eligible 20429 responses, with at least 5 seconds then 15 seconds plus bounded jitter. Respect a validated longer Retry-After without exceeding job age. Disable SDK retries. [Twilio 20429 guidance](https://www.twilio.com/docs/api/errors/20429).

Run attempt cap defaults to zero and accepts 0–10. Persist its immutable value and consume budget for every submission attempt, including uncertain/rejected outcomes. First live demonstration proposes one attempt. New runs or higher budgets require deliberate operator action. Once exhausted, reject new supported work safely rather than accumulate unsendable jobs.

A read-only local status command shows uncertain work and sanitized counts. No public administration/resend endpoint. Unknown SIDs cannot be inferred from approximate time or phone matches. Reconciliation and fresh live attempts require a deliberate decision.

## 6. Callback rules

Authenticate the separate status endpoint and expected account/address direction. Persist before returning 204; never send from this handler. Store initial status from the create response because Twilio does not send that initial callback.

Reconcile only exact account/SID matches. Keep early unmatched callbacks within capacity and retention limits. Deduplicate status/code events. Positive progress cannot regress on late earlier events. Retain conflicting terminal outcomes with a review flag. Normalize unknown valid statuses to a fixed label; do not retain arbitrary text. Failed persistence must not return a false durable acknowledgement.

[Twilio callback lifecycle](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks).

## 7. Transport and configuration

Retain official SDK signature validation and messages.create construction. Supply a restricted SDK-compatible Node HTTPS client: exact account-scoped Messages POST at api.twilio.com:443, normal TLS verification, no redirects, ambient proxies or configurable runtime destination. Keep Basic credentials in memory. Permit only configured sender/recipient/callback and fixed reply fields.

Bound the total connection/header/body deadline and response body to 64 KiB; destroy timed-out requests. Return only validated minimal success/error fields. Never expose request history, raw errors or response bodies. A cancellation request cannot prove non-acceptance. Loopback fake targets are constructor-injected only in tests.

| Setting | Rule |
| --- | --- |
| TWILIO_MODE | offline default; sandbox development only; production blocked |
| TWILIO_DELIVERY_ENABLED | false default; explicit gate for durable runtime |
| TWILIO_LIVE_SEND_ENABLED | false default; real sending only after every Sandbox gate |
| DATABASE_URL | Private runtime connection; never printed |
| DATABASE_MIGRATION_URL | Separate migration-only credential |
| TEST_DATABASE_URL | Explicit disposable test target, guarded against runtime target reuse |
| TWILIO_CONVERSATION_SECRET | Separate validated secret, at least 32 random bytes |
| TWILIO_CONVERSATION_KEY_VERSION | Positive version bound to stored run |
| TWILIO_SANDBOX_RUN_ID | Explicit UUID bound to stored run |
| TWILIO_SANDBOX_MAX_ATTEMPTS | 0–10; default zero; immutable per run |

Document exact bounded pool, acquisition, statement/lock timeout and TLS settings during implementation. Retain existing sender/recipient/URL/body/rate settings. Disable inspection in Sandbox. Initialize the store before listening, start the worker explicitly and close HTTP/pool/worker resources on shutdown. No private environment edits are included in code preparation.

## 8. Reviewable implementation file scope

Use branch `codex/phase4-delivery-safeguards` from the merged baseline, preserving unrelated edits. The revised scope is **18 new and 20 existing files: 38 paths**.

### New files

| File | Purpose |
| --- | --- |
| src/repository/deliveryStore.js | PostgreSQL transactions, counters, claims and cleanup |
| src/services/messaging/conversationIdentity.js | Versioned keyed identity |
| src/services/messaging/deliveryService.js | Atomic acceptance and callbacks |
| src/services/messaging/deliveryWorker.js | Claims, budgets, retries and recovery |
| src/services/messaging/twilioHttpClient.js | Restricted real transport |
| src/services/messaging/deliveryRuntime.js | Explicit composition and lifecycle |
| scripts/delivery-status.js | Sanitized read-only inspection |
| scripts/migrate-db.js | Serialized checksummed migrations |
| db/migrations/001_delivery.sql | Initial schema, constraints and indexes |
| tests/helpers/postgres.js | Guarded isolated PostgreSQL fixtures |
| tests/integration/deliveryStore.test.js | Real database persistence/concurrency checks |
| tests/integration/databaseMigrations.test.js | Migrations, checksum and permissions |
| tests/unit/deliveryService.test.js | Acceptance, identity and callbacks |
| tests/unit/deliveryWorker.test.js | State transitions and retry policy |
| tests/unit/twilioHttpClient.test.js | Transport contract and failure bounds |
| tests/integration/deliveryLifecycle.test.js | Routes, restart and separate-process behavior |
| docs/database-operations.md | Setup, roles, migration, backup/restore and growth |
| docs/phase4-sandbox-runbook.md | Activation, evidence and shutdown |

### Existing files

| File | Purpose |
| --- | --- |
| .gitignore | Private database exports/configuration and temporary evidence |
| .env.example | Empty safe configuration placeholders |
| package.json | Pinned pg and explicit migration/database/status commands |
| package-lock.json | Reviewed dependency additions |
| .github/workflows/ci.yml | PostgreSQL service and required database checks |
| src/config/index.js | Validated database and Sandbox gates |
| src/app.js | Delivery dependency injection |
| src/index.js | Startup and shutdown ownership |
| src/services/messaging/adapterFactory.js | Explicit transport injection |
| src/services/messaging/twilioAdapter.js | Restricted Sandbox construction and outcomes |
| src/controllers/twilioWebhookController.js | Durable acceptance/callback integration |
| tests/helpers/testEnv.js | Deterministic safe defaults |
| tests/unit/configAndPrivacy.test.js | Configuration and disclosure regressions |
| tests/unit/twilioAdapter.test.js | Transport and result contracts |
| tests/integration/twilioWebhook.test.js | Original offline compatibility |
| README.md | Modes, commands and actual status |
| docs/README.md | Index and checkpoint |
| docs/presentation-guide.md | Architecture and evidence explanation |
| docs/phase4-completion-plan.md | Completion evidence and boundaries |
| docs/phase4-delivery-work-order.md | Approval and implementation record |

Knowledge content, Phase 5 implementation, existing Meta/mock adapters, shared signature/form middleware, logger and private environment files remain outside this scope. Preserve the unrelated Phase 2 documentation edit. Report a necessary file/dependency expansion with its reason before proceeding.

## 9. Verification scope

Implementation verification includes synthetic localhost traffic and dedicated disposable PostgreSQL databases; no provider traffic. Required evidence:

- Existing 97 baseline scenarios retained, with actual new totals reported.
- Explicit migrations, checksums, concurrent migration serialization and least-privilege runtime permissions.
- Transaction rollback, schema mismatch, database outage, bounded pool exhaustion and lock/capacity failures.
- Concurrent repeated receipts create one job across independent clients/processes and restarts.
- Stable isolated conversation identity and no forbidden data in records/logs/status.
- No success acknowledgement before commit; unsupported/forbidden messages cannot trigger sending.
- Separate-process worker contention, fencing, graceful shutdown and interrupted-send uncertainty.
- Fake local HTTP transport: deadlines, slow body/headers, oversized/truncated/malformed responses, redirects and credential isolation.
- Retry eligibility, pacing, expiry, persisted budget and no ambiguous resend.
- Early/repeated/out-of-order/conflicting callbacks and bounded orphan storage.
- Synthetic backup and restore into a fresh isolated database, with restored state inspected.
- Full lint, secret scan, KB validation, tests and fresh locked install; reviewed dependency diff and documentation links.

Database integration checks must fail clearly when their required database is unavailable, rather than silently skip. Cleanup refuses unmarked targets and never uses runtime credentials. Use fake credentials and injected clocks. Passing tests do not establish production availability or live delivery.

## 10. Execution sequence and approval boundaries

1. Record approved PostgreSQL direction and review this concrete revised implementation scope.
2. Inspect available local database tooling, then establish an explicitly isolated development/test setup. Resolve any missing installation requirement before provisioning it.
3. Implement migrations/store first, then delivery service/worker and real transport, retaining disabled defaults.
4. Run the specified synthetic verification and publish a review report with exact changes, results and limitations.
5. Commit/push/merge follows the owner's publication decision for this change.
6. Live activation follows a concrete account/recipient/HTTPS ingress/budget decision, after code review.

Live demonstration: privately confirm KNEC account and valid Sandbox membership; agree exact inbound/status URLs and proxy settings; authorize one outbound attempt; send one harmless phone message; record matched SID/callback and physical receipt; stop sending and ingress afterward. Preserve the apartment webhook. Record exact code revision and request Phase 4 sign-off.

## 11. Architecture beyond Phase 4

PostgreSQL provides durable shared state now. Phase 5 can add conversation sessions through reviewed migrations. Knowledge publishing/versioning and departmental workflows require their own schemas and governance. Existing KB files remain unchanged during Phase 4. Official KNEC record access requires separately authorized integrations.

The initial dispatcher stays deliberately limited for the Sandbox. Shared transactions and process coordination establish a foundation for additional workers/instances later; production capacity, high availability, hosting, data location and recovery objectives still need institutional decisions.

## 12. Approval record

**2026-10-26:** Owner approved the PostgreSQL idea and requested the next action. This revision records that decision and replaces SQLite with a concrete 38-path implementation plan.

**Database direction:** approved.
**Revised implementation plan:** approved by the owner through “proceed”; implementation began on the feature branch.
**Separate PostgreSQL 18 setup:** explicitly approved by the owner on 2026-10-26.

**Publication and live activation:** separate decisions as above.
**Phase 4 completion:** outstanding.


## 13. Implementation and verification checkpoint — 2026-10-31

The local implementation now includes PostgreSQL migrations and restricted runtime access, atomic receipt/job acceptance, duplicate protection, keyed conversation identities, bounded worker claims and attempt budgets, uncertainty recovery, callback reconciliation, a restricted SDK transport, explicit Sandbox runtime composition, retention operations and operating documentation. Sending remains disabled in the example; no live exchange or publication is claimed.

Evidence:

- PostgreSQL 18.6 isolated on loopback port 55418; existing PostgreSQL 17 preserved.
- Migration version 1 applied. Separate runtime-role startup verified with a synthetic zero-budget run; schema CREATE denied while required INSERT is permitted.
- Development backup restored to a fresh isolated database and migration version verified. This initial backup exercise contained no real message records.
- Working-tree check passed 108 tests; the subsequent isolated fresh-install check passed **109 tests**, including the added retry-budget persistence case. Both checks passed lint, secret scanning and seven-article structural validation. These are local results, not GitHub CI results.
- Fresh copy: `knec-phase4-fresh-1824e48dc4864bb78692476a6d761faf` under the host temporary directory. Its test snapshot includes the runtime shutdown changes, independent-process claim test, signed durable webhook test, transport bounds checks, retention checks and retry-budget test.
- pg is pinned at 8.23.1, with 14 package additions. Review against the merged lockfile found no changes to existing dependency entries at this checkpoint.
- The owner's unrelated Phase 2 edit retains SHA256 `60986A5B20BC7B3F286FAF3207C7B8814EEC341333E336E53FA3C44587BF815E`.

### Security finding requiring a scope decision

The fresh install on 2026-10-31 reported seven audit entries: one high and six moderate. These resolve to three underlying advisories plus dependency propagation:

| Existing package | Installed | Patched version | Scope |
| --- | --- | --- | --- |
| follow-redirects | 1.16.1 | 1.16.2 | Twilio/Axios transitive dependency; high audit severity |
| qs | 6.16.0 | 6.16.1 | Shared runtime/test transitive dependency; moderate |
| minimatch | 10.2.6 | 11.0.1 | ESLint development dependency; major-version compatibility review required |

Sources: [follow-redirects advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p), [qs advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

The diagnostic transport uses Node HTTPS and refuses redirects, but that does not justify declaring the installed dependency tree advisory-free. No exploitability claim is made from package presence alone. Do not run automatic forced dependency fixes: the audit suggestion includes incompatible lint-tool downgrades.

Proposed expansion: targeted follow-redirects/qs patches, then isolated minimatch 11 compatibility evaluation and a reviewed remediation decision. Rerun full and fresh-install verification after any dependency changes. Owner scope decision requested; package updates have not yet been applied.

### Remaining acceptance work

Resolve the security scope decision, complete the final review/evidence checklist and review live activation with the owner. The current tests demonstrate core concurrency, uncertainty, callbacks, durable routes and transport bounds. Production availability, institutional hosting and real handset delivery are not established. Phase 4 remains open until the controlled live exchange and sign-off.

## 14. Approved security repair — 2026-10-31

The owner approved the targeted patches and minimatch compatibility checks. Exact npm overrides now select follow-redirects 1.16.2, qs 6.16.1 and minimatch 11.0.1. Lockfile comparison against the pre-repair PostgreSQL implementation shows only those three version changes and one added minimatch dependency, @isaacs/nonrecursive-glob-match 1.0.3. No unrelated installed package entry changed.

Compatibility evidence: 651 comparisons across repository paths and the lint configuration's patterns agreed between minimatch 10.2.6 and 11.0.1. ESLint still reports intentional no-var, no-undef, eqeqeq and no-unused-vars violations, ignores node_modules, and includes delivery source files. This establishes compatibility for the current configuration; it is not a claim about every minimatch feature.

The repaired working tree passed all **109 tests**, lint, secret scanning and seven-article structural validation. The installation audit reported **zero advisories**. The second isolated fresh installation also passed all 109 tests, lint, secret scanning and seven-article structural validation. Its final npm audit returned zero entries in every severity category. Fresh directory: `knec-security-fresh-d5552671d3724baabd6e3f979b063309` under the host temporary directory. Both install and checks exited successfully.

Keep the overrides explicit while upstream dependency ranges still select affected versions. Review their removal when upstream releases include secure compatible ranges; do not silently downgrade lint tooling to satisfy an automated audit suggestion.

This section supersedes section 13's pending security decision. Publication, live activation and Phase 4 sign-off remain separate.

## 15. Publication approval — 2026-11-01

The owner explicitly approved committing this Phase 4 change, pushing `codex/phase4-delivery-safeguards` and opening a pull request into `main`. The unrelated Phase 2 edit is excluded. Merge approval, live activation and Phase 4 sign-off remain separate. The pull request will record the exact published commit and GitHub CI results.
