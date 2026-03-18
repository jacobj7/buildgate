import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  message: z.string().max(500).optional(),
});

async function checkProjectAccess(
  projectId: string,
  userId: string,
  requiredRole?: string[],
) {
  const result = await db.query(
    `SELECT pm.role, p.name as project_name, p.owner_id
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     WHERE pm.project_id = $1 AND pm.user_id = $2`,
    [projectId, userId],
  );

  if (result.rows.length === 0) {
    const ownerCheck = await db.query(
      `SELECT id, name as project_name FROM projects WHERE id = $1 AND owner_id = $2`,
      [projectId, userId],
    );
    if (ownerCheck.rows.length === 0) {
      return null;
    }
    return { role: "owner", project_name: ownerCheck.rows[0].project_name };
  }

  const member = result.rows[0];

  if (
    requiredRole &&
    !requiredRole.includes(member.role) &&
    member.role !== "owner"
  ) {
    return null;
  }

  return member;
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

    const access = await checkProjectAccess(projectId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = `
      SELECT 
        i.id,
        i.email,
        i.role,
        i.status,
        i.created_at,
        i.expires_at,
        i.accepted_at,
        u.name as invited_by_name,
        u.email as invited_by_email
      FROM project_invitations i
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.project_id = $1
    `;
    const queryParams: (string | number)[] = [projectId];

    if (status) {
      queryParams.push(status);
      query += ` AND i.status = $${queryParams.length}`;
    }

    query += ` ORDER BY i.created_at DESC`;

    const result = await db.query(query, queryParams);

    return NextResponse.json({
      invitations: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    const access = await checkProjectAccess(projectId, session.user.id, [
      "owner",
      "admin",
    ]);
    if (!access) {
      return NextResponse.json(
        { error: "Project not found or insufficient permissions" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validationResult = createInvitationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { email, role, message } = validationResult.data;

    // Check if user is already a member
    const existingMember = await db.query(
      `SELECT u.id FROM users u
       JOIN project_members pm ON pm.user_id = u.id
       WHERE u.email = $1 AND pm.project_id = $2`,
      [email, projectId],
    );

    if (existingMember.rows.length > 0) {
      return NextResponse.json(
        { error: "User is already a member of this project" },
        { status: 409 },
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await db.query(
      `SELECT id FROM project_invitations
       WHERE project_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [projectId, email],
    );

    if (existingInvitation.rows.length > 0) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 },
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Insert invitation
    const insertResult = await db.query(
      `INSERT INTO project_invitations 
       (project_id, email, role, token, status, invited_by, expires_at, message)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING id, email, role, status, created_at, expires_at`,
      [
        projectId,
        email,
        role,
        token,
        session.user.id,
        expiresAt,
        message || null,
      ],
    );

    const invitation = insertResult.rows[0];

    // Insert audit log
    await db.query(
      `INSERT INTO audit_logs 
       (user_id, action, resource_type, resource_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        session.user.id,
        "invitation.created",
        "project",
        projectId,
        JSON.stringify({
          invitation_id: invitation.id,
          invited_email: email,
          role,
          project_name: access.project_name,
        }),
      ],
    );

    // Send invitation email
    const inviteUrl = `${process.env.NEXTAUTH_URL}/invitations/accept?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: `You've been invited to join ${access.project_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Project Invitation</h2>
            <p>You have been invited to join <strong>${access.project_name}</strong> as a <strong>${role}</strong>.</p>
            ${message ? `<p><em>"${message}"</em></p>` : ""}
            <p>This invitation will expire on ${expiresAt.toLocaleDateString()}.</p>
            <a 
              href="${inviteUrl}" 
              style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;"
            >
              Accept Invitation
            </a>
            <p style="color: #6B7280; font-size: 14px;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
            <p style="color: #6B7280; font-size: 12px;">
              Or copy this link: ${inviteUrl}
            </p>
          </div>
        `,
        text: `You've been invited to join ${access.project_name} as a ${role}. Accept your invitation here: ${inviteUrl}`,
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Don't fail the request if email fails, but log it
      await db
        .query(
          `UPDATE project_invitations SET email_sent = false WHERE id = $1`,
          [invitation.id],
        )
        .catch(() => {});
    }

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          created_at: invitation.created_at,
          expires_at: invitation.expires_at,
        },
        message: "Invitation created and email sent successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
