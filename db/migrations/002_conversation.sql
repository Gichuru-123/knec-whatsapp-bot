CREATE SCHEMA conversation;

CREATE TABLE conversation.sessions (
  conversation_id text PRIMARY KEY CHECK (conversation_id ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON conversation.sessions(expires_at);

CREATE TABLE conversation.events (
  conversation_id text NOT NULL REFERENCES conversation.sessions(conversation_id) ON DELETE CASCADE,
  event_id text NOT NULL CHECK (event_id ~ '^[0-9a-f]{64}$'),
  session_revision integer NOT NULL CHECK (session_revision > 0),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (conversation_id, event_id),
  UNIQUE (conversation_id, session_revision)
);
CREATE INDEX events_created ON conversation.events(created_at);

CREATE TABLE conversation.outbox (
  id uuid PRIMARY KEY,
  account_sid text NOT NULL CHECK (account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  conversation_id text NOT NULL,
  event_id text NOT NULL,
  session_revision integer NOT NULL CHECK (session_revision > 0),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1600),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  eligible_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  claim_owner uuid,
  claim_token uuid,
  lease_until timestamptz,
  provider_sid text CHECK (provider_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  provider_status text CHECK (provider_status IN ('accepted','scheduled','canceled','queued','sending','sent','delivered','undelivered','failed','read','unknown')),
  outcome text CHECK (outcome IN ('accepted','failed','uncertain','lease_expired')),
  review_required boolean NOT NULL DEFAULT false,
  UNIQUE (account_sid, provider_sid),
  UNIQUE (conversation_id, event_id),
  CHECK ((state = 'sending') = (claim_owner IS NOT NULL AND claim_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((state = 'accepted') = (provider_sid IS NOT NULL AND provider_status IS NOT NULL)),
  FOREIGN KEY (conversation_id, event_id) REFERENCES conversation.events(conversation_id, event_id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id, session_revision) REFERENCES conversation.events(conversation_id, session_revision)
);
CREATE INDEX outbox_pending ON conversation.outbox(eligible_at,created_at) WHERE state = 'pending';
CREATE INDEX outbox_expired_lease ON conversation.outbox(lease_until) WHERE state = 'sending';

CREATE TABLE conversation.callbacks (
  account_sid text NOT NULL CHECK (account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  message_sid text NOT NULL CHECK (message_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  status text NOT NULL CHECK (status IN ('accepted','scheduled','canceled','queued','sending','sent','delivered','undelivered','failed','read','unknown')),
  error_code bigint NOT NULL DEFAULT -1 CHECK (error_code >= -1),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_sid,message_sid,status,error_code)
);
CREATE INDEX conversation_callbacks_received ON conversation.callbacks(received_at);
