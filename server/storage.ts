import { randomUUID } from "crypto";
import type { Job, Lead, ProcessedLead, FreeTierUser } from "@shared/schema";
import pg from "pg";

export interface IStorage {
  createJob(fileName: string, prompt: string, leads: Lead[], isDemo?: boolean, email?: string, freeLeadsApplied?: number): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<void>;
  updateJobStatus(id: string, status: Job['status'], error?: string): Promise<void>;
  updateJobProgress(id: string, processedLeads: number): Promise<void>;
  addResult(jobId: string, result: ProcessedLead): Promise<void>;
  getJobResults(id: string): Promise<ProcessedLead[]>;
  canUseDemo(ip: string): boolean;
  recordDemoUsage(ip: string): void;
  getFreeTierUser(email: string): Promise<FreeTierUser | null>;
  recordFreeTierUsage(email: string, leadsUsed: number): Promise<FreeTierUser>;
}

// Demo rate limiting: 10 demos per IP per day
interface DemoRecord {
  count: number;
  resetAt: number;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, Job>;
  private results: Map<string, ProcessedLead[]>;
  private demoUsage: Map<string, DemoRecord>;

  constructor() {
    this.jobs = new Map();
    this.results = new Map();
    this.demoUsage = new Map();
  }

  canUseDemo(ip: string): boolean {
    const now = Date.now();
    const record = this.demoUsage.get(ip);
    
    if (!record) return true;
    
    // Reset if a day has passed
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

  async createJob(fileName: string, prompt: string, leads: Lead[], isDemo?: boolean, email?: string, freeLeadsApplied?: number): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      id,
      status: "pending",
      totalLeads: leads.length,
      processedLeads: 0,
      prompt,
      fileName,
      createdAt: new Date().toISOString(),
      leads,
      isDemo: isDemo || false,
      email,
      freeLeadsApplied,
    };
    this.jobs.set(id, job);
    this.results.set(id, []);
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (job) {
      const results = this.results.get(id) || [];
      return { ...job, results };
    }
    return undefined;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, ...updates });
    }
  }

  async updateJobStatus(id: string, status: Job['status'], error?: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = status;
      if (error) job.error = error;
      this.jobs.set(id, job);
    }
  }

  async updateJobProgress(id: string, processedLeads: number): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.processedLeads = processedLeads;
      this.jobs.set(id, job);
    }
  }

  async addResult(jobId: string, result: ProcessedLead): Promise<void> {
    const results = this.results.get(jobId) || [];
    results.push(result);
    this.results.set(jobId, results);
  }

  async getJobResults(id: string): Promise<ProcessedLead[]> {
    return this.results.get(id) || [];
  }

  private getPool(): pg.Pool {
    if (!this.pgPool) {
      this.pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    }
    return this.pgPool;
  }

  private pgPool: pg.Pool | null = null;

  async getFreeTierUser(email: string): Promise<FreeTierUser | null> {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT id, email, free_leads_used, created_at, last_used_at FROM free_tier_users WHERE email = $1',
      [email.toLowerCase().trim()]
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
      [normalizedEmail, leadsUsed]
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

  async reserveFreeTierLeads(email: string, requestedLeads: number, limit: number): Promise<{ freeLeadsApplied: number; billableLeads: number }> {
    const pool = this.getPool();
    const normalizedEmail = email.toLowerCase().trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO free_tier_users (email, free_leads_used, last_used_at)
         VALUES ($1, 0, NOW())
         ON CONFLICT (email) DO UPDATE SET last_used_at = NOW()
         RETURNING free_leads_used`,
        [normalizedEmail]
      );

      const currentUsed = result.rows[0].free_leads_used;
      const remaining = Math.max(limit - currentUsed, 0);
      const freeLeadsApplied = Math.min(requestedLeads, remaining);
      const billableLeads = requestedLeads - freeLeadsApplied;

      if (freeLeadsApplied > 0) {
        await client.query(
          `UPDATE free_tier_users SET free_leads_used = free_leads_used + $1, last_used_at = NOW() WHERE email = $2`,
          [freeLeadsApplied, normalizedEmail]
        );
      }

      await client.query('COMMIT');
      return { freeLeadsApplied, billableLeads };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const storage = new MemStorage();
