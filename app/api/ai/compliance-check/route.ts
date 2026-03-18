import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runComplianceCheck } from "@/lib/nexus";
import { pool } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { documentId } = parsed.data;

    const client = await pool.connect();
    try {
      // Fetch compliance document
      const docResult = await client.query(
        `SELECT id, title, content, document_type FROM compliance_documents WHERE id = $1`,
        [documentId],
      );

      if (docResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      }

      const document = docResult.rows[0];
      const documentText = document.content as string;

      // Run compliance check via Anthropic
      const flags = await runComplianceCheck(
        documentText,
        document.document_type,
      );

      // Save flags to compliance_flags table
      const savedFlags = [];
      for (const flag of flags) {
        const insertResult = await client.query(
          `INSERT INTO compliance_flags (
            document_id,
            flag_type,
            severity,
            description,
            recommendation,
            section_reference,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING *`,
          [
            documentId,
            flag.flagType,
            flag.severity,
            flag.description,
            flag.recommendation,
            flag.sectionReference ?? null,
          ],
        );
        savedFlags.push(insertResult.rows[0]);
      }

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs (
          user_id,
          action,
          resource_type,
          resource_id,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          session.user.id ?? session.user.email,
          "compliance_check",
          "compliance_document",
          documentId,
          JSON.stringify({
            documentTitle: document.title,
            flagsGenerated: savedFlags.length,
            documentType: document.document_type,
          }),
        ],
      );

      return NextResponse.json({
        success: true,
        documentId,
        flagsCount: savedFlags.length,
        flags: savedFlags,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Compliance check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
