# Phase 4 completion plan

Prepared: **2026-10-25**. Status: completion scope and sequence for owner review; no new runtime implementation or live connection is claimed.

## Decision and starting point

The owner requested that Phase 4 be finished before returning to knowledge-base improvements. The owner initially confirmed that a Twilio account existed but the WhatsApp Sandbox needed setup. The update below records subsequent progress.

**2026-10-25 setup update:** the owner reports selecting a KNEC development subaccount and successfully joining its Sandbox from their test phone. The reported inbound URL is a Twilio-hosted demo reply and the status callback is blank. The apartment application's webhook remains separate. Backend connection and live application sending have not been demonstrated.

The next bounded proposal is now available: [delivery safeguards and Sandbox readiness work order](phase4-delivery-work-order.md). It specifies storage, identity, retries, callbacks, exact files and verification for implementation approval.

PR #3 merged the offline Twilio foundation into `main` at `34b41770fab23137af42ae9a696b163babaf609c`. [Post-merge CI](https://github.com/Gichuru-123/knec-whatsapp-bot/actions/runs/40105796167) passed. The recorded suite has 97 tests. Twilio is currently restricted to `NODE_ENV=test`, default sending is disabled, and inbound processing ends at a logging handoff.

This plan follows the supplied master roadmap's Phase 4 description on page 6 and gate on page 12: demonstrate a sandbox inbound message and successful outbound reply, with authentication, validation, rate limits, basic failure handling and a conversation identifier. Production onboarding is a later milestone.

## PostgreSQL decision — 2026-10-26

The owner approved PostgreSQL as the durable shared database direction. The revised delivery work order replaces the unimplemented SQLite proposal with 38 paths covering migrations, database-backed verification, CI and operating documentation. This planning update does not claim a database or runtime implementation. The initial Sandbox dispatcher remains bounded; future instances build on the shared transaction model.

## Fixed completion criteria

| Requirement | Existing evidence | Evidence still needed to close Phase 4 |
| --- | --- | --- |
| Inbound authentication and parsing | Synthetic signed forms, malformed input and provider-isolation tests pass | Actual Sandbox event authenticated with the configured external HTTPS URL |
| Outbound messaging | SDK request construction checked with an injected fake client | Reviewed real transport and one diagnostic reply received on the owner's allowed test phone |
| Conversation identity | Provider, message ID and sender normalized | A documented stable conversation key, separated from message IDs, with user/account isolation tests |
| Basic delivery and failure handling | Callback normalization and safe simulated errors | Persisted send outcome, callback correlation and a bounded policy for failed or uncertain attempts |
| Retry safety | No automatic retry in the offline slice | Explicit retry eligibility, attempt limit and delay; ambiguous provider acceptance must not cause a blind resend |
| Duplicate/restart behavior | Not implemented | Duplicate event creates no extra reply job; accepted work survives restart; interrupted sends become a visible uncertain state when appropriate |
| Rate limits and privacy | Local tests pass | Existing protections retained in Sandbox mode; no public diagnostic routes, message-body logs or exposed credentials |
| End-to-end acceptance | Not yet demonstrated | Dated, sanitized round-trip evidence, delivery observation, known limitations and owner sign-off |

Phase 4 closes when these requirements have evidence and remaining limitations are explicitly reviewed. A green unit test suite alone does not close the Sandbox gate.

## Sequence

### 1. Prepare the existing Twilio test environment

- Identify whether the account uses the new or legacy Twilio Console.
- Official documentation currently directs legacy-console users to the WhatsApp Sandbox and new-console trial users to **Try out WhatsApp**. Follow the actual options available in the owner's account.
- The owner completes any account terms and connects their chosen test phone. Credentials and join information stay private.
- Record availability of a test sender and joined/connected phone without copying secrets into documentation.
- Do not configure a public webhook against the current test-only app. The runtime change and checked HTTPS endpoint come later in step 3.

