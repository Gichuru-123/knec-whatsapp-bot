# Phase 5 Conversation Foundation

## Purpose

Phase 5 introduces the deterministic navigation layer for the KNEC Digital Assistant. It is the part that decides where a user is in the menu and what the next safe interaction should be. It does not yet send WhatsApp replies, persist sessions, or publish knowledge-base answers.

That separation is deliberate. The menu must remain testable and predictable before it is connected to PostgreSQL, Twilio, or an LLM. A menu selection can therefore produce a semantic `knowledge_lookup` hook without pretending that a draft article is approved public guidance.

## Current implementation

The navigation core is in `src/services/conversation/navigation.js`. The menu definition is in `src/services/conversation/config/menuTree.js`, and the tree validator/index is in `src/services/conversation/config/menuIndex.js`.

The current tree contains 44 validated nodes beneath the root menu:

- Registration, including national and business/technical examination branches.
- Certificates and certification.
- Verification and confirmation.
- Queries, corrections and recovery.
- QMIS and online services.
- FAQs and general information.
- General Administration as an explicit future-phase placeholder.

Each menu node has a stable identifier. Menu nodes may contain child menus; leaf nodes are either a knowledge hook or a placeholder. The index rejects duplicate IDs, empty menus, invalid node types, missing knowledge article IDs and broken placeholder targets at startup/test time.

## State contract

The persisted conversation state is intentionally small and versioned:

```json
{
  "version": 1,
  "currentNodeId": "registration",
  "path": ["root", "registration"],
  "invalidAttempts": 0
}
```

`path` is the complete route from `root` to the current menu. Every state is validated before it is used, including parent-child relationships and the invalid-attempt counter. This prevents a client or stale record from selecting an arbitrary node.

The navigation function remains independent of storage. PostgreSQL migration 002 adds `conversation.sessions`, and `ConversationSessionStore` persists this exact versioned shape with expiry and optimistic concurrency control. Only approved state fields are written; arbitrary message text and extra object fields are discarded.

A monotonically increasing revision protects updates. A writer must supply the revision it read, so two workers processing the same state cannot both overwrite it. An expired record keeps its revision and may be restarted only through an explicit reset operation; the application service starts from the root before applying the new input. This prevents an ordinary stale update from reviving old navigation.

Conversation events use a keyed fingerprint derived from the provider account and message identity, so raw inbound provider IDs are not stored in the conversation schema. State, event and semantic response are committed in one transaction under a conversation-scoped database lock. Concurrent delivery of the same event produces one transition; later copies return the stored result with a duplicate marker. Bounded cleanup deletes sessions only after a configured post-expiry retention period, cascading their event records. Cleanup refuses to delete a session while any response is pending, sending, uncertain or marked for manual review, preserving unresolved delivery evidence.

The same transaction now creates a `conversation.outbox` job containing the exact rendered response. A database constraint binds one job to one event and session revision. Workers claim jobs with a lease and recheck ownership immediately before sending. Only one worker can claim a job; invalid output rolls back the session, event and job together. Provider acceptance is recorded once. A send exception or expired sending lease becomes `uncertain` and is never automatically resent because the provider may already have accepted it.

`conversationRuntime.js` now provides the offline webhook coordinator. The existing authenticated Twilio controller delegates to it only when the application explicitly installs a Phase 5 runtime. It normalizes the signed event, enforces the configured participant, derives private conversation/event identities, commits the event/session/outbox transaction, and then permits an empty TwiML acknowledgement. Unsupported media creates no conversation record. A persistence failure returns a controlled service error before acknowledgement.

Account-scoped status callbacks are journalled and reconciled with outbox jobs. A callback may arrive before provider acceptance is recorded; reconciliation runs both when the callback arrives and when the worker finishes. Later low-rank statuses do not regress `delivered` or `read`. Conflicting success/failure outcomes and unknown/scheduled statuses set `review_required`. Old unmatched callback records are deleted only through bounded retention cleanup.

## Input and response contract

Inputs are trimmed, whitespace-normalized and lower-cased. They are limited to 200 characters. The core supports numbered selections and exact menu titles, plus these commands:

- `BACK` or `PREVIOUS` moves to the immediate parent.
- `MAIN MENU`, `MENU`, `MAIN` or `HOME` resets to the root.
- `HELP` returns the current menu and command guidance.

An invalid selection is allowed one retry. A second invalid selection returns a bounded fallback response with `escalationRequired: true`; it does not loop indefinitely or send an unapproved answer. Empty, non-string and oversized input follow the same safe path.

Responses are semantic objects (`menu`, `help`, `invalid`, `fallback`, `knowledge_lookup`, or `placeholder`). Rendering a WhatsApp message, selecting a language, retrieving an approved KB article, and sending a provider response belong to later adapters.

`responseRenderer.js` now provides the first WhatsApp-safe text presentation. The root menu includes short service descriptions, nested menus include a breadcrumb, and command hints change with the user’s location. The renderer enforces a conservative output-size ceiling and converts knowledge hooks into a neutral selection acknowledgement without publishing draft content. A later provider adapter may add approved interactive list or button controls while retaining this text format as the universal fallback.

`conversationService.js` is the application boundary between navigation and storage. It reads one session, applies one input to that exact state, and saves the new revision before returning the semantic response. New sessions start at root; expired sessions explicitly restart from root. A revision conflict returns `CONVERSATION_STATE_CONFLICT` and does not replay the input against a different menu, because the same number could have a different meaning there.

## Knowledge boundary

A leaf currently returns a hook containing its stable article ID. The hook is not an answer. Phase 6 must call the existing approved-answer policy with the user’s examination, audience, language and year context. If no current approved article matches, the runtime must return a controlled clarification or escalation response. It must never fall back to draft KB records or raw source text.

## What remains before live menu use

1. Review the complete Phase 5 offline diff, migration and test evidence before publication or Sandbox activation.
2. Add the provider capability adapter for interactive controls while retaining the verified text renderer as fallback.
3. Connect knowledge hooks to `kbService.getApprovedAnswer` and add clarification questions for unresolved procedure facts.
4. Package runtime startup configuration and operational shutdown/cleanup without enabling live sending by default.
5. After explicit activation approval, migrate the development database and run the controlled Sandbox menu test.

An LLM can later help classify free-text intent or phrase a verified answer, but it must sit behind this state machine and the approved-answer policy. It must not be allowed to invent a procedure, bypass a menu guard, or publish an unverified KB claim.

## Verification

The focused Phase 5 navigation suite is `tests/unit/conversationNavigation.test.js`. It covers tree validation, deep navigation, exact-title selection, commands, invalid-input fallback, corrupt-state rejection, placeholder behavior and the rule that knowledge hooks do not mutate the navigation path.

Run it with:

```text
node --test tests/unit/conversationNavigation.test.js
```

The PostgreSQL integration test also verifies reconstruction, competing writes, expiry and safe restart in `tests/integration/conversationSessionStore.test.js`. The full repository check requires the configured disposable PostgreSQL test instance.
