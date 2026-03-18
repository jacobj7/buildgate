import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
  unit_price: z.number().nonnegative("Unit price must be non-negative"),
  notes: z.string().optional(),
});

const bidSchema = z.object({
  invitation_token: z.string().min(1, "Invitation token is required"),
  subcontractor_name: z.string().min(1, "Subcontractor name is required"),
  subcontractor_email: z.string().email("Valid email is required"),
  subcontractor_company: z.string().min(1, "Company name is required"),
  subcontractor_phone: z.string().optional(),
  total_amount: z.number().positive("Total amount must be positive"),
  currency: z.string().default("USD"),
  valid_until: z.string().datetime().optional(),
  notes: z.string().optional(),
  line_items: z
    .array(lineItemSchema)
    .min(1, "At least one line item is required"),
});

async function sendConfirmationEmail(
  client: Anthropic,
  bidDetails: {
    subcontractor_name: string;
    subcontractor_email: string;
    subcontractor_company: string;
    project_name: string;
    total_amount: number;
    currency: string;
    bid_id: string;
  },
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Generate a professional bid confirmation email for the following details:
        
Subcontractor Name: ${bidDetails.subcontractor_name}
Company: ${bidDetails.subcontractor_company}
Email: ${bidDetails.subcontractor_email}
Project: ${bidDetails.project_name}
Bid Amount: ${bidDetails.currency} ${bidDetails.total_amount.toFixed(2)}
Bid Reference ID: ${bidDetails.bid_id}

Please write a concise, professional confirmation email that:
1. Thanks them for submitting their bid
2. Confirms the bid details
3. Mentions next steps (review process)
4. Provides the bid reference ID for tracking

Keep it under 200 words and professional in tone.`,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "Bid confirmation email generated.";
}

export async function POST(request: NextRequest) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const dbClient = await pool.connect();

  try {
    const body = await request.json();
    const validatedData = bidSchema.parse(body);

    await dbClient.query("BEGIN");

    // Validate invitation token
    const invitationResult = await dbClient.query(
      `SELECT 
        i.id,
        i.status,
        i.expires_at,
        i.project_id,
        p.name as project_name,
        p.id as project_id
       FROM bid_invitations i
       JOIN projects p ON p.id = i.project_id
       WHERE i.token = $1`,
      [validatedData.invitation_token],
    );

    if (invitationResult.rows.length === 0) {
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 404 },
      );
    }

    const invitation = invitationResult.rows[0];

    if (
      invitation.status === "accepted" ||
      invitation.status === "bid_submitted"
    ) {
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { error: "Bid has already been submitted for this invitation" },
        { status: 409 },
      );
    }

    if (invitation.status === "expired" || invitation.status === "cancelled") {
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { error: "This invitation is no longer valid" },
        { status: 410 },
      );
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await dbClient.query(
        "UPDATE bid_invitations SET status = 'expired' WHERE id = $1",
        [invitation.id],
      );
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 },
      );
    }

    // Insert bid record
    const bidResult = await dbClient.query(
      `INSERT INTO bids (
        invitation_id,
        project_id,
        subcontractor_name,
        subcontractor_email,
        subcontractor_company,
        subcontractor_phone,
        total_amount,
        currency,
        valid_until,
        notes,
        status,
        submitted_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted', NOW(), NOW(), NOW())
      RETURNING id`,
      [
        invitation.id,
        invitation.project_id,
        validatedData.subcontractor_name,
        validatedData.subcontractor_email,
        validatedData.subcontractor_company,
        validatedData.subcontractor_phone || null,
        validatedData.total_amount,
        validatedData.currency,
        validatedData.valid_until || null,
        validatedData.notes || null,
      ],
    );

    const bidId = bidResult.rows[0].id;

    // Insert bid line items
    for (const lineItem of validatedData.line_items) {
      const lineTotal = lineItem.quantity * lineItem.unit_price;
      await dbClient.query(
        `INSERT INTO bid_line_items (
          bid_id,
          description,
          quantity,
          unit,
          unit_price,
          line_total,
          notes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          bidId,
          lineItem.description,
          lineItem.quantity,
          lineItem.unit,
          lineItem.unit_price,
          lineTotal,
          lineItem.notes || null,
        ],
      );
    }

    // Update invitation status
    await dbClient.query(
      `UPDATE bid_invitations 
       SET status = 'bid_submitted', 
           updated_at = NOW(),
           responded_at = NOW()
       WHERE id = $1`,
      [invitation.id],
    );

    await dbClient.query("COMMIT");

    // Generate confirmation email content using Anthropic
    let confirmationEmailContent: string;
    try {
      confirmationEmailContent = await sendConfirmationEmail(client, {
        subcontractor_name: validatedData.subcontractor_name,
        subcontractor_email: validatedData.subcontractor_email,
        subcontractor_company: validatedData.subcontractor_company,
        project_name: invitation.project_name,
        total_amount: validatedData.total_amount,
        currency: validatedData.currency,
        bid_id: bidId,
      });
    } catch (emailError) {
      console.error("Failed to generate confirmation email:", emailError);
      confirmationEmailContent = `Thank you for submitting your bid for ${invitation.project_name}. Your bid reference ID is ${bidId}. We will review your submission and contact you shortly.`;
    }

    // Store confirmation email in database
    try {
      await pool.query(
        `INSERT INTO email_logs (
          recipient_email,
          recipient_name,
          subject,
          body,
          related_bid_id,
          email_type,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'bid_confirmation', 'pending', NOW())`,
        [
          validatedData.subcontractor_email,
          validatedData.subcontractor_name,
          `Bid Confirmation - ${invitation.project_name} - Ref: ${bidId}`,
          confirmationEmailContent,
          bidId,
        ],
      );
    } catch (logError) {
      console.error("Failed to log confirmation email:", logError);
      // Non-critical error, continue
    }

    return NextResponse.json(
      {
        success: true,
        message: "Bid submitted successfully",
        data: {
          bid_id: bidId,
          project_name: invitation.project_name,
          total_amount: validatedData.total_amount,
          currency: validatedData.currency,
          status: "submitted",
          confirmation_email_preview: confirmationEmailContent,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await dbClient.query("ROLLBACK").catch(console.error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    console.error("Bid submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    dbClient.release();
  }
}
