# Step-by-step guidance design

Prepared 4 November 2026. Three draft procedure plans are stored in `evaluation/kb/procedures.json`: certification, confirmation and equation. They are editorial inputs for Phase 5, not live WhatsApp flows. Run `node scripts/kb-procedures.js` to check their evidence references.

## What the user should experience

Begin with the user's goal and ask only the questions needed to select the right service and applicable requirements. Explain the overall journey briefly, then offer one manageable step at a time. A user can ask for the entire checklist or pause to ask about a document. Repeating “next” must not count as proof that an application was submitted or paid for.

For certification, the planned sequence is: identify the service; prepare documents; apply minor, modular and name-difference conditions; explain online submission; explain payment; handle the unresolved timing question; explain collection; offer support. Confirmation starts with the receiving institution and distinguishes certificate, module and stage charges. Equation starts with qualification eligibility and authentication before application and dispatch.

## Follow-ups and navigation

The future engine should retain the selected service, applicable examination/year, relevant branch and current step. “What documents?” returns to the checklist; “back” returns to the previous applicable step; “start over” clears the selected journey. “I don't have that document” invokes a sourced exception or offers clarification. Never invent a replacement document. A change of service or examination year requires rechecking applicability.

If a user asks about timing while preparing documents, answer only from consistent, approved timing evidence, then offer to resume the checklist. A conflict should stop that particular answer and offer assistance. It need not prevent a human reviewer from inspecting the other draft steps, but no draft plan is currently eligible for public use.

## Evidence and review

Every step records claim references, an applicability condition and a review gate where needed. Conditions are editorial prose; they are not executable branching logic. The validator catches missing references, duplicate step IDs and unresolved claims without a gate. It does not establish that the wording is complete, that the conditions cover every case, or that a source is still current.

Before implementation, review eligibility, exact document requirements, portal navigation, payment instructions, dispatch and collection. Approve content through the existing article governance process. Verify procedural wording separately and design a content-bound approval mechanism before any runtime loader can use these plans. Do not load this evaluation directory into public retrieval. Fluent reviewers must approve translated guidance.

## Boundaries

The assistant explains actions that the user takes in official systems. It must not claim an application status, payment success or institutional decision without an authorized integration supplying that evidence. It should not collect identity scans, passwords or payment credentials to provide general guidance. Help should remain available through the verified support contact.

Completion means the explanation has finished. It does not mean KNEC has completed the service. Current plans contain explicit review gates and remain drafts. The menu, session state, multilingual responses and live workflow execution belong to the forthcoming Phase 5 implementation.
