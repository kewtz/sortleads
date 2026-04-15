/**
 * Test script: verifies Supabase connection and free_tier_users table.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx script/test-supabase.ts
 *
 * What it does:
 *   1. Connects to Supabase via DATABASE_URL
 *   2. Checks that free_tier_users and checkout_sessions tables exist
 *   3. Runs the exact queries storage.ts uses (insert, upsert, select)
 *   4. Cleans up the test row
 */
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: Set DATABASE_URL before running this script.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("1. Connecting to Supabase...");
  const client = await pool.connect();
  console.log("   Connected.\n");

  try {
    // Check tables exist
    console.log("2. Checking tables...");
    for (const table of ["free_tier_users", "checkout_sessions"]) {
      const res = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      const exists = res.rows[0].exists;
      console.log(`   ${table}: ${exists ? "OK" : "MISSING"}`);
      if (!exists) {
        console.error(`\n   Table '${table}' not found. Run: DATABASE_URL="..." npx drizzle-kit push`);
        process.exit(1);
      }
    }

    // Test free tier flow (same queries as storage.ts)
    const testEmail = "__test__@sortleads.io";

    console.log("\n3. Testing free tier upsert (recordFreeTierUsage)...");
    const upsert = await client.query(
      `INSERT INTO free_tier_users (email, free_leads_used, last_used_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email)
       DO UPDATE SET free_leads_used = free_tier_users.free_leads_used + $2, last_used_at = NOW()
       RETURNING id, email, free_leads_used, created_at, last_used_at`,
      [testEmail, 5]
    );
    console.log("   Upserted:", upsert.rows[0]);

    console.log("\n4. Testing free tier select (getFreeTierUser)...");
    const select = await client.query(
      `SELECT id, email, free_leads_used, created_at, last_used_at FROM free_tier_users WHERE email = $1`,
      [testEmail]
    );
    console.log("   Selected:", select.rows[0]);

    console.log("\n5. Testing atomic reservation (reserveFreeTierLeads)...");
    await client.query("BEGIN");
    const reserve = await client.query(
      `INSERT INTO free_tier_users (email, free_leads_used, last_used_at)
       VALUES ($1, 0, NOW())
       ON CONFLICT (email) DO UPDATE SET last_used_at = NOW()
       RETURNING free_leads_used`,
      [testEmail]
    );
    const currentUsed = reserve.rows[0].free_leads_used;
    const remaining = Math.max(50 - currentUsed, 0);
    console.log(`   Current used: ${currentUsed}, remaining: ${remaining}`);
    await client.query("ROLLBACK"); // Don't actually reserve

    console.log("\n6. Testing checkout_sessions insert...");
    const csInsert = await client.query(
      `INSERT INTO checkout_sessions (stripe_session_id, job_id, email, amount_cents, currency, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_session_id) DO UPDATE SET payment_status = $6
       RETURNING id, stripe_session_id, job_id, amount_cents, payment_status`,
      ["cs_test_123", "job_test_456", testEmail, 800, "usd", "paid"]
    );
    console.log("   Inserted:", csInsert.rows[0]);

    // Cleanup
    console.log("\n7. Cleaning up test data...");
    await client.query(`DELETE FROM checkout_sessions WHERE stripe_session_id = 'cs_test_123'`);
    await client.query(`DELETE FROM free_tier_users WHERE email = $1`, [testEmail]);
    console.log("   Cleaned up.");

    console.log("\n✓ All tests passed. Supabase is ready.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("\n✗ Test failed:", err.message);
  pool.end();
  process.exit(1);
});
