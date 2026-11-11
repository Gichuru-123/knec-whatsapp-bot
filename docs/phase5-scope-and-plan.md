# KNEC Digital Assistant — Phase 5 Scope and Implementation Plan

## Purpose

Phase 5 is the conversation-engine phase. Its purpose is to turn the WhatsApp foundation into a controlled, structured assistant that guides a user from a request to the correct approved KNEC information.

## 1. Finalize the menu architecture

The menu will contain stable branches for:

- Registration
- Certificates and certification
- Verification and confirmation
- Queries, corrections and recovery
- QMIS and online services
- FAQs and general information
- Future departmental services

Each menu item will have a permanent identifier. This allows the system to track the user’s location, connect the item to the knowledge base and change wording later without breaking the architecture.

## 2. Add structured conversation state

The system will remember where each user is in the menu.

The state will contain:

- Current menu node
- Previous navigation path
- Conversation version
- Invalid-attempt counter
- Selected examination
- Selected service
- Audience type where needed
- Year or examination series where needed
- Clarification details still required

The state will survive process restarts through PostgreSQL and expire after an agreed period so abandoned conversations do not remain active forever.

## 3. Add PostgreSQL session persistence

A dedicated conversation-session table will store the menu state separately from delivery records.

It will support:

- User or conversation identity
- Provider and account binding
- Current state JSON
- State version
- Last activity timestamp
- Expiry timestamp
- Concurrency protection
- Safe session reset
- Audit metadata without storing unnecessary message content

The database will prevent duplicate webhook deliveries from overwriting each other incorrectly.

## 4. Connect the menu to the authenticated webhook

The conversation flow will be:

```text
WhatsApp message
        ↓
Provider authentication
        ↓
Message normalization
        ↓
Duplicate-event protection
        ↓
Load conversation session
        ↓
Run menu transition
        ↓
Persist new state
        ↓
Create outbound response job
        ↓
Send through delivery safeguards
```

The conversation engine will not process unauthenticated messages.

## 5. Create a WhatsApp response renderer

The navigation engine produces semantic responses such as:

- Show menu
- Show help
- Invalid selection
- Escalate to support
- Ask a clarification question
- Retrieve approved knowledge
- Show a future-service placeholder

A separate renderer will convert these semantic responses into WhatsApp-safe text. It will handle message length limits, numbered menus, clear instructions, consistent commands, safe links, contact information and future language support.

The navigation engine will remain independent of Twilio.

## 6. Add clarification flows

Many KNEC questions cannot be answered safely from one sentence. For example, “I need a certificate” may mean a replacement certificate, a certificate that was never received, confirmation of results, a correction request or an examination-record query.

The engine will ask controlled follow-up questions such as:

- Which examination?
- Which year or series?
- Are you a candidate, parent or institution?
- Is this a replacement, confirmation, amendment or query?
- Which programme or qualification applies?

These questions will be represented as structured states instead of improvised text.

## 7. Connect menu leaves to the approved knowledge base

A menu choice will produce a knowledge lookup request containing context such as article ID, examination, year, audience, programme or series and language.

The knowledge-base policy will return information only when the article is approved, public, current, context-matched and supported by valid sources with no unresolved blocking question.

If those conditions are not met, the assistant will ask for clarification or escalate. It will not answer from draft content.

## 8. Add procedure guidance safely

The knowledge base contains procedure plans, but they are not automatically executable.

For each procedure, Phase 5 will define:

- Entry conditions
- Required clarifications
- Ordered steps
- Documents or information needed
- Stop conditions
- Escalation conditions
- Source citations
- Currentness requirements

The assistant will guide users step by step only after the procedure content passes the approval gate.

## 9. Add support and escalation handling

The assistant will recognize `HELP`, `BACK`, `MAIN MENU`, `HUMAN`, repeated invalid selections, unsupported requests and missing or conflicting information.

The support path will use verified KNEC contact information recorded in the knowledge base, while avoiding unsupported claims about service hours or WhatsApp availability.

## 10. Add duplicate and retry safety

WhatsApp providers may retry webhooks. Phase 5 will ensure that:

- The same inbound event is not processed twice
- A duplicate does not create two replies
- A session update is not lost
- A response job is tied to the correct conversation
- A provider timeout does not make the user’s state inconsistent

This will work together with the Phase 4 delivery safeguards.

## 11. Add offline end-to-end tests

Before using the live sandbox, tests will cover:

- Root and deep menu navigation
- Back and restart behavior
- Invalid-input fallback
- Session expiry
- Concurrent state updates
- Duplicate inbound messages
- Approved-answer lookup
- Draft-answer rejection
- Missing-article handling
- Procedure clarification
- Webhook-to-response-job flow
- Delivery failure and retry behavior

The tests will use fake provider transport and synthetic users.

## 12. Add operational documentation

The Phase 5 documentation will explain the menu tree, identifiers, state model, database tables, webhook flow, response types, knowledge lookup rules, escalation behavior, restart recovery, testing commands and presentation demonstration steps.

It will also clearly distinguish what is implemented from what is still pending.

## 13. Keep the LLM behind the controls

An LLM may later help understand free-text questions or phrase approved answers. It will not be allowed to invent KNEC procedures, bypass menu state, read draft articles as public answers, ignore year or examination context, make unsupported claims or send messages directly without the delivery layer.

## Completion definition

Phase 5 will be complete when the assistant can receive an authenticated WhatsApp message, maintain a durable conversation session, guide the user through a structured menu, ask necessary clarifying questions, retrieve only approved information, create a safe outbound response and handle retries or interruptions consistently.

## Current position

The project currently has the menu-navigation foundation, polished WhatsApp text renderer, PostgreSQL session foundation, conversation application service, idempotent event boundary, durable response outbox and offline authenticated webhook lifecycle. The implemented controls include a validated 44-node tree, descriptions, breadcrumbs, commands, versioned state, safe fallback, knowledge hooks, expiry, private identities, atomic processing, one-job-per-event constraints, leased worker claims, uncertainty preservation, callback reconciliation and bounded retention. A signed duplicate webhook produces one transition and one fake send; unsupported media produces none; persistence failure is not acknowledged as success. The next checkpoint is an independent review of this complete offline slice before development-database migration or Sandbox activation.
