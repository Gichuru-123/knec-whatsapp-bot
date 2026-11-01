# Phase 4 controlled Sandbox runbook

Status: **not activated**. Complete implementation verification and review before the live demonstration. The owner must approve the exact account, recipient, HTTPS ingress and one-attempt budget.

## Prepare

1. Confirm the KNEC development subaccount and joined test phone privately. Preserve the apartment application's account and webhook.
2. Start the dedicated PostgreSQL instance. Run migrations explicitly with the migration role, then verify runtime permissions. See [database operations](database-operations.md).
3. Review synthetic test results, known limitations and the exact code revision. Verify a backup restored into an isolated database.
4. Select HTTPS ingress and exact proxy hops. Sandbox binds to loopback. No tunnel is selected or started by this runbook.

## Private configuration

Set NODE_ENV=development, WHATSAPP_PROVIDER=twilio, TWILIO_MODE=sandbox, TWILIO_DELIVERY_ENABLED=true, and ENABLE_DEV_INSPECTION_ROUTES=false. Supply the correct Twilio subaccount credentials, sender, single test recipient and exact signing URLs. Supply DATABASE_URL for the restricted runtime role, a separate random 32-byte identity key encoded as 64 hexadecimal characters, its version and a new run UUID.

Keep TWILIO_LIVE_SEND_ENABLED=false and TWILIO_SANDBOX_MAX_ATTEMPTS=0 until activation is approved. Stored run budgets are immutable: an approved one-attempt run uses a new UUID, cap 1 and explicitly enabled sending. Every submission consumes budget, including uncertain/rejected outcomes. Never paste credentials into chat or commit them.

- Inbound: POST `/api/v1/webhook/twilio/whatsapp`
- Status: POST `/api/v1/webhook/twilio/status`

Start with `npm start` after supplying private configuration. Change the KNEC Sandbox webhook only when startup and ingress checks pass. Keep the apartment webhook unchanged.

## Demonstrate

Send one harmless text from the permitted phone. Expected flow: validated event, durable receipt and job, empty TwiML acknowledgement, reserved attempt, fixed diagnostic reply, recorded provider SID and delivery callbacks. Confirm physical receipt on the phone. API acceptance alone does not establish handset delivery.

`npm run delivery:status` reads sanitized job counts using DATABASE_URL. Uncertain attempts are not resent automatically. Investigate a known SID in Twilio Console; never guess identity from approximate timestamps.

## Stop and document

Stop the worker/application and ingress. Disable sending. Agree whether to restore the KNEC demo webhook. Record date, code revision, attempt cap, sanitized callback outcome and phone receipt confirmation. Exclude credentials, full phone numbers and message bodies from evidence.

Close the run using the reviewed store closeRun operation after dispatch has stopped. Cleanup becomes eligible after seven days and preserves its closed-run tombstone. These operator invocations must be reviewed in the activation steps; no public administration route exists.

Request Phase 4 sign-off after evidence review. Knowledge-base expansion follows that acceptance.
