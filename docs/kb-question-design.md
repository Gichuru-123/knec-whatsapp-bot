# Question design and review guide

Checkpoint: 3 November 2026. The question bank is in `evaluation/kb/questions.json`; run `npm run kb:coverage` to validate its references and inspect remaining gaps.

## What the bank is for

The 112 examples describe how people may ask for help, including English, Kiswahili, mixed language, spelling variations, ambiguous requests and follow-up messages. They are authored examples, not real customer conversations or evidence of model accuracy. There are 64 development examples and 48 reserved examples. Keep the reserved set out of prompts, retrieval documents and tuning data. Because the split is small and manually authored, passing it will not establish production readiness.

## How a conversation should work

“How much?” needs clarification of the service, examination and relevant year. “I lost my certificate” needs the certification route, while “My employer wants confirmation” needs the confirmation route. “My name is wrong” must distinguish a recording error from a legal name change; the assistant must not infer eligibility. A follow-up such as “How long?” must retain the preceding service context while checking whether its timing evidence is approved and consistent.

An answer requires applicable, approved claims with source citations. A sourced paragraph does not authorize a transaction: the bot cannot claim to register a candidate, approve an application, fetch personal results or submit a complaint unless a separately authorized integration actually performs that action. Unknown fees, conflicting deadlines and unsupported exceptions must result in clarification or escalation, not invented guidance.

## Review each example

1. Confirm the intended service and any examination, year, programme or audience constraints.
2. Review the expected action: answer with evidence, clarify, escalate, fall back, decline an action, or identify an out-of-scope request.
3. For factual answers, add all necessary `article-id:claim-id` references to `required_claim_ids`. Empty evidence lists remain unfinished labels, not passing retrieval tests.
4. Have a fluent reviewer check Kiswahili and mixed-language questions and future responses.
5. Check prohibited outcomes, including invented charges, unsupported processing promises, requests for passwords, and claims of access to personal records.
6. Use fresh independently written examples before release, including multi-turn corrections and questions from actual approved service staff.

## Measuring the future engine

When Phase 5 exists, record routing accuracy, clarification quality, evidence retrieval, citation correctness, scope/date compliance and refusal/escalation behavior separately. Count a missing supported answer as a coverage defect; count an unsupported confident answer as a grounding failure. Report results by service and language, not only one average. Never silently discard failing examples.

The current validator checks references, labels, duplicate cases and service representation. It does not execute a conversational engine or judge factual correctness. The coverage report lists unresolved work explicitly. All current articles remain drafts.

## Contact handling

The general support record includes 0719093000, independently corroborated by the official KNEC contact page, which labels it “Switch Board.” It also records the published email and office location. Do not infer opening hours, free calls or WhatsApp support. Department-specific contacts must be added with evidence and service scope when available.
