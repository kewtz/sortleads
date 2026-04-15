export interface Lead {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  source?: string;
  notes?: string;
  originalData: Record<string, unknown>;
}

export interface ProcessedLead extends Lead {
  priority: number;
  priorityLabel: "Hot" | "Warm" | "Cold";
  reasoning: string;
  suggestedAction: string;
  estimatedValue: "High" | "Medium" | "Low";
  linkedInUrl?: string;
}

export interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalLeads: number;
  processedLeads: number;
  prompt: string;
  fileName: string;
  createdAt: string;
  leads?: Lead[];
  results?: ProcessedLead[];
  error?: string;
  isDemo?: boolean;
}

export interface UploadResponse {
  jobId: string;
  totalLeads: number;
}

export const FREE_TIER_LEAD_LIMIT = 50;

export interface Pricing {
  numLeads: number;
  pricePerLead: number;
  subtotal: number;
  tier: string;
  discountPercent: number;
}

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
