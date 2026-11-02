# Phase 4 controlled WhatsApp demonstration evidence

Date: **2026-11-02**, Africa/Nairobi. Status: **live round trip demonstrated; owner Phase 4 sign-off approved on 2026-11-03**.

## Scope and code

The owner approved one outbound attempt through the KNEC development Twilio Sandbox and the already configured test phone. The diagnostic reply made no claim to process a KNEC service request. No knowledge-base answer, menu or departmental workflow was exercised.

Code revision: `b13c3f7e7775ddbf22624c433cdf432af6421f66`, merged through [PR #4](https://github.com/Gichuru-123/knec-whatsapp-bot/pull/4). [Post-merge CI passed](https://github.com/Gichuru-123/knec-whatsapp-bot/actions/runs/41321217391). Earlier local and isolated fresh-install verification passed 109 tests; the final 2026-10-31 dependency audit reported zero advisories.

## Preparation evidence

- Read-only Twilio account verification confirmed an active subaccount named **KNEC Digital Assistant - Development**.
- PostgreSQL 18.6 was available on the dedicated loopback endpoint. The application used its restricted runtime role.
- The private Sandbox file was verified as Git-ignored. Phone formatting was corrected without changing the supplied number digits. No credentials or full phone numbers are recorded here.
- Readiness started with sending disabled and a persisted zero-attempt budget. Local and ngrok HTTPS health endpoints returned 200 with UP status.
- Both public webhook endpoints rejected unsigned POST requests with 401. Ngrok request inspection was disabled.
- The owner reported saving the exact inbound and status URLs in the KNEC Sandbox, then explicitly approved one live attempt.
- The zero-budget run was closed. A new run was initialized with an immutable one-attempt cap and an unused budget before the owner was asked to send.

## Observed exchange

Run reference: `63eaff5e-2054-4615-813d-2ec1b2315470` (an internal run identifier, not a credential).

| Observation | Evidence |
| --- | --- |
| Authenticated incoming message | One persisted receipt; inbound route returned HTTP 200 at approximately 19:19:33 EAT |
| Durable reply processing | One job and one reserved/submitted attempt; stored outcome accepted |
| Provider identifier | Recorded in the private database; omitted from this report |
| Handset receipt | Owner explicitly reported receiving the diagnostic reply |
| Provider callbacks | Three callbacks: sent, read, delivered; each route response was HTTP 204 around 19:19:38 EAT |
| Exact correlation | All three events joined to the job on account and provider message identifier |
| Out-of-order reconciliation | Read arrived before delivered; final stored status remained read |
| Conflict detection | review_required was false |
| Budget | Exactly 1 used attempt out of 1 permitted attempt |

This demonstrates an actual phone → Twilio → authenticated backend → PostgreSQL → delivery worker → Twilio → phone exchange. It is not an inference from synthetic tests alone. Exact provider SIDs remain available privately for troubleshooting.

## Shutdown evidence

- The application process was stopped.
- TWILIO_LIVE_SEND_ENABLED was restored to false in the ignored local settings.
- The completed run was explicitly closed; its one-attempt cap and used budget were retained.
- Only the KNEC test ngrok process was stopped.
- A final listener check found no listeners on ports 3000 or 4040.
- No apartment-project webhook or account setting was changed by the assistant.

The KNEC Sandbox webhook settings were not restored automatically; they still refer to the test endpoint last saved by the owner. That endpoint is offline after tunnel shutdown. Do not send additional test messages until a new run is explicitly prepared. Any decision to restore Twilio's demo reply should be made separately with the owner.

Retain minimal run evidence for the approved seven-day retention period after closure. The implemented cleanup operation preserves the closed-run tombstone. No cleanup or ongoing scheduled task was started by this demonstration.

## What this establishes and what remains

The controlled Phase 4 channel demonstration succeeded. Authentication, durable acceptance, one-attempt dispatch, physical receipt and correlated status persistence were observed together. Duplicate, retry and failure behavior is supported by the previously recorded synthetic checks; those failure cases were not deliberately triggered against the paid/trial provider.

This is not production onboarding, institutional endorsement, a capacity certification or a completed knowledge service. The next agreed work is to expand and verify the knowledge base from official KNEC QMIS and service-charter sources, before later menu/conversation and content-integration work.

**Owner sign-off, 2026-11-03:** the owner approved closing Phase 4 against this evidence and publishing the documentation update. The next agreed stage is the official KNEC knowledge-base review. This sign-off covers the development channel scope; merge approval and production readiness remain separate.
