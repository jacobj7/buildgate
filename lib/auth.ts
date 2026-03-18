import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { Adapter, AdapterUser } from "next-auth/adapters";
import { Pool } from "pg";
import { JWT } from "next-auth/jwt";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

function PostgresAdapter(client: Pool): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const result = await client.query(
        `INSERT INTO users (name, email, email_verified, image, role, org_id)
         VALUES ($1, $2, $3, $4, 'user', NULL)
         RETURNING id, name, email, email_verified, image, role, org_id`,
        [user.name, user.email, user.emailVerified, user.image],
      );
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified,
        image: row.image,
        role: row.role,
        orgId: row.org_id,
      } as AdapterUser;
    },

    async getUser(id: string) {
      const result = await client.query(
        `SELECT id, name, email, email_verified, image, role, org_id FROM users WHERE id = $1`,
        [id],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified,
        image: row.image,
        role: row.role,
        orgId: row.org_id,
      } as AdapterUser;
    },

    async getUserByEmail(email: string) {
      const result = await client.query(
        `SELECT id, name, email, email_verified, image, role, org_id FROM users WHERE email = $1`,
        [email],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified,
        image: row.image,
        role: row.role,
        orgId: row.org_id,
      } as AdapterUser;
    },

    async getUserByAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) {
      const result = await client.query(
        `SELECT u.id, u.name, u.email, u.email_verified, u.image, u.role, u.org_id
         FROM users u
         JOIN accounts a ON u.id = a.user_id
         WHERE a.provider_account_id = $1 AND a.provider = $2`,
        [providerAccountId, provider],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified,
        image: row.image,
        role: row.role,
        orgId: row.org_id,
      } as AdapterUser;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
      const existing = await client.query(
        `SELECT id, name, email, email_verified, image, role, org_id FROM users WHERE id = $1`,
        [user.id],
      );
      if (existing.rows.length === 0) throw new Error("User not found");
      const current = existing.rows[0];
      const result = await client.query(
        `UPDATE users
         SET name = $1, email = $2, email_verified = $3, image = $4
         WHERE id = $5
         RETURNING id, name, email, email_verified, image, role, org_id`,
        [
          user.name ?? current.name,
          user.email ?? current.email,
          user.emailVerified ?? current.email_verified,
          user.image ?? current.image,
          user.id,
        ],
      );
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified,
        image: row.image,
        role: row.role,
        orgId: row.org_id,
      } as AdapterUser;
    },

    async deleteUser(userId: string) {
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    },

    async linkAccount(account: {
      userId: string;
      type: string;
      provider: string;
      providerAccountId: string;
      refresh_token?: string;
      access_token?: string;
      expires_at?: number;
      token_type?: string;
      scope?: string;
      id_token?: string;
      session_state?: string;
    }) {
      await client.query(
        `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (provider, provider_account_id) DO NOTHING`,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ],
      );
      return account;
    },

    async unlinkAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) {
      await client.query(
        `DELETE FROM accounts WHERE provider_account_id = $1 AND provider = $2`,
        [providerAccountId, provider],
      );
    },

    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      const result = await client.query(
        `INSERT INTO sessions (session_token, user_id, expires)
         VALUES ($1, $2, $3)
         RETURNING session_token, user_id, expires`,
        [session.sessionToken, session.userId, session.expires],
      );
      const row = result.rows[0];
      return {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: row.expires,
      };
    },

    async getSessionAndUser(sessionToken: string) {
      const result = await client.query(
        `SELECT s.session_token, s.user_id, s.expires,
                u.id, u.name, u.email, u.email_verified, u.image, u.role, u.org_id
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_token = $1 AND s.expires > NOW()`,
        [sessionToken],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        session: {
          sessionToken: row.session_token,
          userId: row.user_id,
          expires: row.expires,
        },
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          emailVerified: row.email_verified,
          image: row.image,
          role: row.role,
          orgId: row.org_id,
        } as AdapterUser,
      };
    },

    async updateSession(session: {
      sessionToken: string;
      userId?: string;
      expires?: Date;
    }) {
      const existing = await client.query(
        `SELECT session_token, user_id, expires FROM sessions WHERE session_token = $1`,
        [session.sessionToken],
      );
      if (existing.rows.length === 0) return null;
      const current = existing.rows[0];
      const result = await client.query(
        `UPDATE sessions
         SET user_id = $1, expires = $2
         WHERE session_token = $3
         RETURNING session_token, user_id, expires`,
        [
          session.userId ?? current.user_id,
          session.expires ?? current.expires,
          session.sessionToken,
        ],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: row.expires,
      };
    },

    async deleteSession(sessionToken: string) {
      await client.query(`DELETE FROM sessions WHERE session_token = $1`, [
        sessionToken,
      ]);
    },

    async createVerificationToken(verificationToken: {
      identifier: string;
      expires: Date;
      token: string;
    }) {
      const result = await client.query(
        `INSERT INTO verification_tokens (identifier, token, expires)
         VALUES ($1, $2, $3)
         RETURNING identifier, token, expires`,
        [
          verificationToken.identifier,
          verificationToken.token,
          verificationToken.expires,
        ],
      );
      const row = result.rows[0];
      return {
        identifier: row.identifier,
        token: row.token,
        expires: row.expires,
      };
    },

    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }) {
      const result = await client.query(
        `DELETE FROM verification_tokens
         WHERE identifier = $1 AND token = $2
         RETURNING identifier, token, expires`,
        [identifier, token],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        identifier: row.identifier,
        token: row.token,
        expires: row.expires,
      };
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PostgresAdapter(pool),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "noreply@example.com",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async session({
      session,
      user,
    }: {
      session: Session;
      user: User & { role?: string; orgId?: string };
      token?: JWT;
    }) {
      if (session.user) {
        session.user.id = user.id;
        (
          session.user as Session["user"] & { role?: string; orgId?: string }
        ).role = (user as User & { role?: string }).role ?? "user";
        (
          session.user as Session["user"] & { role?: string; orgId?: string }
        ).orgId = (user as User & { orgId?: string }).orgId ?? null;
      }
      return session;
    },

    async signIn({
      user,
      account,
    }: {
      user: User | AdapterUser;
      account: {
        provider: string;
        type: string;
        providerAccountId: string;
      } | null;
    }) {
      if (!user.email) return false;

      if (account?.provider === "google") {
        try {
          const result = await pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [user.email],
          );
          if (result.rows.length === 0) {
            return true;
          }
        } catch (error) {
          console.error("Error during Google sign-in check:", error);
          return false;
        }
      }

      return true;
    },

    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async createUser({ user }: { user: User }) {
      console.log(`New user created: ${user.email}`);
    },
    async signIn({ user, isNewUser }: { user: User; isNewUser?: boolean }) {
      if (isNewUser) {
        console.log(`New user signed in: ${user.email}`);
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      orgId?: string | null;
    };
  }

  interface User {
    role?: string;
    orgId?: string | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role?: string;
    orgId?: string | null;
  }
}

export default authOptions;
