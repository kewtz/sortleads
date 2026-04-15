declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    clarity?: (...args: unknown[]) => void;
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
    };
  }
}

let posthogInitialized = false;

export function initPostHog() {
  const key = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key || posthogInitialized || key.startsWith('%') || key === 'undefined') return;
  posthogInitialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `${host}/static/array.js`;
  script.onload = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ph = (window as any).posthog;
      if (ph && typeof ph.init === 'function') {
        ph.init(key, {
          api_host: host,
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: true,
        });
      }
    } catch {
      // PostHog failed to initialize - analytics will be skipped
    }
  };
  document.head.appendChild(script);
}

function gaEvent(eventName: string, params?: Record<string, unknown>) {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
}

function clarityEvent(eventName: string) {
  if (window.clarity) {
    window.clarity('event', eventName);
  }
}

function posthogEvent(eventName: string, properties?: Record<string, unknown>) {
  if (window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
  }
}

function trackAll(eventName: string, properties?: Record<string, unknown>) {
  gaEvent(eventName, properties);
  clarityEvent(eventName);
  posthogEvent(eventName, properties);
}

export function identifyUser(email: string) {
  if (window.posthog?.identify) {
    window.posthog.identify(email, { email });
  }
  if (window.clarity) {
    window.clarity('identify', email);
  }
}

export function trackPageView(pageName: string) {
  trackAll('page_view', { page_name: pageName });
}

export function trackEmailEntered(email: string, freeLeadsRemaining: number) {
  trackAll('email_entered', {
    free_leads_remaining: freeLeadsRemaining,
    has_free_leads: freeLeadsRemaining > 0,
  });
  identifyUser(email);
}

export function trackFileUploaded(fileName: string, leadCount: number) {
  trackAll('file_uploaded', {
    file_name: fileName,
    lead_count: leadCount,
  });
}

export function trackFreeTierActivated(leadCount: number, freeLeadsApplied: number) {
  trackAll('free_tier_activated', {
    total_leads: leadCount,
    free_leads_applied: freeLeadsApplied,
    fully_free: freeLeadsApplied >= leadCount,
  });
}

export function trackCheckoutStarted(billableLeads: number, totalPrice: number) {
  trackAll('checkout_started', {
    billable_leads: billableLeads,
    total_price: totalPrice,
    currency: 'USD',
  });
  gaEvent('begin_checkout', {
    value: totalPrice,
    currency: 'USD',
    items: [{ item_name: 'Lead Scoring', quantity: billableLeads }],
  });
}

export function trackProcessingStarted(jobId: string, totalLeads: number) {
  trackAll('processing_started', {
    job_id: jobId,
    total_leads: totalLeads,
  });
}

export function trackProcessingCompleted(jobId: string, totalLeads: number, hotCount: number, warmCount: number, coldCount: number) {
  trackAll('processing_completed', {
    job_id: jobId,
    total_leads: totalLeads,
    hot_leads: hotCount,
    warm_leads: warmCount,
    cold_leads: coldCount,
  });
}

export function trackResultsDownloaded(jobId: string, leadCount: number) {
  trackAll('results_downloaded', {
    job_id: jobId,
    lead_count: leadCount,
  });
}

export function trackDemoStarted() {
  trackAll('demo_started');
}

export function trackDemoCompleted(leadCount: number) {
  trackAll('demo_completed', {
    lead_count: leadCount,
  });
}

export function trackCtaClicked(ctaName: string, location: string) {
  trackAll('cta_clicked', {
    cta_name: ctaName,
    location: location,
  });
}
