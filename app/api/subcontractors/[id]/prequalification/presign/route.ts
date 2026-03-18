import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const presignRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  documentType: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subcontractorId = params.id;
    if (!subcontractorId) {
      return NextResponse.json(
        { error: "Subcontractor ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = presignRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { fileName, fileType, documentType, expiresAt } =
      validationResult.data;

    const client = await pool.connect();
    try {
      const subcontractorCheck = await client.query(
        "SELECT id FROM subcontractors WHERE id = $1",
        [subcontractorId],
      );

      if (subcontractorCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Subcontractor not found" },
          { status: 404 },
        );
      }

      const documentId = uuidv4();
      const fileExtension = fileName.split(".").pop() || "";
      const storageKey = `compliance-documents/${subcontractorId}/${documentId}${fileExtension ? `.${fileExtension}` : ""}`;

      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: storageKey,
        ContentType: fileType,
        Metadata: {
          subcontractorId,
          documentId,
          documentType,
          uploadedBy: session.user.email || session.user.name || "unknown",
        },
      });

      const presignedUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn: 3600,
      });

      const insertResult = await client.query(
        `INSERT INTO compliance_documents (
          id,
          subcontractor_id,
          document_type,
          file_name,
          file_type,
          storage_key,
          status,
          expires_at,
          uploaded_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        ) RETURNING *`,
        [
          documentId,
          subcontractorId,
          documentType,
          fileName,
          fileType,
          storageKey,
          "pending_upload",
          expiresAt || null,
          session.user.email || session.user.name || "unknown",
        ],
      );

      const document = insertResult.rows[0];

      return NextResponse.json(
        {
          presignedUrl,
          documentId: document.id,
          storageKey: document.storage_key,
          document: {
            id: document.id,
            subcontractorId: document.subcontractor_id,
            documentType: document.document_type,
            fileName: document.file_name,
            fileType: document.file_type,
            storageKey: document.storage_key,
            status: document.status,
            expiresAt: document.expires_at,
            uploadedBy: document.uploaded_by,
            createdAt: document.created_at,
            updatedAt: document.updated_at,
          },
        },
        { status: 201 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating presigned URL:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
