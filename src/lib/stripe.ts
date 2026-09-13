import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazily constructs the Stripe client on first use, rather than at module
 * import time — Next's build step imports every route module to collect its
 * metadata, and `new Stripe(...)` throws immediately on a missing/empty API
 * key, which would break the production build before a Stripe account even
 * exists. Callers must already check `STRIPE_SECRET_KEY` is set before
 * reaching any code path that calls this.
 */
export function getStripeClient(): Stripe {
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return cached;
}
