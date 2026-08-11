const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;

/**
 * KAMPÜS veri yaşam döngüsünün tek kod kaynağı.
 *
 * Süreler yasal bir yorum değil, ürünün şu anki operasyon politikasıdır.
 * Değişiklikler DATA_RETENTION.md ile birlikte ve migration/review üzerinden
 * yapılmalıdır.
 */
export const DATA_RETENTION_POLICY = Object.freeze({
  otpChallengeAfterExpiryMs: DAY,
  sessionAfterInactiveMs: 7 * DAY,
  rateLimitHitMs: 31 * DAY,
  notificationMs: 90 * DAY,
  emptyConversationMs: 7 * DAY,
  messageRequestCooldownMs: 30 * DAY,
  softDeletedContentMs: 30 * DAY,
  deletedAccountMs: 30 * DAY,
  unattachedUploadMs: DAY,
  moderationAuditMs: 365 * DAY,
  orphanStorageObjectMs: DAY,
  missingStorageObjectGraceMs: DAY,
  defaultBatchSize: 100,
  workerIntervalMs: HOUR,
});

export type DataRetentionPolicy = typeof DATA_RETENTION_POLICY;

export function retentionCutoff(now: Date, durationMs: number) {
  return new Date(now.getTime() - durationMs);
}
