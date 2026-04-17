import { getStripeClient, getStripeWebhookSecret } from './stripeClient';
import pg from 'pg';

const getPool = (() => {
  let pool: pg.Pool | null = null;
  return () => {
    if (!pool) {
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    }
    return pool;
  };
})();

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const pool = getPool();
        await pool.query(
          `INSERT INTO checkout_sessions (stripe_session_id, job_id, user_id, email, amount_cents, currency, payment_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (stripe_session_id) DO UPDATE SET payment_status = $7, user_id = COALESCE($3, checkout_sessions.user_id)`,
          [
            session.id,
            session.metadata?.jobId || session.metadata?.tier || 'subscription',
            session.metadata?.user_id || null,
            session.customer_email || session.metadata?.email || null,
            session.amount_total || 0,
            session.currency || 'usd',
            session.payment_status || 'unknown',
          ]
        );
        console.log(`Payment recorded for session ${session.id}`, {
          tier: session.metadata?.tier,
          userId: session.metadata?.user_id,
          amount: session.amount_total,
        });

        // Auto-create an org for Portfolio subscribers
        if (session.metadata?.tier === 'portfolio' && session.metadata?.user_id) {
          const userId = session.metadata.user_id;
          const email = session.customer_email || session.metadata.email || '';
          // Check if user already has an org
          const existingOrg = await pool.query(
            "SELECT 1 FROM org_members WHERE user_id = $1 AND status = 'active' LIMIT 1",
            [userId],
          );
          if (existingOrg.rows.length === 0) {
            const orgResult = await pool.query(
              `INSERT INTO organizations (name, owner_id, stripe_subscription_id, tier)
               VALUES ($1, $2, $3, 'portfolio') RETURNING id`,
              [`${email.split('@')[0]}'s Team`, userId, session.subscription || null],
            );
            await pool.query(
              `INSERT INTO org_members (org_id, user_id, email, role, status)
               VALUES ($1, $2, $3, 'admin', 'active')`,
              [orgResult.rows[0].id, userId, email],
            );
            console.log(`Created Portfolio org for ${email} (${userId})`);
          }
        }
        break;
      }
      case 'payment_intent.succeeded': {
        console.log(`PaymentIntent succeeded: ${event.data.object.id}`);
        break;
      }
      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }
  }
}
