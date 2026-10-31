-- Metadata only: never store prompts, generated text, or hashes of private text.
CREATE TABLE IF NOT EXISTS ai_reservations (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  day TEXT NOT NULL,
  reserved_micro_usd BIGINT NOT NULL CHECK(reserved_micro_usd > 0),
  started_at BIGINT NOT NULL,
  lease_until BIGINT NOT NULL,
  finished_at BIGINT,
  outcome TEXT CHECK(outcome IN ('success','timeout','cancelled','failed')),
  CHECK((finished_at IS NULL AND outcome IS NULL) OR (finished_at IS NOT NULL AND outcome IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ai_reservations_day ON ai_reservations(day,actor_id);
CREATE INDEX IF NOT EXISTS ai_reservations_active ON ai_reservations(lease_until) WHERE finished_at IS NULL;
