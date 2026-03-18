import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown> = {},
) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, action, resourceType, resourceId, JSON.stringify(details)],
    );
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

async function getProjectById(projectId: string) {
  const result = await db.query(
    `SELECT p.*, u.email as owner_email, u.name as owner_name
     FROM projects p
     LEFT JOIN users u ON p.owner_id = u.id
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [projectId],
  );
  return result.rows[0] || null;
}

async function checkProjectAccess(
  projectId: string,
  userId: string,
  role?: string,
): Promise<boolean> {
  if (role === "admin") return true;

  const result = await db.query(
    `SELECT 1 FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
     WHERE p.id = $1
       AND p.deleted_at IS NULL
       AND (p.owner_id = $2 OR pm.user_id = $2)
     LIMIT 1`,
    [projectId, userId],
  );
  return result.rows.length > 0;
}

async function checkProjectOwnership(
  projectId: string,
  userId: string,
  role?: string,
): Promise<boolean> {
  if (role === "admin") return true;

  const result = await db.query(
    `SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [projectId, userId],
  );
  return result.rows.length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const hasAccess = await checkProjectAccess(
      projectId,
      session.user.id,
      session.user.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 },
      );
    }

    const project = await getProjectById(projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await logAudit(session.user.id, "READ", "project", projectId);

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const hasAccess = await checkProjectAccess(
      projectId,
      session.user.id,
      session.user.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = updateProjectSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten(),
        },
        { status: 422 },
      );
    }

    const updates = parseResult.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const existingProject = await getProjectById(projectId);

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(projectId);

    const updateQuery = `
      UPDATE projects
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updatedProject = result.rows[0];

    await logAudit(session.user.id, "UPDATE", "project", projectId, {
      before: existingProject,
      after: updatedProject,
      changes: updates,
    });

    return NextResponse.json({ project: updatedProject }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const isOwner = await checkProjectOwnership(
      projectId,
      session.user.id,
      session.user.role,
    );

    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the project owner or an admin can delete this project",
        },
        { status: 403 },
      );
    }

    const existingProject = await getProjectById(projectId);

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await db.query(
      `UPDATE projects
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, name, deleted_at`,
      [projectId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await logAudit(session.user.id, "DELETE", "project", projectId, {
      project: existingProject,
    });

    return NextResponse.json(
      {
        message: "Project deleted successfully",
        project: result.rows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
