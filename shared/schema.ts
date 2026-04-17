import { pgTable, serial, text, integer, timestamp, jsonb, boolean, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

// ── Drizzle table definitions (used by drizzle-kit push) ──

export const freeTierUsers = pgTable("free_tier_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  userId: text("user_id"),
  freeLeadsUsed: integer("free_leads_used").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastUsedAt: timestamp("last_used_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const checkoutSessions = pgTable("checkout_sessions", {
  id: serial("id").primaryKey(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  jobId: text("job_id").notNull(),
  userId: text("user_id"),
  email: text("email"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  paymentStatus: text("payment_status").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Persistent job state — replaces the previous in-memory Map so jobs survive
// Railway redeploys. `leads` is the input array (needed to resume processing);
// `results` is the scored output array (appended to atomically via jsonb ||).
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(), // UUID string from randomUUID()
  status: text("status").notNull().default("pending"),
  totalLeads: integer("total_leads").notNull(),
  processedLeads: integer("processed_leads").notNull().default(0),
  prompt: text("prompt").notNull(),
  fileName: text("file_name").notNull(),
  leads: jsonb("leads").notNull(),
  results: jsonb("results").notNull().default(sql`'[]'::jsonb`),
  error: text("error"),
  isDemo: boolean("is_demo").notNull().default(false),
  stripeSessionId: text("stripe_session_id"),
  paidAmountCents: integer("paid_amount_cents"),
  userId: text("user_id"),
  email: text("email"),
  freeLeadsApplied: integer("free_leads_applied"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Multi-tenant organization tables (Portfolio tier) ──

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(), // Supabase user_id of the admin
  stripeSubscriptionId: text("stripe_subscription_id"),
  tier: text("tier").notNull().default("portfolio"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orgMembers = pgTable("org_members", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  leadsUsed: integer("leads_used").notNull().default(0),
  status: text("status").notNull().default("active"), // 'active' | 'invited' | 'removed'
  invitedAt: timestamp("invited_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orgInvites = pgTable("org_invites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull(),
  email: text("email"),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(), // admin user_id
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedBy: text("used_by"), // user_id who accepted
});

export const leadSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  originalData: z.record(z.string(), z.unknown()),
});

export type Lead = z.infer<typeof leadSchema>;

export const processedLeadSchema = leadSchema.extend({
  priority: z.number().min(1).max(10),
  priorityLabel: z.enum(["Hot", "Warm", "Cold"]),
  reasoning: z.string(),
  suggestedAction: z.string(),
  estimatedValue: z.enum(["High", "Medium", "Low"]),
  linkedInUrl: z.string().optional(),
});

export type ProcessedLead = z.infer<typeof processedLeadSchema>;

export const jobSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  totalLeads: z.number(),
  processedLeads: z.number(),
  prompt: z.string(),
  fileName: z.string(),
  createdAt: z.string(),
  leads: z.array(leadSchema).optional(),
  results: z.array(processedLeadSchema).optional(),
  error: z.string().optional(),
  isDemo: z.boolean().optional(),
  stripeSessionId: z.string().optional(),
  paidAmountCents: z.number().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
  freeLeadsApplied: z.number().optional(),
});

// Maximum leads allowed for 100% discount coupons (to prevent abuse)
export const MAX_FREE_COUPON_LEADS = 100;

// Free tier: first 50 leads free per email
export const FREE_TIER_LEAD_LIMIT = 50;

export interface FreeTierUser {
  id: number;
  email: string;
  freeLeadsUsed: number;
  createdAt: string;
  lastUsedAt: string;
}

export type Job = z.infer<typeof jobSchema>;

export const insertJobSchema = z.object({
  prompt: z.string().min(10, "Please provide at least a few sentences about what you're looking for"),
  fileName: z.string(),
});

export type InsertJob = z.infer<typeof insertJobSchema>;

// Pricing types
export const pricingSchema = z.object({
  numLeads: z.number(),
  pricePerLead: z.number(),
  subtotal: z.number(),
  tier: z.string(),
  discountPercent: z.number(),
});

export type Pricing = z.infer<typeof pricingSchema>;

export const PRICE_PER_LEAD = 0.08;

export function calculatePrice(numLeads: number): Pricing {
  if (numLeads <= 0) {
    return {
      numLeads: 0,
      pricePerLead: 0,
      subtotal: 0,
      tier: 'Invalid',
      discountPercent: 0
    };
  }

  const pricePerLead = PRICE_PER_LEAD;
  const tier = "Pay-as-you-go";
  const discountPercent = 0;

  const calculatedSubtotal = Math.round(numLeads * pricePerLead * 100) / 100;
  const subtotal = Math.max(calculatedSubtotal, 1.00);

  return {
    numLeads,
    pricePerLead,
    subtotal,
    tier,
    discountPercent
  };
}

// Drizzle inferred types
export type FreeTierUserRow = typeof freeTierUsers.$inferSelect;
export type CheckoutSessionRow = typeof checkoutSessions.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
