import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  organization_id: z.string().uuid(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  metadata: z.record(z.unknown()).optional(),
});

const listProjectsSchema = z.object({
  organization_id: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  search: z.string().max(255).optional(),
});

async function logAudit(
  client: any,
  {
    userId,
    organizationId,
    action,
    resourceType,
    resourceId,
    metadata,
  }: {
    userId: string;
    organizationId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO audit_logs (user_id, organization_id, action, resource_type, resource_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      userId,
      organizationId,
      action,
      resourceType,
      resourceId ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

async function checkOrgMembership(
  client: any,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM organization_members
     WHERE user_id = $1 AND organization_id = $2 AND status = 'active'
     LIMIT 1`,
    [userId, organizationId],
  );
  return result.rowCount > 0;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "You must be logged in to access this resource.",
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawParams = {
    organization_id: searchParams.get("organization_id"),
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    status: searchParams.get("status"),
    search: searchParams.get("search"),
  };

  const filteredParams = Object.fromEntries(
    Object.entries(rawParams).filter(([, v]) => v !== null),
  );

  const parseResult = listProjectsSchema.safeParse(filteredParams);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation Error",
        message: "Invalid query parameters.",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { organization_id, page, limit, status, search } = parseResult.data;
  const offset = (page - 1) * limit;

  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email],
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found." },
        { status: 404 },
      );
    }

    const userId = userResult.rows[0].id;

    const isMember = await checkOrgMembership(client, userId, organization_id);
    if (!isMember) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have access to this organization.",
        },
        { status: 403 },
      );
    }

    const conditions: string[] = [
      "p.organization_id = $1",
      "p.deleted_at IS NULL",
    ];
    const queryParams: unknown[] = [organization_id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`p.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM projects p ${whereClause}`,
      queryParams,
    );

    const total = parseInt(countResult.rows[0].total, 10);

    queryParams.push(limit, offset);
    const projectsResult = await client.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.organization_id,
         p.status,
         p.metadata,
         p.created_at,
         p.updated_at,
         u.email as created_by_email,
         u.name as created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    );

    return NextResponse.json({
      data: projectsResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "You must be logged in to access this resource.",
      },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parseResult = createProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation Error",
        message: "Invalid request body.",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { name, description, organization_id, status, metadata } =
    parseResult.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email],
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Not Found", message: "User not found." },
        { status: 404 },
      );
    }

    const userId = userResult.rows[0].id;

    const isMember = await checkOrgMembership(client, userId, organization_id);
    if (!isMember) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have access to this organization.",
        },
        { status: 403 },
      );
    }

    const existingProject = await client.query(
      `SELECT id FROM projects
       WHERE organization_id = $1 AND name = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [organization_id, name],
    );

    if (existingProject.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Conflict",
          message:
            "A project with this name already exists in the organization.",
        },
        { status: 409 },
      );
    }

    const insertResult = await client.query(
      `INSERT INTO projects (name, description, organization_id, status, metadata, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, name, description, organization_id, status, metadata, created_by, created_at, updated_at`,
      [
        name,
        description ?? null,
        organization_id,
        status,
        metadata ? JSON.stringify(metadata) : null,
        userId,
      ],
    );

    const newProject = insertResult.rows[0];

    await logAudit(client, {
      userId,
      organizationId: organization_id,
      action: "project.created",
      resourceType: "project",
      resourceId: newProject.id,
      metadata: {
        project_name: name,
        status,
      },
    });

    await client.query("COMMIT");

    return NextResponse.json(
      {
        data: newProject,
        message: "Project created successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
