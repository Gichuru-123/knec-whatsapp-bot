CREATE SCHEMA delivery;

CREATE TABLE delivery.runs (
  id uuid PRIMARY KEY,
  account_sid text NOT NULL CHECK (account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  binding text NOT NULL CHECK (binding ~ '^[0-9a-f]{64}$'),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 0 AND 10),
  used_attempts integer NOT NULL DEFAULT 0 CHECK (used_attempts BETWEEN 0 AND max_attempts),
  receipt_count integer NOT NULL DEFAULT 0 CHECK (receipt_count BETWEEN 0 AND 1000),
  callback_count integer NOT NULL DEFAULT 0 CHECK (callback_count BETWEEN 0 AND 5000),
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  last_dispatch_at timestamptz,
  lease_owner uuid,
  lease_until timestamptz,
  lease_generation bigint NOT NULL DEFAULT 0,
  UNIQUE (id, account_sid)
);

CREATE TABLE delivery.receipts (
  account_sid text NOT NULL,
  message_sid text NOT NULL CHECK (message_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  run_id uuid NOT NULL,
  conversation_id text NOT NULL CHECK (conversation_id ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'),
  supported boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_sid, message_sid),
  FOREIGN KEY (run_id, account_sid) REFERENCES delivery.runs(id, account_sid)
);

CREATE TABLE delivery.jobs (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL,
  account_sid text NOT NULL,
  receipt_sid text NOT NULL,
  template_version integer NOT NULL DEFAULT 1 CHECK (template_version = 1),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','failed','uncertain','expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  eligible_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  claim_token uuid,
  provider_sid text CHECK (provider_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  delivery_status text,
  outcome text,
  review_required boolean NOT NULL DEFAULT false,
  UNIQUE (account_sid, receipt_sid),
  UNIQUE (account_sid, provider_sid),
  FOREIGN KEY (account_sid, receipt_sid) REFERENCES delivery.receipts(account_sid, message_sid),
  FOREIGN KEY (run_id, account_sid) REFERENCES delivery.runs(id, account_sid)
);
CREATE INDEX jobs_pending ON delivery.jobs(run_id, eligible_at) WHERE state = 'pending';

CREATE TABLE delivery.attempts (
  job_id uuid NOT NULL REFERENCES delivery.jobs(id),
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  outcome text,
  PRIMARY KEY (job_id, attempt_number)
);

CREATE TABLE delivery.callbacks (
  run_id uuid NOT NULL,
  account_sid text NOT NULL,
  message_sid text NOT NULL CHECK (message_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  status text NOT NULL CHECK (status IN ('accepted','scheduled','canceled','queued','sending','sent','delivered','undelivered','failed','read','unknown')),
  error_code bigint NOT NULL DEFAULT -1 CHECK (error_code >= -1),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_sid, message_sid, status, error_code),
  FOREIGN KEY (run_id, account_sid) REFERENCES delivery.runs(id, account_sid)
);
