CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('customer', 'merchant', 'admin')),
  password_hash text NOT NULL,
  wallet_address text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_challenges (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agreements (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES users(id),
  customer_id uuid REFERENCES users(id),
  customer_email text NOT NULL,
  customer_wallet text NOT NULL,
  item text NOT NULL,
  total_zar_cents bigint NOT NULL CHECK (total_zar_cents > 0),
  deposit_zar_cents bigint NOT NULL CHECK (deposit_zar_cents > 0 AND deposit_zar_cents < total_zar_cents),
  total_token_units numeric(78, 0) NOT NULL,
  deposit_token_units numeric(78, 0) NOT NULL,
  fx_rate_zar_per_usd numeric(18, 6) NOT NULL,
  fx_provider text NOT NULL,
  fx_observed_at timestamptz NOT NULL,
  term_months smallint NOT NULL CHECK (term_months BETWEEN 1 AND 36),
  cancellation_refund_bps smallint NOT NULL CHECK (cancellation_refund_bps BETWEEN 0 AND 10000),
  cancellation_terms text NOT NULL,
  terms_hash text NOT NULL,
  external_ref text NOT NULL UNIQUE,
  chain_agreement_id numeric(78, 0),
  contract_address text,
  cancellation_deadline timestamptz,
  refund_token_units numeric(78, 0) NOT NULL DEFAULT 0,
  merchant_settlement_token_units numeric(78, 0) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft', 'offered', 'active', 'cancellation_requested', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreements_merchant_created_idx ON agreements (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agreements_customer_email_idx ON agreements (lower(customer_email));
CREATE INDEX IF NOT EXISTS agreements_customer_id_idx ON agreements (customer_id);

CREATE TABLE IF NOT EXISTS instalments (
  id uuid PRIMARY KEY,
  agreement_id uuid NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  sequence smallint NOT NULL,
  due_at timestamptz NOT NULL,
  amount_zar_cents bigint NOT NULL CHECK (amount_zar_cents > 0),
  amount_token_units numeric(78, 0) NOT NULL CHECK (amount_token_units > 0),
  status text NOT NULL CHECK (status IN ('due', 'paid', 'cancelled')),
  tx_hash text UNIQUE,
  paid_at timestamptz,
  UNIQUE (agreement_id, sequence)
);

CREATE TABLE IF NOT EXISTS chain_transactions (
  tx_hash text PRIMARY KEY,
  agreement_id uuid NOT NULL REFERENCES agreements(id),
  kind text NOT NULL CHECK (kind IN ('created', 'accepted', 'payment', 'cancellation_requested', 'cancelled')),
  block_number bigint NOT NULL,
  log_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_number, log_index)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users(id),
  agreement_id uuid REFERENCES agreements(id),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_agreement_created_idx ON audit_events (agreement_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
