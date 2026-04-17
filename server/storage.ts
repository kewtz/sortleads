import { randomUUID } from "crypto";
import type { Job, Lead, ProcessedLead, FreeTierUser } from "@shared/schema";
import pg from "pg";

export interface IStorage {
  createJob(fileName: string, prompt: string, leads: Lead[], isDemo?: boolean, email?: string, freeLeadsApplied?: number, userId?: string): Promise<Job>;
  hasActiveSubscription(userId: string): Promise<boolean>;
  getFreeTierUsageByUserId(userId: string): Promise<{ freeLeadsUsed: number } | null>;
  reserveFreeTierLeadsByUserId(userId: string, email: string, requestedLeads: number, limit: number): Promise<{ freeLeadsApplied: number; billableLeads: number }>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<void>;
  updateJobStatus(id: string, status: Job["status"], error?: string): Promise<void>;
  updateJobProgress(id: string, processedLeads: number): Promise<void>;
  addResult(jobId: string, result: ProcessedLead): Promise<void>;
  getJobResults(id: string): Promise<ProcessedLead[]>;
  canUseDemo(ip: string): boolean;
  recordDemoUsage(ip: string): void;
  getFreeTierUser(email: string): Promise<FreeTierUser | null>;
  recordFreeTierUsage(email: string, leadsUsed: number): Promise<FreeTierUser>;
  reserveFreeTierLeads(email: string, requestedLeads: number, limit: number): Promise<{ freeLeadsApplied: number; billableLeads: number }>;
}

// Demo rate limiting: 10 demos per IP per day. Kept in-memory for simplicity —
// survives within a single server process but resets on redeploy. Multi-instance
// deployments would need a shared store, but we're single-instance on Railway.
interface DemoRecord {
  count: number;
  resetAt: number;
}

// Shape that comes back from the Postgres `jobs` table (snake_case columns).
interface JobDbRow {
  id: string;
  status: Job["status"];
  total_leads: number;
  processed_leads: number;
  prompt: string;
  file_name: string;
  leads: Lead[];
  results: ProcessedLead[];
  error: string | null;
  is_demo: boolean;
  stripe_session_id: string | null;
  paid_amount_cents: number | null;
  email: string | null;
  user_id: string | null;
  free_leads_applied: number | null;
  created_at: Date;
  updated_at: Date;
}

// Map between Job field names (camelCase in TS) and DB column names (snake_case).
// Only fields actually updated via updateJob() are listed; the rest have
// dedicated helpers (updateJobStatus, updateJobProgress, addResult).
const UPDATABLE_FIELDS: Record<string, string> = {
  status: "status",
  error: "error",
  totalLeads: "total_leads",
  processedLeads: "processed_leads",
  stripeSessionId: "stripe_session_id",
  paidAmountCents: "paid_amount_cents",
  userId: "user_id",
  freeLeadsApplied: "free_leads_applied",
};

function rowToJob(row: JobDbRow): Job {
  return {
    id: row.id,
    status: row.status,
    totalLeads: row.total_leads,
    processedLeads: row.processed_leads,
    prompt: row.prompt,
    fileName: row.file_name,
    createdAt: row.created_at.toISOString(),
    leads: row.leads,
    results: row.results,
    error: row.error ?? undefined,
    isDemo: row.is_demo,
    stripeSessionId: row.stripe_session_id ?? undefined,
    paidAmountCents: row.paid_amount_cents ?? undefined,
    userId: row.user_id ?? undefined,
    email: row.email ?? undefined,
    freeLeadsApplied: row.free_leads_applied ?? undefined,
  };
}

export class DbStorage implements IStorage {
  private demoUsage: Map<string, DemoRecord> = new Map();
  private pgPool: pg.Pool | null = null;

  private getPool(): pg.Pool {
    if (!this.pgPool) {
      this.pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    }
    return this.pgPool;
  }

  // ── Demo rate limiting (in-memory) ─────────────────────────────────────────

