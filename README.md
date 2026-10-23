# KNEC Digital Assistant WhatsApp Bot

A public-information prototype intended for future review by the Kenya National Examinations Council. This repository does not establish KNEC endorsement or access to internal candidate records.

## Current scope

The Phase 3 foundation loads seven JSON knowledge-base articles, indexes them by ID and category, and freezes article objects. Phase 4 provides Meta and mock messaging adapters, webhook authentication, request limits and an inbound handoff stub.

Incoming messages currently stop at the stub; there is no automatic reply, menu engine or conversation state. Twilio integration is planned in [the Phase 4 Twilio plan](docs/phase4-twilio-plan.md), not implemented. No live provider connection has been demonstrated by the automated tests.

The knowledge-base validator checks required fields, not a full JSON schema or factual accuracy. Startup validation is narrower still. Six articles are labelled unverified and one verified_domain; those labels do not establish approved public guidance.

## Runtime and installation

Use **Node.js 24.x**. The manifest, lockfile root metadata and CI target the same major version. Node 24 is listed as LTS by the [official release schedule](https://nodejs.org/en/about/previous-releases), checked on 2026-10-19. Node 18 and 20 are end-of-life. Keep the Node 24 patch release maintained; this repair was tested locally on 24.18.0.

In PowerShell, use the actual project directory:

```powershell
Set-Location 'C:\Users\hp\Desktop\Application Docs\Projects\KNEC_DIGITAL_ASS\knec-whatsapp-bot'
```

Check the runtime:

```powershell
node --version
```

Expected: a version beginning with v24.

For a **fresh checkout or isolated test copy**, install the exact locked dependencies:

```powershell
npm ci
```

Expected: successful installation with exit code 0. This command replaces node_modules if it exists; do not use it to experiment on an existing working folder without approval. The repair verification uses a separate temporary copy. Dependency versions were not upgraded by this repair.

CI uses Node 24 and current [checkout](https://github.com/actions/checkout) / [setup-node](https://github.com/actions/setup-node) actions, whose documented runtime supports Node 24. A local test run does not prove the GitHub workflow has run.

## Local configuration

If .env does not exist, create it in VS Code using .env.example as the starting content. Preserve any existing .env. The repository ignores .env and .env.* except .env.example.

Keep secrets only in the private .env or the runtime's secret store. Never paste them into chat, source, test fixtures, logs or screenshots. Automated tests preload synthetic settings, set NODE_ENV=test and do not load .env.

| Setting | Behavior |
| --- | --- |
| NODE_ENV | development, test or production; defaults to development |
| WHATSAPP_PROVIDER | Explicit meta or mock required; missing/unknown values stop startup |
| WHATSAPP_VERIFY_TOKEN | Required for the current providers; choose a private random value, never a test fixture |
| WHATSAPP_APP_SECRET | Required for meta |
| WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID | Required to send with Meta; also required at production startup |
| META_GRAPH_API_VERSION | Required for meta; no built-in version; check [Meta's version information](https://developers.facebook.com/docs/graph-api/changelog/versions/) before live use |
| META_REQUEST_TIMEOUT_MS | Defaults to 10000; whole number 100 through 2147483647; covers headers and body consumption |
| ENABLE_DEV_INSPECTION_ROUTES | Defaults to false; true only in development/test, rejected in production |
| TRUST_PROXY_HOPS | Whole number 0 through 10; defaults to 0 |
| WEBHOOK_BODY_LIMIT | Defaults to 100kb; positive whole size using b, kb or mb |
| WEBHOOK_RATE_LIMIT_WINDOW_MS | Defaults to 60000; whole number 1000 through 2147483647 |
| WEBHOOK_RATE_LIMIT_MAX | Defaults to 100; positive safe integer |
| PORT | Defaults to 3000; whole number 1 through 65535 |
| LOG_LEVEL | debug, info, warn or error; defaults to info |
| ALLOWED_ORIGINS | Comma-separated browser origins; defaults to http://localhost:3000 |

Numeric values cannot contain spaces, decimal fractions or trailing text. Known public placeholders are rejected; production also rejects test/example credential markers. This validation cannot establish that a credential is genuine or sufficiently strong.

For local work, keep the example's explicit mock provider, set your own verification token, and leave inspection disabled. Mock accepts unsigned events and is restricted to development/test. Do not expose mock mode through a public tunnel.

Inspection is an unauthenticated local diagnostic tool. Never enable it during public testing. Development rejects inspection=true together with positive TRUST_PROXY_HOPS; tests may simulate proxies. The flag cannot detect every possible network exposure, so restrict the listening port as well.

A tunnel or proxy requires its actual hop count; over-trusting forwarded headers lets clients influence rate-limit identity. No provider or tunnel settings are changed automatically.

After configuration, starting locally is a separate deliberate action:

```powershell
npm start
```

Expected: KB startup and a listening-port message. Missing required configuration stops startup. This command alone does not test WhatsApp connectivity.

## Routes and message processing

| Route | Current behavior |
| --- | --- |
| GET /health | Process health, timestamp and uptime |
| GET /api/v1/kb and /api/v1/kb/:id | Inspection only; 403 unless explicitly enabled |
| GET /api/v1/webhook/whatsapp | Meta-style verification challenge, returned as plain text |
| POST /api/v1/webhook/whatsapp | Rate limit, read bounded raw JSON, authenticate, parse, normalize and hand off |

Meta authentication uses x-hub-signature-256 on the received body bytes before JSON parsing. Invalid signatures return 401; signed malformed JSON returns 400; excessive bodies return 413; excessive request rates return 429. Other JSON routes have a 10kb body limit.

Meta batches retain valid messages after malformed individual messages. Delivery/status events remain ignored. The mock provider accepts its own senderPhone/textBody fixture format, not the Meta envelope.

Outbound Meta sending uses an abort deadline covering both fetch and response-body parsing. HTTP failures discard provider response bodies; transport and JSON failures use fixed messages without the original cause. This method exists but is not called by the current inbound stub.

## Privacy and error contract

The central error handler returns standard HTTP messages without exception text or stacks in every environment, including development tunnels. Logger child context is sanitized recursively; errors, payload/message fields and configured secrets are redacted. Existing handoff masks retain only the last three phone digits. Raw query values are excluded from request logs.

Use static event labels and deliberately selected metadata when adding logging. Never interpolate user messages, entire requests or provider responses into a log label. Redaction is additional protection, not a general detector for arbitrarily renamed or encoded private data. Full IP addresses and event IDs remain in operational logs; retention and access controls require review before production.

## Tests and validation

### Engineering checks and detailed guides

From the repository directory, run `npm run check` to perform JavaScript linting, current-file secret scanning, KB required-field validation and the existing tests in sequence. Install the locked development dependencies with `npm ci --ignore-scripts` in a new checkout. The checks require Node 24 and Git; application tests require localhost access.

- [Engineering-controls guide](docs/engineering-controls.md): exact tool versions, commands, failure handling, scanner limitations and review evidence.
- [Presentation and revision guide](docs/presentation-guide.md): phase status, architecture explanation, speaking notes, demonstration steps and likely questions.

The scanner checks current files, including eligible untracked work; it does not audit Git history or staged-only snapshots. Linting does not apply automatic formatting. Review the staged diff before any approved commit. The owner approved publishing these controls and opening a pull request on 2026-10-22; see the guide for the dated record and the pull request for subsequent remote checks. Merge approval remains separate.

### Existing application and knowledge-base checks

Run one command at a time from the project directory and inspect its actual output.

```powershell
npm test
```

Expected: zero failures. Tests use synthetic credentials and fake localhost HTTP servers, including responses that stall after headers. No test contacts Meta or Twilio.

```powershell
npm run validate-kb
```

Expected: seven files pass the existing required-field validator. Its wording about verification is structural only, not a factual endorsement.

## Remaining limitations and approval gates

- No durable queue, duplicate suppression, delivery tracking, shared rate-limit store or automatic retry recovery.
- Rate limits are process-local and reset on restart. Provider traffic may share source IPs.
- No factual KB verification, full schema enforcement or publication gate.
- No live integration evidence, production sender registration or institutional approval.
- No menu/state engine, candidate authentication, private record access, GA automation, LLM, RAG, embeddings or vector database.
- Commits, pushes, deployment, live messages, costs and subsequent phases each require the owner's explicit approval.

The Phase 4 baseline has been merged through PR #1. Publication of the engineering-controls change is approved; the next gate is review of its pull request and CI results before a separately approved merge. A bounded offline Twilio implementation and a later controlled Sandbox exchange require their own approvals. Phase 4 remains in progress.