Twilio states that the Sandbox is for testing, does not require a registered WhatsApp sender, and has account/session limitations. Messages may consume trial allowance or incur charges. The final exchange therefore needs a stated recipient and message budget; account creation alone is not spending approval. [Official Sandbox guidance](https://www.twilio.com/docs/whatsapp/sandbox).

### 2. Complete the bounded delivery-safety implementation offline

Prepare a concrete architecture and file-list work order covering:

1. **Conversation key:** provider/account/sender scope; distinct from the provider message SID; stable across messages and isolated between participants. Phase 5 can later attach navigation state to it.
2. **Acceptance and reply job:** atomically record an authenticated supported event and one fixed diagnostic reply job before acknowledging acceptance. Storage failure must not return a false successful acceptance.
3. **Duplicate control:** uniqueness based on provider/account/message SID, including concurrent arrivals. Define retention and the behavior after expiry; do not promise global exactly-once delivery.
4. **Outbound worker:** explicit pending/sending/accepted/failed/uncertain outcomes, bounded attempts, and recovery after process interruption. Provider acceptance is not handset delivery.
5. **Status callbacks:** match expected account and outbound message, tolerate repeat/out-of-order events, avoid regressing confirmed delivery, and record conflicts or unknown outcomes for review.
6. **Privacy and storage lifecycle:** choose the storage technology, minimal retained fields, database access controls, expiration/cleanup, and secret handling before introducing a database. A fixed diagnostic reply avoids persisting user text solely to echo it.
7. **Offline verification:** duplicate concurrency, restart recovery, safe retry eligibility, uncertain acceptance, callback order, user isolation, malformed input and regressions for all existing providers.

Persistent storage is an additional reliability choice within the proposed completion work, not an explicit database requirement in the original roadmap. The earlier approved offline work order reserved storage/schema decisions for a separate architecture and file-list approval. The implementation work order must make those decisions reviewable before storage code is added. The owner subsequently approved PostgreSQL on 2026-10-26; the revised work order specifies its driver and implementation boundaries.

### 3. Enable and demonstrate a controlled Sandbox exchange

After the delivery implementation is checked:

- Add an explicit restricted Sandbox runtime; preserve the offline test mode and keep production blocked.
- Audit the real SDK transport, including response handling, deadlines and uncertain acceptance. Do not assume a fake-client timeout demonstrates network cancellation.
- Configure sender, one recipient allowlist, signing URLs, disabled inspection routes, actual proxy trust and an explicit send limit.
- Review the chosen HTTPS ingress and actual URLs before configuring them in Twilio. Never derive the signing URL from arbitrary forwarded headers.
- Use a fixed diagnostic reply that identifies this as a test and makes no claim to provide KNEC services.
- With the owner's agreed account, phone and budget, send a harmless inbound message, observe one reply, and correlate the message SID with callback evidence.
- Exercise failure/replay cases offline; do not run bursts or repeated paid sends as a substitute for local tests.
- Record sanitized results, turn off live sending after the demonstration, and request Phase 4 acceptance.

Official callback guidance: [Track outbound message status](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status). A callback is evidence about a provider event; persistence and reconciliation are application responsibilities.

## Boundaries for this completion work

Knowledge-base articles, QMIS research/imports, service-charter content, menus, answer generation and departmental SOP integration remain deferred until Phase 4 is closed. A conversation identifier does not itself implement Phase 5 session/navigation state.

Production business-number registration, institutional endorsement, production hosting, multi-server scaling and a full departmental workflow platform are outside this Phase 4 finish line. Any expansion needs an explicit scope decision.

The unrelated existing local edit in `docs/phase2-knowledge-base-foundation.md` remains untouched. This checklist does not alter application code, test results, account settings, secrets, GitHub history or the private `.env`.

## Immediate information needed

- The owner has reached the legacy Sandbox and reports a successful phone join; reconfirm membership before the live test.
- Before live execution: the permitted recipient, agreed message budget and chosen HTTPS ingress.

Next step: review the revised PostgreSQL implementation scope, then implement and verify it before controlled live activation. A finish date cannot be substantiated before implementation checks and the approved real exchange succeed.


## Implementation checkpoint — 2026-10-31

PostgreSQL delivery code is implemented locally on `codex/phase4-delivery-safeguards`. An isolated fresh installation passed 109 tests plus lint, secret scanning and KB structure validation. Runtime-role permissions and a basic isolated backup/restore were verified. See the [detailed evidence and dependency advisory report](phase4-delivery-work-order.md#13-implementation-and-verification-checkpoint--2026-10-31).

A fresh audit reported seven affected dependency entries (one high, six moderate), arising from follow-redirects, qs and minimatch. Targeted security remediation scope is under owner review. No commit, push, merge, Twilio webhook change or live send was performed in this implementation slice. Phase 4 is not closed.

### Security repair update — 2026-10-31

The owner approved the targeted dependency repairs. Exact overrides now select follow-redirects 1.16.2, qs 6.16.1 and minimatch 11.0.1. The repaired working tree passes 109 tests and the lint/scanner/KB checks; the installation audit reports zero advisories. The separate fresh-install confirmation is recorded in the delivery work order. Previous advisory counts above describe the pre-repair snapshot.

**Final security verification, 2026-10-31:** the repaired fresh lockfile installation passed all 109 tests and all check stages; its final npm audit reported zero advisories. No commit/push or live send occurred.

## Live demonstration — 2026-11-02

The approved one-attempt Sandbox exchange succeeded on merged revision `b13c3f7`. The owner confirmed receiving the reply; PostgreSQL recorded one receipt, one attempt and three exactly correlated sent/read/delivered callbacks. Final delivery status was read with no review conflict. Sending is disabled, the run is closed and the tunnel/application are stopped.

See [the sanitized live evidence](phase4-live-evidence.md). The technical demonstration is complete. The owner approved Phase 4 sign-off and publication of this evidence on 2026-11-03. The Sandbox URLs still reference the stopped test endpoint.

## Owner acceptance — 2026-11-03

The owner approved closing the development channel scope of Phase 4 and publishing the evidence update. Next: official KNEC knowledge-base source review. Production onboarding and institutional acceptance remain separate.
