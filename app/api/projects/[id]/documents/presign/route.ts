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
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = presignRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { filename, contentType, fileSize } = validationResult.data;

    const client = await pool.connect();
    try {
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [session.user.email],
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userId = userResult.rows[0].id;

      const projectResult = await client.query(
        "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
        [projectId, userId],
      );

      if (projectResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Project not found or access denied" },
          { status: 404 },
        );
      }

      const documentId = uuidv4();
      const fileExtension = filename.includes(".")
        ? filename.substring(filename.lastIndexOf("."))
        : "";
      const storageKey = `projects/${projectId}/documents/${documentId}${fileExtension}`;

      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: storageKey,
        ContentType: contentType,
        ContentLength: fileSize,
      });

      const presignedUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn: 3600,
      });

      await client.query(
        `INSERT INTO project_documents (id, project_id, user_id, filename, content_type, file_size, storage_key, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())`,
        [
          documentId,
          projectId,
          userId,
          filename,
          contentType,
          fileSize,
          storageKey,
        ],
      );

      return NextResponse.json({
        documentId,
        presignedUrl,
        storageKey,
        expiresIn: 3600,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
