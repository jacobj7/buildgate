import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create enums
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE organization_type AS ENUM ('owner', 'contractor', 'subcontractor', 'supplier');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'estimator', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE project_status AS ENUM ('draft', 'published', 'bidding', 'awarded', 'closed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE project_type AS ENUM ('commercial', 'residential', 'industrial', 'infrastructure', 'government', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE document_type AS ENUM ('plans', 'specifications', 'addendum', 'rfq', 'rfp', 'contract', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE bid_status AS ENUM ('draft', 'submitted', 'under_review', 'shortlisted', 'awarded', 'rejected', 'withdrawn');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE bid_document_type AS ENUM ('proposal', 'schedule', 'bond', 'insurance', 'references', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_document_type AS ENUM ('license', 'insurance', 'bond', 'certification', 'safety_record', 'financial_statement', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE flag_severity AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE flag_status AS ENUM ('open', 'resolved', 'dismissed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE audit_action AS ENUM (
          'create', 'update', 'delete', 'login', 'logout',
          'submit', 'approve', 'reject', 'invite', 'upload', 'download'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 1. organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type organization_type NOT NULL,
        description TEXT,
        website VARCHAR(500),
        phone VARCHAR(50),
        email VARCHAR(255),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'US',
        tax_id VARCHAR(100),
        logo_url VARCHAR(1000),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);`,
    );

    // 2. users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'viewer',
        password_hash VARCHAR(500),
        avatar_url VARCHAR(1000),
        phone VARCHAR(50),
        title VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_verified_at TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`,
    );

    // 3. projects
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        type project_type NOT NULL DEFAULT 'other',
        status project_status NOT NULL DEFAULT 'draft',
        location_address VARCHAR(500),
        location_city VARCHAR(100),
        location_state VARCHAR(100),
        location_postal_code VARCHAR(20),
        location_country VARCHAR(100) DEFAULT 'US',
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        estimated_value DECIMAL(18, 2),
        bid_due_date TIMESTAMPTZ,
        project_start_date DATE,
        project_end_date DATE,
        scope_of_work TEXT,
        special_requirements TEXT,
        is_public BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_created_by_user_id ON projects(created_by_user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_bid_due_date ON projects(bid_due_date);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public);`,
    );

    // 4. project_documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        type document_type NOT NULL DEFAULT 'other',
        file_url VARCHAR(1000) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(255),
        version VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_project_documents_uploaded_by_user_id ON project_documents(uploaded_by_user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_project_documents_type ON project_documents(type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_project_documents_is_active ON project_documents(is_active);`,
    );

    // 5. invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        inviting_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        invited_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        invited_email VARCHAR(255),
        invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status invitation_status NOT NULL DEFAULT 'pending',
        message TEXT,
        token VARCHAR(500) UNIQUE,
        expires_at TIMESTAMPTZ,
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT invitation_target_check CHECK (
          invited_organization_id IS NOT NULL OR invited_email IS NOT NULL
        )
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_project_id ON invitations(project_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_inviting_organization_id ON invitations(inviting_organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_invited_organization_id ON invitations(invited_organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_invited_email ON invitations(invited_email);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);`,
    );

    // 6. bids
    await client.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        bidding_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        invitation_id UUID REFERENCES invitations(id) ON DELETE SET NULL,
        status bid_status NOT NULL DEFAULT 'draft',
        total_amount DECIMAL(18, 2),
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        notes TEXT,
        internal_notes TEXT,
        submitted_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        award_notes TEXT,
        awarded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, bidding_organization_id)
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_project_id ON bids(project_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_bidding_organization_id ON bids(bidding_organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_submitted_by_user_id ON bids(submitted_by_user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_invitation_id ON bids(invitation_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bids_submitted_at ON bids(submitted_at);`,
    );

    // 7. bid_line_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS bid_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(255),
        description TEXT NOT NULL,
        quantity DECIMAL(18, 4),
        unit VARCHAR(100),
        unit_price DECIMAL(18, 4),
        total_price DECIMAL(18, 2) NOT NULL,
        notes TEXT,
        is_optional BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_line_items_bid_id ON bid_line_items(bid_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_line_items_category ON bid_line_items(category);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_line_items_sort_order ON bid_line_items(bid_id, sort_order);`,
    );

    // 8. bid_documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS bid_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        type bid_document_type NOT NULL DEFAULT 'other',
        file_url VARCHAR(1000) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_documents_bid_id ON bid_documents(bid_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_documents_uploaded_by_user_id ON bid_documents(uploaded_by_user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_bid_documents_type ON bid_documents(type);`,
    );

    // 9. prequalification_profiles
    await client.query(`
      CREATE TABLE IF NOT EXISTS prequalification_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
        years_in_business INTEGER,
        number_of_employees INTEGER,
        annual_revenue DECIMAL(18, 2),
        bonding_capacity DECIMAL(18, 2),
        bonding_company VARCHAR(255),
        insurance_carrier VARCHAR(255),
        general_liability_limit DECIMAL(18, 2),
        workers_comp_limit DECIMAL(18, 2),
        safety_rating DECIMAL(5, 2),
        emr_rate DECIMAL(5, 3),
        licenses JSONB DEFAULT '[]',
        certifications JSONB DEFAULT '[]',
        trade_categories JSONB DEFAULT '[]',
        service_areas JSONB DEFAULT '[]',
        references JSONB DEFAULT '[]',
        past_projects JSONB DEFAULT '[]',
        is_prequalified BOOLEAN NOT NULL DEFAULT false,
        prequalified_at TIMESTAMPTZ,
        prequalified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        prequalification_expires_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_prequalification_profiles_organization_id ON prequalification_profiles(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_prequalification_profiles_is_prequalified ON prequalification_profiles(is_prequalified);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_prequalification_profiles_prequalification_expires_at ON prequalification_profiles(prequalification_expires_at);`,
    );

    // 10. compliance_documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        type compliance_document_type NOT NULL DEFAULT 'other',
        status compliance_status NOT NULL DEFAULT 'pending',
        file_url VARCHAR(1000) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(255),
        issuer VARCHAR(255),
        issue_date DATE,
        expiry_date DATE,
        document_number VARCHAR(255),
        coverage_amount DECIMAL(18, 2),
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_organization_id ON compliance_documents(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_uploaded_by_user_id ON compliance_documents(uploaded_by_user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_type ON compliance_documents(type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_status ON compliance_documents(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_expiry_date ON compliance_documents(expiry_date);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_documents_is_active ON compliance_documents(is_active);`,
    );

    // 11. compliance_flags
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        compliance_document_id UUID REFERENCES compliance_documents(id) ON DELETE SET NULL,
        bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
        raised_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        severity flag_severity NOT NULL DEFAULT 'medium',
        status flag_status NOT NULL DEFAULT 'open',
        resolution_notes TEXT,
        raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        due_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_organization_id ON compliance_flags(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_compliance_document_id ON compliance_flags(compliance_document_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_bid_id ON compliance_flags(bid_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_severity ON compliance_flags(severity);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_status ON compliance_flags(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_compliance_flags_due_date ON compliance_flags(due_date);`,
    );

    // 12. audit_log
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action audit_action NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_organization_id ON audit_log(organization_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log(resource_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type_id ON audit_log(resource_type, resource_id);`,
    );

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply updated_at triggers to all tables with updated_at column
    const tablesWithUpdatedAt = [
      "organizations",
      "users",
      "projects",
      "project_documents",
      "invitations",
      "bids",
      "bid_line_items",
      "bid_documents",
      "prequalification_profiles",
      "compliance_documents",
      "compliance_flags",
    ];

    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    await client.query("COMMIT");
    console.log("Migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
