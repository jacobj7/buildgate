import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface AuditLogEntry {
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const { actor_id, action, entity_type, entity_id, metadata } = entry;

  await pool.query(
    `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      actor_id ?? null,
      action,
      entity_type,
      entity_id ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

export async function getAuditLogs(
  filters: {
    actor_id?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<
  Array<{
    id: number;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>
> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.actor_id !== undefined) {
    conditions.push(`actor_id = $${paramIndex++}`);
    values.push(filters.actor_id);
  }

  if (filters.action !== undefined) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(filters.action);
  }

  if (filters.entity_type !== undefined) {
    conditions.push(`entity_type = $${paramIndex++}`);
    values.push(filters.entity_type);
  }

  if (filters.entity_id !== undefined) {
    conditions.push(`entity_id = $${paramIndex++}`);
    values.push(filters.entity_id);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
     FROM audit_log
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    actor_id: row.actor_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata,
    created_at: row.created_at,
  }));
}
