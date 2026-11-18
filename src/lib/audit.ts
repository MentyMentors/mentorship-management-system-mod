import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Scope of the action, so institution and programme audit views can filter. */
  institutionId?: string | null;
  programId?: string | null;
  metadata?: Record<string, unknown>;
}

const SECRET_KEY = /pass(word)?|token|secret|cookie|authorization|api[-_]?key|hash/i;

/**
 * Removes values under secret-looking keys before they are written to the
 * audit log. Pattern from UniSpace's audit helper.
 */
export function scrubMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubMetadata(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : scrubMetadata(v, depth + 1);
  }
  return out;
}

/**
 * Record an administrative action for the audit log.
 * Never throws — a logging failure must not break the action itself.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        institutionId: entry.institutionId ?? undefined,
        programId: entry.programId ?? undefined,
        metadata: entry.metadata
          ? (scrubMetadata(entry.metadata) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] Failed to log "${entry.action}"`, error);
  }
}
