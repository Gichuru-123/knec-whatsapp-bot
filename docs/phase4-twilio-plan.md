# Phase 4: Twilio integration plan

Original status: **design only**, prepared 2026-10-20. Official documentation was consulted on 2026-10-19. The original approved repairs did not include a Twilio implementation. The dated update below records the subsequent approved subset.

**2026-10-24 implementation update:** after PR #2 merged, the owner approved the [offline Twilio work order](phase4-twilio-offline-work-order.md). Its protocol subset is now locally implemented on `codex/phase4-twilio-offline`: test-only provider/configuration, separate form routes, SDK signature validation, normalization, safe callbacks and simulated outbound construction. Full local checks pass with 97 tests. Its [completion record](phase4-twilio-offline-work-order.md#17-implementation-and-verification-record) is the authoritative scope/evidence record. Publication still requires approval.

The following sections retain the broader design, including future live transport and storage. The offline subset uses no real transport, persistence, automatic reply or live credentials. SDK URL tolerance and exact path/query binding are described in the work order. Durable processing, Sandbox access and production onboarding remain separate future work.

## 1. Confirmed platform requirements

The following are Twilio requirements. The implementation choices in subsequent sections are project recommendations requiring separate approval.

- Validate `X-Twilio-Signature` using Twilio's SDK, the account Auth Token, the exact externally requested URL and all received form parameters. Form validation uses HMAC-SHA1; Meta's raw-body SHA-256 middleware cannot be reused. Do not trim or select parameters before validation. JSON webhooks have a separate body-hash validation procedure and are outside this initial form-only design. See [webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security) and [request security](https://www.twilio.com/docs/usage/security).
- Incoming messaging webhooks carry fields including `MessageSid`, `AccountSid`, `From`, `To`, `Body` and `NumMedia`. Synchronous incoming responses use TwiML; an empty response can acknowledge without generating a reply. See [webhook requests](https://www.twilio.com/docs/messaging/guides/webhook-request) and [Messaging TwiML](https://www.twilio.com/docs/messaging/twiml).
- Outbound message status callbacks identify a message and its status, and may include an error code. Callbacks can arrive out of order. See [outbound status tracking](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status).
- Webhook retry behavior can be configured through connection overrides. The `I-Twilio-Idempotency-Token` distinguishes delivery attempts; it must not replace the message SID as the application's business deduplication key. Do not assume a universal WhatsApp timeout from Voice-specific limits. See [connection overrides](https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides).
- REST requests require authentication. API keys are recommended for production API access; webhook validation still requires the appropriate account Auth Token. See [requests to Twilio](https://www.twilio.com/docs/usage/requests-to-twilio).

## 2. Fit with the existing application

Add a separate `TwilioWhatsAppAdapter` implementing the existing `MessagingAdapter` methods, after approving its precise file list and SDK dependency:

| Method | Proposed responsibility |
| --- | --- |
| `verifyWebhook(query)` | Return an invalid/no-challenge result. Twilio does not use the existing Meta GET challenge. |
| `validateSignature(req)` | Validate the complete form and configured public URL using the official SDK; fail closed. |
| `normalizeInboundPayload(body)` | Return the current internal message-array shape after authentication and field validation. |
| `sendTextMessage(to, text)` | Send one REST message with a bounded timeout and fixed safe errors. |

The offline work order now implements explicit factory/configuration selection and isolated routes, retaining Meta/mock adapters and tests. Real REST transport in the broader method table remains deferred. Events are accepted only for the selected provider; unknown providers fail configuration.

The current inbound handoff only logs receipt. The first separately approved Sandbox implementation should send a fixed diagnostic acknowledgement. Menus, FAQ routing, conversation state and Phase 5 remain excluded.

## 3. Proposed routes and HTTP behavior

| Route | Request | Successful response |
| --- | --- | --- |
| `POST /api/v1/webhook/twilio/whatsapp` | `application/x-www-form-urlencoded` | 200, `text/xml`, `<Response></Response>` |
| `POST /api/v1/webhook/twilio/status` | `application/x-www-form-urlencoded` | 204, empty body |

These paths are implemented only in Twilio test mode. The Meta/mock path remains available only for those providers. Unsupported methods on active Twilio paths return 405; inactive paths return fixed 404 responses. No Meta challenge is used for Twilio.

Use a route-scoped, bounded form parser with parameter limits. Preserve values exactly for signature validation, including spaces, Unicode and plus signs. Reject ambiguous duplicate parameter keys. Include newly introduced Twilio fields in validation instead of using a fixed signature allowlist. Validate identity and select normalized fields only after the signature succeeds.

Suggested outcomes: missing/invalid signature 401; authenticated malformed fields 400; unsupported content type 415; oversized body 413; capacity unavailable before acceptance 503. A valid but unsupported media message is acknowledged without sending or fetching media. Status callbacks never trigger conversational replies.

### Exact URL behind a tunnel or proxy

Configure separate public inbound and callback URLs. Match the actual incoming path/query to the configured endpoint, preserving query encoding, trailing slash, scheme and public port where applicable. Use that exact external URL in validation. Do not construct it from arbitrary `Host` or forwarded headers. Do not redirect webhook URLs.

A changed tunnel URL requires updating both local configuration and Twilio's webhook settings. Use HTTPS with a valid certificate, the actual trusted proxy hop count and inspection routes disabled. Wrong URL or mismatched query must fail validation in offline tests.

## 4. Proposed settings and secret ownership

The offline work order implements the settings below through `TWILIO_TEST_RECIPIENT` with stricter test-only limits. No live-send value can enable sending; the recipient is synthetic. Production API-key settings remain proposed and unimplemented. See the work order's exact configuration contract before using this broader design table.

| Setting | Proposed meaning |
| --- | --- |
| `WHATSAPP_PROVIDER=twilio` | Explicit later opt-in |
| `TWILIO_ACCOUNT_SID` | Expected account identity |
| `TWILIO_AUTH_TOKEN` | Webhook validation secret; also Sandbox REST authentication |
| `TWILIO_WHATSAPP_FROM` | Exact authorized `whatsapp:+E164` sender |
| `TWILIO_INBOUND_WEBHOOK_URL` | Exact public inbound URL |
| `TWILIO_STATUS_CALLBACK_URL` | Exact public callback URL; set on outbound requests |
| `TWILIO_REQUEST_TIMEOUT_MS` | Proposed 10000 ms default; strict bounded integer |
| `TWILIO_LIVE_SEND_ENABLED` | Defaults false, including after configuration changes |
| `TWILIO_TEST_RECIPIENT` | One explicit Sandbox recipient allowlist entry |
| `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` | Future production REST authentication, separately approved |

The owner retrieves credentials privately from the correct Twilio account. Do not paste them into chat, commits, logs, screenshots or test fixtures. Future `.env.example` entries must contain empty/example placeholders only. Preserve the private `.env`; automated tests continue to preload synthetic fixtures and skip dotenv.

After signature validation, verify `AccountSid` and expected `To`; before sending, verify the live-send gate, recipient allowlist and sender. Reject test fixtures in production. Do not require Meta credentials in Twilio mode. Confirm Twilio's current primary-token validation and rotation instructions before rotation; API credentials and webhook credentials have distinct purposes.

## 5. Inbound, outbound and callback data

Recommended normalization:

- `MessageSid` becomes `messageId`; validate its expected shape.
- A valid WhatsApp `From` address becomes `senderPhone` in the existing digits-only representation, with provider-specific prefix handling at the boundary.
- `Body` becomes `textBody` only for supported text messages. Ignore profile names and unneeded fields. Do not download media.
- Use a received-at timestamp in seconds and document that provenance; the form is not assumed to provide the sender's original timestamp. Existing Meta/mock timestamp conventions need an explicit compatibility decision in the future implementation.
- Set `rawProvider: 'twilio'`; do not retain the entire provider payload.

Use REST for the diagnostic reply and return empty TwiML for the incoming webhook. Do not send the same reply through both TwiML `<Message>` and REST. A successful REST response means provider acceptance, not handset delivery.

For callbacks, authenticate first, then persist only SID, normalized status, optional numeric error code and timestamps needed for operations. Ignore unknown fields after authentication. Handle a callback arriving before the send record is finalized. Do not let late `queued` or `sent` events overwrite a terminal delivery result; define status precedence and reconcile conflicting terminal events. Unknown statuses require safe handling, not a crash.

## 6. Duplicates, acceptance and failures

Use `(provider, AccountSid, MessageSid)` as the inbound deduplication key. Atomically claim it before scheduling a reply, so concurrent duplicate deliveries cannot each send. Maintain explicit processing and delivery states; acknowledging a duplicate must not lose the original task.

Recommended production design: persist acceptance and the outbound job before acknowledging, using a durable outbox. That storage work requires separate architecture and file-list approval. A bounded in-memory queue/map could support a single-process Sandbox experiment only if the owner explicitly accepts restart loss and duplicate risk. It is not production reliability.

Set a documented retention limit without retaining message bodies unnecessarily. Deduplicate callbacks by message/status/error tuple as appropriate, while preserving legitimate status transitions. A TTL expiry or restart means an old retry may be processed again; this design must not claim exactly-once delivery.

Outbound errors must contain only safe categories/status codes. Never attach provider bodies, original exception causes or credentials. Apply the timeout to headers and response consumption. A timeout after submission leaves acceptance uncertain: mark it unknown and reconcile; do not blindly resend. Retry only when non-acceptance is established and the bounded retry policy permits it. Honor provider throttling and reviewed backoff rules. Exhausted retries need a visible operational failure, not endless replay.

Choose and test webhook retry overrides deliberately. Do not assume every response code will automatically be retried. If capacity cannot be secured, fail before acknowledgement; a 200 sent before durable acceptance can lose work.

## 7. Offline implementation tests

All automated tests should use synthetic fixtures and mocked SDK/HTTP boundaries; no provider API calls:

- Valid signed forms and rejection of missing/wrong signatures, wrong account and wrong destination.
- Changed URL scheme/host/path/query, trailing slash, Unicode, spaces, plus encoding and an additional future field.
- Duplicate parameter keys, malformed form data, wrong content type, body/parameter limits and spoofed forwarded headers.
- Normalization of text and unsupported media without downloading attachments.
- Concurrent duplicate messages produce one scheduled send; callback duplicates and out-of-order callbacks preserve state.
- REST HTTP errors, invalid response JSON, stalled headers/body and transport exceptions cannot leak provider data.
- Unknown acceptance does not cause automatic resending.
- Live-send defaults false; allowlist mismatches are blocked.
- Existing Meta/mock, proxy, rate-limit and privacy regressions continue to pass.

SDK selection/version, dependency addition, queue/storage choice and exact file scope must be approved before implementation. Unit tests validate our integration logic; only a separately authorized controlled exchange can establish live interoperability.

## 8. Sandbox versus production

**Confirmed Sandbox properties:** it uses a shared testing sender; each participant must join, and participation expires after three days. It has a one-message-per-three-seconds limit and is unsuitable for load testing. The customer-service window is 24 hours; outside it, applicable approved templates are required. Console/tryout interfaces may differ. Check the owner's actual interface before giving setup steps. See [Twilio Sandbox documentation](https://www.twilio.com/docs/whatsapp/sandbox).

**Confirmed production onboarding:** follow Twilio's current WhatsApp self-sign-up procedure, including an upgraded Twilio account, appropriate Meta Business Portfolio permissions, a WhatsApp Business Account and an eligible phone number that can receive verification. Business verification and sender onboarding requirements must be completed for production according to the current account flow. A Sandbox join does not register a production sender. See [WhatsApp self-sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up).

**Project recommendations:** obtain KNEC authorization, approve branding/content, establish privacy and retention rules, assign an operational owner, and review access controls and incident handling before public use. These are project governance gates, not claims that Twilio grants institutional approval.

## 9. Costs, live checklist and rollback

Sandbox messaging can incur charges. Review current [WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing), applicable Meta fees, trial limits and any tunnel/hosting costs for the actual account and destination. Do not assume a free trial covers the test. No budget or account eligibility has been confirmed.

Every item below is pending; this work order authorizes none of the live steps:

- [ ] Approve the exact implementation scope and dependency/storage decisions.
- [ ] Review passing offline tests and the completed implementation.
- [ ] Owner confirms account, eligible Sandbox interface, recipient join and participation validity.
- [ ] Approve the budget and maximum exchange count; review current pricing.
- [ ] Owner privately configures credentials and exact HTTPS URLs.
- [ ] Disable inspection; verify proxy limits, signature rejection and live-send gate.
- [ ] Set one consenting test recipient; enable live sends only for the agreed test.
- [ ] Send one non-sensitive inbound message and observe one diagnostic reply.
- [ ] Check REST SID, callback result and actual handset receipt separately.
- [ ] Inspect sanitized logs; exercise duplicate behavior offline before any separately approved live retry experiment.
- [ ] Record results without phone numbers, tokens or message contents.
- [ ] Disable live sending, close the tunnel and restore the owner's previous webhook/provider configuration.

Before testing, privately record the prior settings so rollback is concrete. Stop outbound work first, then close public ingress and restore approved settings. Do not silently switch providers or replay jobs with unknown acceptance. If credentials are exposed, stop testing and have the owner rotate them. Preserve sanitized evidence; do not delete Git history or logs as a substitute for incident handling.

## 10. Next decision

Review the Phase 4 repairs and this plan. If accepted, request a separate bounded Twilio implementation work order specifying files, dependency approval, deduplication/storage choice and tests. Live Sandbox access and spending require a further explicit go-ahead after offline review. Phase 5 remains outside scope.

## Appendix A: approved repair review record

This appendix records the completed repair work; it does not change the design-only status of Twilio.

### Repository and exact file scope

Repository: `C:\Users\hp\Desktop\Application Docs\Projects\KNEC_DIGITAL_ASS\knec-whatsapp-bot`

Branch: `feature/phase-4-whatsapp-integration`

HEAD before and after: `ba115900e1f26a15360a706f998bc102ae9b02fb`

A SHA-256 baseline covered 51 project files, including existing untracked files, excluding `.git` and generated `node_modules`. Final comparison found 13 changed files, 38 unchanged files, one added file and no deleted project files. Existing changes outside the approved list remain byte-identical to that baseline. A Git diff against HEAD also includes earlier work and must not be attributed entirely to this repair.

| File | Repair |
| --- | --- |
| `.env.example` | Explicit provider and safe inspection/numeric configuration guidance |
| `src/config/index.js` | Explicit provider; inspection defaults/guards; strict numbers; production fixture rejection |
| `src/logger/index.js` | Sanitize nested/child context, exceptions, configured secrets and phone values |
| `src/middleware/errorHandler.js` | Fixed public HTTP messages; no exception or stack disclosure |
| `src/services/messaging/metaAdapter.js` | Per-message validation; timeout through body consumption; safe provider/transport errors |
| `tests/unit/configAndPrivacy.test.js` | Configuration, child-context, secret, phone and UUID regressions |
| `tests/unit/messagingAdapter.test.js` | Mixed batches, stalled bodies and provider/transport error regressions |
| `tests/integration/routes.test.js` | Malformed JSON disclosure and safe error status regressions |
| `tests/integration/webhook.test.js` | Signed malformed batch retains subsequent valid message |
| `README.md` | Corrected encoding/fences; runtime, configuration, behavior and limitations |
| `package.json` | Node 24 engine range |
| `package-lock.json` | Matching root engine metadata; removed stale root license metadata |
| `.github/workflows/ci.yml` | Node 24, Node-24-capable checkout/setup-node actions and accurate validator label |
| `docs/phase4-twilio-plan.md` | New plan, official sources and this review record |

The lockfile's dependency versions were not upgraded by this repair. Existing express-rate-limit and manifest-range differences shown against HEAD predate the repair. The lockfile was edited only for root metadata, not regenerated. Node 24 support and action versions were checked against [Node releases](https://nodejs.org/en/about/previous-releases), [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node).

### Acceptance results

| Criterion | Evidence/result |
| --- | --- |
| Explicit provider; Meta/mock preserved | Pass: missing/unknown values rejected; provider regressions pass |
| Inspection disabled by default | Pass: explicit local/test opt-in; production rejected; development proxy guard |
| Strict numeric settings | Pass: partial, fractional, blank, overflow and malformed sizes rejected |
| Production fixture rejection | Pass for repository fixtures and documented placeholder patterns; not proof a credential is genuine |
| Tests independent of private `.env` | Pass: synthetic preload; test mode skips dotenv; isolated copy contained no `.env` |
| Safe errors and logging | Pass for tested error, child-context, payload, credential, phone and query paths |
| Malformed JSON disclosure regression | Pass in development, test and production response modes |
| Timeout covers headers and body | Pass using fake servers including stalled response consumption |
| Malformed individual messages | Pass: valid later messages retained and handed off |
| Node/runtime consistency | Node v24.18.0, npm 11.16.0; Node 24 declared in both manifests and CI |
| Fresh locked installation | `npm ci`: exit 0, 95 packages added, 96 audited, zero reported vulnerabilities |
| Full suite | Baseline 60/60; repaired 77/77; fresh install 77/77; recovered working folder 77/77 |
| Focused suite | Initial repair 66/66; final refinements 68/68 |
| Knowledge-base validator | Seven files pass in working folder and isolated copy; required-field validation only |
| File boundaries | All 14 intended project files; 38 other baseline files unchanged; no project files deleted |
| Twilio planning | Complete; implementation and live evidence pending separate approval |

### Command and tool execution record

Commands ran from the repository above unless a different directory is stated. Repeated read-only inspections are grouped. The inline scripts are identified by their actual operation rather than represented as new reusable shell commands.

| Command or tool operation actually executed | Actual result |
| --- | --- |
| `Get-Content -LiteralPath 'C:\Users\hp\.codex\attachments\67d07c6e-67b0-4e78-9692-637785230902\Pasted text.txt' -Raw` | Read approved scope; repeated on continuation; exit 0 |
| `git rev-parse --show-toplevel` | Confirmed repository above; exit 0 |
| `git branch --show-current` | Confirmed branch above; exit 0 |
| `git rev-parse HEAD` | Confirmed unchanged HEAD above; exit 0 |
| `git status --short --branch --untracked-files=all` and `git status --short` | Recorded dirty working tree including existing work; exit 0 |
| `rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git' ..` | No applicable AGENTS file found |
| `Get-Content` reads of config, logger, errorHandler, Meta adapter, interface, four regression files, manifest, CI, example environment and README | Inspected implementation and tests; exit 0 |
| `rg -n 'logger\.' src` | Inspected logger call sites |
| `Get-Content package-lock.json -TotalCount 30` | Inspected root lockfile metadata; exit 0 |
| `node --version` and `npm --version` | v24.18.0 and 11.16.0; exit 0 |
| Inline Node SHA-256 project-file scan | Captured 51-file baseline; exit 0 |
| `npm test` before edits | 60 passed, zero failed; exit 0 |
| `npm run validate-kb` before edits | Seven files passed; exit 0 |
| `apply_patch` operations on the approved files | Repairs/tests applied; plan created; no Twilio implementation |
| Inline Node indentation repair for the Meta message loop | Formatting corrected; exit 0 |
| `node --require ./tests/helpers/testEnv.js --test tests/unit/configAndPrivacy.test.js tests/unit/messagingAdapter.test.js tests/integration/routes.test.js tests/integration/webhook.test.js` | First run 66/66; after two further regressions 68/68; both exit 0 |
| README `apply_patch` attempt | Failed on pre-existing invalid UTF-8; no write |
| First README PowerShell here-string write attempt | Not executed: automatic approval review reached its usage limit; work paused |
| README here-string piped to `Set-Content -LiteralPath README.md -Encoding utf8` after continuation | Successful UTF-8 replacement; exit 0 |
| `npm test` after repairs | 77 passed, zero failed; exit 0 |
| `npm run validate-kb` after repairs | Seven files passed; exit 0 (completion confirmed by polling) |
| `Get-ChildItem -Name` | Inspected repository entries; exit 0 |
| Inline Node `mkdtempSync` / `cpSync` of package manifests, src, tests, scripts and knowledge-base | Created a sandbox temporary copy; exit 0; next tool call could not access that sandbox-specific path |
| `npm ci` with sandbox temporary path as tool working directory | Process creation failed with Windows error 267; npm did not start |
| `Set-Location -LiteralPath` to that sandbox path, followed by `npm ci` | Directory change failed; PowerShell continued in the repository and started npm ci; interrupted with Ctrl-C, exit 1. See incident below |
| `Get-ChildItem -LiteralPath node_modules -Force \| Measure-Object`; `Test-Path node_modules/express/package.json`; `Test-Path node_modules/supertest/package.json` | 90 directory entries remained; both package files absent, confirming interrupted-install impact |
| `Get-ChildItem -LiteralPath 'C:\Users\hp\Desktop\Application Docs\Projects\KNEC_DIGITAL_ASS' -Name` | Read parent-directory names; exit 0 |
| Escalated PowerShell script with `$ErrorActionPreference = 'Stop'`, `New-Item`, `Copy-Item`, `Set-Location`, then `npm ci` | Created persistent isolated copy below; install succeeded, exit 0 |
| Inline Node manifest-byte comparison, `fs.cpSync` with `force:false`, and recursive dependency-file comparison | Restored missing generated files; 1,101 files matched isolated install; zero mismatches; exit 0 |
| `npm test` in persistent isolated copy | 77 passed, zero failed; exit 0 |
| `npm run validate-kb` in persistent isolated copy | Seven files passed; exit 0 |
| `git diff --check` | Exit 0; CRLF-to-LF notices only |
| `git diff --stat`; `git diff -- package.json package-lock.json .github/workflows/ci.yml` | Reviewed tracked changes and identified inherited differences; exit 0 |
| Final inline Node SHA-256 scan/comparison | 52 project files; 13 approved changed, one approved added, zero deleted |
| `rg -n --hidden -g '!node_modules/**' -g '!.git/**' '(BEGIN .*PRIVATE KEY\|EA[A-Za-z0-9]{40,}\|SK[0-9a-fA-F]{32}\|AIza[A-Za-z0-9_-]{30,}\|gh[pousr]_[A-Za-z0-9]{20,})' .` | No matches for these secret patterns; heuristic scan, not a guarantee |
| `Get-ChildItem -Force -Name .env*` | Only `.env.example` present |
| `npm test` in restored working folder | 77 passed, zero failed; exit 0 |
| Official documentation web reads | Consulted sources linked in the plan and README; initial `/docs/whatsapp/pricing` lookup failed, correct public pricing page used |

Tests requiring localhost sockets used approved elevated execution after sandbox restrictions were established. All servers were fake local test servers; no WhatsApp provider messages were sent.

Persistent isolated copy retained for review:
`C:\Users\hp\AppData\Local\Temp\knec-phase4-ci-6d184385a54c4292bebc09ba68b4ed00`

### Install incident and recovery

The clean-install attempt was intended to run only in a temporary copy. The sandbox temporary path was inaccessible on a later tool call. A failed `Set-Location` did not stop PowerShell, so `npm ci` started in the main working folder. It was interrupted immediately after the failure was observed, but it had already removed generated dependency files.

Recovery used a successful fresh locked installation in a persistent temporary directory. Manifest bytes matched the working folder. Missing dependency files were copied back with overwrite disabled; all 1,101 dependency files then matched that clean installation, and all 77 tests passed again in the working folder. This restores the locked dependency contents, not original filesystem timestamps. The mistake is recorded explicitly: the working folder's generated dependencies were affected even though project-source file boundaries were preserved.

No cleanup/deletion command was used. No commit, push, deployment, active-provider change, Twilio implementation, account modification, cost-bearing messaging call or Phase 5 feature was performed.

### Remaining limitations

- Remote CI was edited but has not been run on GitHub.
- Automated coverage does not prove live provider interoperability.
- Log filtering cannot identify arbitrary renamed/encoded private text; static labels and selected metadata remain required. Operational IP/identifier retention still needs review.
- Current processing has no durable queue, deduplication or delivery tracking; these remain future design decisions.
- The KB validator establishes required fields only, not factual correctness or complete schema compliance.
- The isolated installation remains on disk for review; it was not deleted.
