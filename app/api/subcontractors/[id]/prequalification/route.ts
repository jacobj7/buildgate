import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PrequalificationSchema = z.object({
  company_name: z.string().min(1).max(255),
  trade_categories: z.array(z.string()).min(1),
  license_number: z.string().max(100).optional().nullable(),
  license_expiry: z.string().datetime().optional().nullable(),
  insurance_provider: z.string().max(255).optional().nullable(),
  insurance_policy_number: z.string().max(100).optional().nullable(),
  insurance_expiry: z.string().datetime().optional().nullable(),
  general_liability_amount: z.number().nonnegative().optional().nullable(),
  workers_comp_amount: z.number().nonnegative().optional().nullable(),
  bonding_capacity: z.number().nonnegative().optional().nullable(),
  years_in_business: z.number().int().nonnegative().optional().nullable(),
  annual_revenue: z.number().nonnegative().optional().nullable(),
  employee_count: z.number().int().nonnegative().optional().nullable(),
  safety_rating: z.number().min(0).max(5).optional().nullable(),
  emod_rate: z.number().nonnegative().optional().nullable(),
  references: z
    .array(
      z.object({
        name: z.string().min(1),
        company: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        relationship: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
  certifications: z
    .array(
      z.object({
        name: z.string().min(1),
        issuing_body: z.string().optional(),
        issue_date: z.string().datetime().optional(),
        expiry_date: z.string().datetime().optional(),
        certificate_number: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
  status: z
    .enum(["pending", "approved", "rejected", "expired", "under_review"])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  minority_owned: z.boolean().optional().nullable(),
  woman_owned: z.boolean().optional().nullable(),
  veteran_owned: z.boolean().optional().nullable(),
  small_business: z.boolean().optional().nullable(),
});

const PatchSchema = PrequalificationSchema.partial();

async function logAudit(
  client: any,
  params: {
    subcontractor_id: string;
    action: string;
    performed_by: string;
    old_data?: any;
    new_data?: any;
    ip_address?: string;
  },
) {
  await client.query(
    `INSERT INTO prequalification_audit_log 
      (subcontractor_id, action, performed_by, old_data, new_data, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      params.subcontractor_id,
      params.action,
      params.performed_by,
      params.old_data ? JSON.stringify(params.old_data) : null,
      params.new_data ? JSON.stringify(params.new_data) : null,
      params.ip_address || null,
    ],
  );
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subcontractorId = params.id;

  if (!subcontractorId || typeof subcontractorId !== "string") {
    return NextResponse.json(
      { error: "Invalid subcontractor ID" },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    const subResult = await client.query(
      `SELECT id, name FROM subcontractors WHERE id = $1`,
      [subcontractorId],
    );

    if (subResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 },
      );
    }

    const profileResult = await client.query(
      `SELECT 
        p.*,
        s.name as subcontractor_name
       FROM prequalification_profiles p
       JOIN subcontractors s ON s.id = p.subcontractor_id
       WHERE p.subcontractor_id = $1
       ORDER BY p.updated_at DESC
       LIMIT 1`,
      [subcontractorId],
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          subcontractor: subResult.rows[0],
          message: "No prequalification profile found",
        },
        { status: 200 },
      );
    }

    const profile = profileResult.rows[0];

    if (profile.references && typeof profile.references === "string") {
      profile.references = JSON.parse(profile.references);
    }
    if (profile.certifications && typeof profile.certifications === "string") {
      profile.certifications = JSON.parse(profile.certifications);
    }
    if (
      profile.trade_categories &&
      typeof profile.trade_categories === "string"
    ) {
      profile.trade_categories = JSON.parse(profile.trade_categories);
    }

    return NextResponse.json({ data: profile }, { status: 200 });
  } catch (error: any) {
    console.error("GET prequalification error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subcontractorId = params.id;

  if (!subcontractorId || typeof subcontractorId !== "string") {
    return NextResponse.json(
      { error: "Invalid subcontractor ID" },
      { status: 400 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = PrequalificationSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 422 },
    );
  }

  const data = parseResult.data;
  const performedBy = session.user.email || session.user.name || "unknown";
  const ipAddress = getClientIp(request);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subResult = await client.query(
      `SELECT id FROM subcontractors WHERE id = $1`,
      [subcontractorId],
    );

    if (subResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 },
      );
    }

    const existingResult = await client.query(
      `SELECT * FROM prequalification_profiles WHERE subcontractor_id = $1 LIMIT 1`,
      [subcontractorId],
    );

    if (existingResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Prequalification profile already exists. Use PATCH to update.",
        },
        { status: 409 },
      );
    }

    const insertResult = await client.query(
      `INSERT INTO prequalification_profiles (
        subcontractor_id,
        company_name,
        trade_categories,
        license_number,
        license_expiry,
        insurance_provider,
        insurance_policy_number,
        insurance_expiry,
        general_liability_amount,
        workers_comp_amount,
        bonding_capacity,
        years_in_business,
        annual_revenue,
        employee_count,
        safety_rating,
        emod_rate,
        references,
        certifications,
        status,
        notes,
        minority_owned,
        woman_owned,
        veteran_owned,
        small_business,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW(), NOW()
      ) RETURNING *`,
      [
        subcontractorId,
        data.company_name,
        JSON.stringify(data.trade_categories),
        data.license_number ?? null,
        data.license_expiry ?? null,
        data.insurance_provider ?? null,
        data.insurance_policy_number ?? null,
        data.insurance_expiry ?? null,
        data.general_liability_amount ?? null,
        data.workers_comp_amount ?? null,
        data.bonding_capacity ?? null,
        data.years_in_business ?? null,
        data.annual_revenue ?? null,
        data.employee_count ?? null,
        data.safety_rating ?? null,
        data.emod_rate ?? null,
        data.references ? JSON.stringify(data.references) : null,
        data.certifications ? JSON.stringify(data.certifications) : null,
        data.status ?? "pending",
        data.notes ?? null,
        data.minority_owned ?? null,
        data.woman_owned ?? null,
        data.veteran_owned ?? null,
        data.small_business ?? null,
      ],
    );

    const newProfile = insertResult.rows[0];

    await logAudit(client, {
      subcontractor_id: subcontractorId,
      action: "CREATE",
      performed_by: performedBy,
      old_data: null,
      new_data: newProfile,
      ip_address: ipAddress,
    });

    await client.query("COMMIT");

    return NextResponse.json({ data: newProfile }, { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("POST prequalification error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subcontractorId = params.id;

  if (!subcontractorId || typeof subcontractorId !== "string") {
    return NextResponse.json(
      { error: "Invalid subcontractor ID" },
      { status: 400 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = PatchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 422 },
    );
  }

  const data = parseResult.data;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields provided for update" },
      { status: 400 },
    );
  }

  const performedBy = session.user.email || session.user.name || "unknown";
  const ipAddress = getClientIp(request);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subResult = await client.query(
      `SELECT id FROM subcontractors WHERE id = $1`,
      [subcontractorId],
    );

    if (subResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 },
      );
    }

    const existingResult = await client.query(
      `SELECT * FROM prequalification_profiles WHERE subcontractor_id = $1 LIMIT 1`,
      [subcontractorId],
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Prequalification profile not found. Use POST to create a new profile.",
        },
        { status: 404 },
      );
    }

    const oldProfile = existingResult.rows[0];

    const fieldMap: Record<string, string> = {
      company_name: "company_name",
      trade_categories: "trade_categories",
      license_number: "license_number",
      license_expiry: "license_expiry",
      insurance_provider: "insurance_provider",
      insurance_policy_number: "insurance_policy_number",
      insurance_expiry: "insurance_expiry",
      general_liability_amount: "general_liability_amount",
      workers_comp_amount: "workers_comp_amount",
      bonding_capacity: "bonding_capacity",
      years_in_business: "years_in_business",
      annual_revenue: "annual_revenue",
      employee_count: "employee_count",
      safety_rating: "safety_rating",
      emod_rate: "emod_rate",
      references: "references",
      certifications: "certifications",
      status: "status",
      notes: "notes",
      minority_owned: "minority_owned",
      woman_owned: "woman_owned",
      veteran_owned: "veteran_owned",
      small_business: "small_business",
    };

    const jsonFields = new Set([
      "trade_categories",
      "references",
      "certifications",
    ]);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, dbColumn] of Object.entries(fieldMap)) {
      if (key in data) {
        const value = (data as any)[key];
        if (jsonFields.has(key) && value !== null && value !== undefined) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value ?? null);
        }
        setClauses.push(`${dbColumn} = $${paramIndex}`);
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(subcontractorId);

    const updateQuery = `
      UPDATE prequalification_profiles
      SET ${setClauses.join(", ")}
      WHERE subcontractor_id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);
    const updatedProfile = updateResult.rows[0];

    await logAudit(client, {
      subcontractor_id: subcontractorId,
      action: "UPDATE",
      performed_by: performedBy,
      old_data: oldProfile,
      new_data: updatedProfile,
      ip_address: ipAddress,
    });

    await client.query("COMMIT");

    return NextResponse.json({ data: updatedProfile }, { status: 200 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("PATCH prequalification error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
