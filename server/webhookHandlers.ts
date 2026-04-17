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
