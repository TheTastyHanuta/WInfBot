import {
  AuditLogEvent,
  Guild,
  GuildAuditLogsEntry,
  PartialUser,
  User,
} from 'discord.js';

const AUDIT_LOG_LOOKBACK_MS = 15000;
const AUDIT_LOG_STATE_TTL_MS = 15 * 60 * 1000;

type SingleDeleteUsage = {
  handledCount: number;
  touchedAt: number;
};

const singleDeleteUsage = new Map<string, SingleDeleteUsage>();
const consumedBulkDeleteEntries = new Map<string, number>();

type DeleteAuditMatch = {
  entryId: string;
  executor: User | PartialUser | null;
  reason: string | null;
};

function pruneAuditState() {
  const cutoff = Date.now() - AUDIT_LOG_STATE_TTL_MS;

  for (const [entryId, usage] of singleDeleteUsage.entries()) {
    if (usage.touchedAt < cutoff) {
      singleDeleteUsage.delete(entryId);
    }
  }

  for (const [entryId, touchedAt] of consumedBulkDeleteEntries.entries()) {
    if (touchedAt < cutoff) {
      consumedBulkDeleteEntries.delete(entryId);
    }
  }
}

function isRecentAuditEntry(entry: GuildAuditLogsEntry, windowMs: number) {
  return Date.now() - entry.createdTimestamp <= windowMs;
}

export async function matchSingleMessageDeleteAuditLog(
  guild: Guild,
  channelId: string,
  authorId: string | null
): Promise<DeleteAuditMatch | null> {
  pruneAuditState();

  const auditLogs = await guild.fetchAuditLogs({
    type: AuditLogEvent.MessageDelete,
    limit: 10,
  });

  const candidates = auditLogs.entries
    .filter(entry => {
      if (!isRecentAuditEntry(entry, AUDIT_LOG_LOOKBACK_MS)) return false;

      const extra = entry.extra;
      if (!extra || extra.channel.id !== channelId || extra.count < 1) {
        return false;
      }

      if (authorId && entry.targetId !== authorId) {
        return false;
      }

      const usage = singleDeleteUsage.get(entry.id);
      const handledCount = usage?.handledCount ?? 0;
      return extra.count > handledCount;
    })
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  if (!authorId && candidates.size !== 1) {
    return null;
  }

  const auditEntry = candidates.first();
  if (!auditEntry) {
    return null;
  }

  const previousUsage = singleDeleteUsage.get(auditEntry.id);
  singleDeleteUsage.set(auditEntry.id, {
    handledCount: (previousUsage?.handledCount ?? 0) + 1,
    touchedAt: Date.now(),
  });

  return {
    entryId: auditEntry.id,
    executor: auditEntry.executor,
    reason: auditEntry.reason,
  };
}

export async function matchBulkMessageDeleteAuditLog(
  guild: Guild,
  messageCount: number
): Promise<DeleteAuditMatch | null> {
  pruneAuditState();

  const auditLogs = await guild.fetchAuditLogs({
    type: AuditLogEvent.MessageBulkDelete,
    limit: 10,
  });

  const auditEntry = auditLogs.entries
    .filter(entry => {
      if (!isRecentAuditEntry(entry, AUDIT_LOG_LOOKBACK_MS)) return false;

      const extra = entry.extra;
      if (!extra || extra.count !== messageCount) {
        return false;
      }

      if (consumedBulkDeleteEntries.has(entry.id)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    .first();

  if (!auditEntry) {
    return null;
  }

  consumedBulkDeleteEntries.set(auditEntry.id, Date.now());

  return {
    entryId: auditEntry.id,
    executor: auditEntry.executor,
    reason: auditEntry.reason,
  };
}