  canUseDemo(ip: string): boolean {
    const now = Date.now();
    const record = this.demoUsage.get(ip);
    if (!record) return true;
    if (now > record.resetAt) {
      this.demoUsage.delete(ip);
      return true;
    }
    return record.count < 10;
  }

  recordDemoUsage(ip: string): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const record = this.demoUsage.get(ip);
    if (!record || now > record.resetAt) {
      this.demoUsage.set(ip, { count: 1, resetAt: now + oneDayMs });
    } else {
      record.count++;
      this.demoUsage.set(ip, record);
    }
  }

  // ── Jobs (Postgres-backed) ─────────────────────────────────────────────────

  async createJob(
    fileName: string,
    prompt: string,
    leads: Lead[],
    isDemo?: boolean,
    email?: string,
    freeLeadsApplied?: number,
    userId?: string,
  ): Promise<Job> {
    const id = randomUUID();
    const pool = this.getPool();
    const result = await pool.query<JobDbRow>(
      `INSERT INTO jobs (
         id, status, total_leads, processed_leads, prompt, file_name,
         leads, results, is_demo, email, free_leads_applied, user_id
       ) VALUES ($1, 'pending', $2, 0, $3, $4, $5::jsonb, '[]'::jsonb, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        leads.length,
        prompt,
        fileName,
        JSON.stringify(leads),
        isDemo || false,
        email ?? null,
        freeLeadsApplied ?? null,
        userId ?? null,
      ],
    );
    return rowToJob(result.rows[0]);
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT 1 FROM checkout_sessions WHERE user_id = $1 AND payment_status IN ('paid', 'complete', 'no_payment_required') LIMIT 1`,
      [userId],
    );
    return result.rows.length > 0;
  }

  async getFreeTierUsageByUserId(userId: string): Promise<{ freeLeadsUsed: number } | null> {
    const pool = this.getPool();
    const result = await pool.query(
      "SELECT free_leads_used FROM free_tier_users WHERE user_id = $1",
      [userId],
    );
    if (result.rows.length === 0) return null;
    return { freeLeadsUsed: result.rows[0].free_leads_used };
  }

  async reserveFreeTierLeadsByUserId(
    userId: string,
    email: string,
    requestedLeads: number,
    limit: number,
  ): Promise<{ freeLeadsApplied: number; billableLeads: number }> {
    const pool = this.getPool();
    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Upsert by user_id. If this user_id has no row yet, they get a fresh
      // allowance (0 used) even if their email was consumed under old
      // email-only tracking.
      const result = await client.query(
        `INSERT INTO free_tier_users (email, user_id, free_leads_used, last_used_at)
         VALUES ($1, $2, 0, NOW())
         ON CONFLICT (email) DO UPDATE SET user_id = COALESCE(free_tier_users.user_id, $2), last_used_at = NOW()
         RETURNING free_leads_used`,
        [normalizedEmail, userId],
      );

      // Check if this user_id has an existing row (may differ from email row)
      const byUserId = await client.query(
        "SELECT free_leads_used FROM free_tier_users WHERE user_id = $1",
        [userId],
      );
      const currentUsed = byUserId.rows.length > 0 ? byUserId.rows[0].free_leads_used : 0;

      const remaining = Math.max(limit - currentUsed, 0);
      const freeLeadsApplied = Math.min(requestedLeads, remaining);
      const billableLeads = requestedLeads - freeLeadsApplied;

      if (freeLeadsApplied > 0 && byUserId.rows.length > 0) {
        await client.query(
          "UPDATE free_tier_users SET free_leads_used = free_leads_used + $1, last_used_at = NOW() WHERE user_id = $2",
          [freeLeadsApplied, userId],
        );
      } else if (freeLeadsApplied > 0 && byUserId.rows.length === 0) {
        // First time this user_id uploads — create a row for them
        await client.query(
          `INSERT INTO free_tier_users (email, user_id, free_leads_used, last_used_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (email) DO UPDATE SET user_id = $2, free_leads_used = $3, last_used_at = NOW()`,
          [normalizedEmail, userId, freeLeadsApplied],
        );
      }

      await client.query("COMMIT");
      return { freeLeadsApplied, billableLeads };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getJob(id: string): Promise<Job | undefined> {
    const pool = this.getPool();
    const result = await pool.query<JobDbRow>("SELECT * FROM jobs WHERE id = $1", [id]);
    if (result.rows.length === 0) return undefined;
    return rowToJob(result.rows[0]);
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<void> {
    const setFragments: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      const column = UPDATABLE_FIELDS[key];
      if (!column) continue; // silently ignore fields we don't persist
      setFragments.push(`${column} = $${i++}`);
      values.push(value);
    }

    if (setFragments.length === 0) return;
    setFragments.push(`updated_at = NOW()`);
    values.push(id);

    const pool = this.getPool();
    await pool.query(
      `UPDATE jobs SET ${setFragments.join(", ")} WHERE id = $${i}`,
      values,
    );
  }

  async updateJobStatus(id: string, status: Job["status"], error?: string): Promise<void> {
    const pool = this.getPool();
    if (error !== undefined) {
      await pool.query(
        `UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3`,
        [status, error, id],
      );
    } else {
      await pool.query(
        `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    }
  }

  async updateJobProgress(id: string, processedLeads: number): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE jobs SET processed_leads = $1, updated_at = NOW() WHERE id = $2`,
      [processedLeads, id],
    );
  }

  async addResult(jobId: string, result: ProcessedLead): Promise<void> {
    const pool = this.getPool();
    // jsonb || jsonb is an atomic concatenation — safe under concurrent writers.
    // We wrap the single result in an array so the || operator appends rather
    // than merging object keys.
    await pool.query(
      `UPDATE jobs SET results = results || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify([result]), jobId],
    );
  }

  async getJobResults(id: string): Promise<ProcessedLead[]> {
    const pool = this.getPool();
    const result = await pool.query<{ results: ProcessedLead[] }>(
      "SELECT results FROM jobs WHERE id = $1",
      [id],
    );
    if (result.rows.length === 0) return [];
    return result.rows[0].results ?? [];
  }

  // ── Free tier (Postgres) ───────────────────────────────────────────────────

  async getFreeTierUser(email: string): Promise<FreeTierUser | null> {
    const pool = this.getPool();
    const result = await pool.query(
      "SELECT id, email, free_leads_used, created_at, last_used_at FROM free_tier_users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      freeLeadsUsed: row.free_leads_used,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  async recordFreeTierUsage(email: string, leadsUsed: number): Promise<FreeTierUser> {
    const pool = this.getPool();
    const normalizedEmail = email.toLowerCase().trim();
    const result = await pool.query(
      `INSERT INTO free_tier_users (email, free_leads_used, last_used_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email)
       DO UPDATE SET free_leads_used = free_tier_users.free_leads_used + $2, last_used_at = NOW()
       RETURNING id, email, free_leads_used, created_at, last_used_at`,
      [normalizedEmail, leadsUsed],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      freeLeadsUsed: row.free_leads_used,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  async reserveFreeTierLeads(
    email: string,
    requestedLeads: number,
    limit: number,
  ): Promise<{ freeLeadsApplied: number; billableLeads: number }> {
    const pool = this.getPool();
    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO free_tier_users (email, free_leads_used, last_used_at)
         VALUES ($1, 0, NOW())
         ON CONFLICT (email) DO UPDATE SET last_used_at = NOW()
         RETURNING free_leads_used`,
        [normalizedEmail],
      );

      const currentUsed = result.rows[0].free_leads_used;
      const remaining = Math.max(limit - currentUsed, 0);
      const freeLeadsApplied = Math.min(requestedLeads, remaining);
      const billableLeads = requestedLeads - freeLeadsApplied;

      if (freeLeadsApplied > 0) {
        await client.query(
          `UPDATE free_tier_users SET free_leads_used = free_leads_used + $1, last_used_at = NOW() WHERE email = $2`,
          [freeLeadsApplied, normalizedEmail],
        );
      }

      await client.query("COMMIT");
      return { freeLeadsApplied, billableLeads };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

export const storage = new DbStorage();
