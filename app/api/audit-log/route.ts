import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const querySchema = z.object({
  org_id: z.string().uuid(),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const parseResult = querySchema.safeParse({
      org_id: searchParams.get("org_id"),
      entity_type: searchParams.get("entity_type") ?? undefined,
      entity_id: searchParams.get("entity_id") ?? undefined,
      page: searchParams.get("page") ?? 1,
      page_size: searchParams.get("page_size") ?? 20,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { org_id, entity_type, entity_id, page, page_size } =
      parseResult.data;

    const client = await pool.connect();

    try {
      // Verify the user belongs to the requested org
      const membershipCheck = await client.query(
        `SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
        [org_id, session.user.id],
      );

      if (membershipCheck.rowCount === 0) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to this organization" },
          { status: 403 },
        );
      }

      const offset = (page - 1) * page_size;

      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [org_id];
      let paramIndex = 2;

      if (entity_type) {
        conditions.push(`entity_type = $${paramIndex}`);
        params.push(entity_type);
        paramIndex++;
      }

      if (entity_id) {
        conditions.push(`entity_id = $${paramIndex}`);
        params.push(entity_id);
        paramIndex++;
      }

      const whereClause = conditions.join(" AND ");

      const countResult = await client.query(
        `SELECT COUNT(*) AS total FROM audit_log WHERE ${whereClause}`,
        params,
      );

      const total = parseInt(countResult.rows[0].total, 10);

      const dataParams = [...params, page_size, offset];

      const dataResult = await client.query(
        `SELECT
          id,
          org_id,
          user_id,
          entity_type,
          entity_id,
          action,
          metadata,
          created_at
        FROM audit_log
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams,
      );

      const total_pages = Math.ceil(total / page_size);

      return NextResponse.json({
        data: dataResult.rows,
        pagination: {
          total,
          page,
          page_size,
          total_pages,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
