import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Zap,
  Download,
  CheckCircle2,
  ArrowRight,
  Target,
  AlertCircle,
  Play,
  Loader2,
  X,
  FileSpreadsheet,
  Flame,
  ThermometerSun,
  Snowflake,
  Factory,
  Building2,
  Briefcase,
  Timer,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackCtaClicked, trackDemoStarted, trackPageView } from "@/lib/analytics";

const SAMPLE_SCORED_LEADS = [
  {
    name: "Sarah Johnson",
    company: "TechStartup Inc",
    title: "CTO",
    priority: "Hot" as const,
    score: 9,
    reasoning:
      "C-level exec at a growing tech company with 25-50 employees. Strong decision-making authority and likely evaluating automation tools. High urgency to scale operations.",
    action: "Call directly - reference their recent Series A funding and offer a personalized demo.",
  },
  {
    name: "John Smith",
    company: "Acme Manufacturing Corp",
    title: "VP of Engineering",
    priority: "Hot" as const,
    score: 8,
    reasoning:
      "VP-level at a 500+ employee manufacturing company. Perfect ICP match for industrial automation. Company size indicates budget availability.",
    action: "Send personalized email highlighting ROI case studies from similar manufacturers.",
  },
  {
    name: "Mike Williams",
    company: "Big Retail Co",
    title: "Procurement Manager",
    priority: "Warm" as const,
    score: 6,
    reasoning:
      "Mid-level role at a large retail company. May influence purchasing decisions but likely not the final decision-maker. Industry is adjacent but not core ICP.",
    action: "Add to nurture sequence - share industry report on retail automation trends.",
  },
  {
    name: "Tom Brown",
    company: "Small Biz LLC",
    title: "Owner",
    priority: "Cold" as const,
    score: 3,
    reasoning:
      "Very small company (1-10 employees) in consulting. Limited budget and not in target industry. Low probability of conversion at this time.",
    action: "Skip for now - add to quarterly newsletter for long-term nurturing.",
  },
];

interface PricingTier {
  name: string;
  annual: string;
  monthly: string;
  bestFor: string;
  featured?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Essentials",
    annual: "$948/year",
    monthly: "$79/mo",
    bestFor: "Single sales team, up to 500 leads/month",
  },
  {
    name: "Professional",
    annual: "$1,788/year",
    monthly: "$149/mo",
    bestFor: "Growing teams, up to 2,000 leads/month",
    featured: true,
  },
  {
    name: "Portfolio",
    annual: "$4,188/year",
    monthly: "$349/mo",
    bestFor: "Multi-site or PE portfolio use across portcos",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoPrompt, setDemoPrompt] = useState("");
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoAvailable, setDemoAvailable] = useState(true);
  const [checkoutTierLoading, setCheckoutTierLoading] = useState<string | null>(null);

  useEffect(() => {
    const savedJobId = localStorage.getItem("sortleads_active_job");
    if (savedJobId) {
      fetch(`/api/jobs/${savedJobId}`)
        .then((res) => res.json())
        .then((job) => {
          if (job && job.status !== "completed" && job.status !== "failed") {
            setActiveJobId(savedJobId);
          } else if (job && job.status === "completed") {
            localStorage.removeItem("sortleads_active_job");
            setLocation(`/results/${savedJobId}`);
          } else {
            localStorage.removeItem("sortleads_active_job");
          }
        })
        .catch(() => {
          localStorage.removeItem("sortleads_active_job");
        });
    }

    fetch("/api/demo/available")
      .then((res) => res.json())
      .then((data) => setDemoAvailable(data.available))
      .catch(() => setDemoAvailable(true));

    trackPageView("home");
  }, [setLocation]);

  const handleDemoSubmit = async () => {
    if (demoPrompt.trim().length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please describe your ideal customer in at least a few words",
        variant: "destructive",
      });
      return;
    }

    setIsDemoLoading(true);
    trackDemoStarted();
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: demoPrompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          toast({
            title: "Demo limit reached",
            description: error.message || "You've used your free demos for today",
            variant: "destructive",
          });
          setDemoAvailable(false);
          return;
        }
        throw new Error(error.error || "Failed to start demo");
      }

      const data = await response.json();
      localStorage.setItem("sortleads_active_job", data.jobId);
      setLocation(data.redirect);
    } catch (error) {
      toast({
        title: "Demo failed",
        description: "There was an error starting the demo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDemoLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleTierCheckout = async (tierKey: string) => {
    setCheckoutTierLoading(tierKey);
    trackCtaClicked(`tier_${tierKey}`, "pricing");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }
      const { url } = await response.json();
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Checkout failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not start checkout. Please try again.",
        variant: "destructive",
      });
      setCheckoutTierLoading(null);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "Hot":
        return "bg-red-500 dark:bg-red-600 text-white";
      case "Warm":
        return "bg-amber-500 dark:bg-amber-600 text-white";
      case "Cold":
        return "bg-slate-400 dark:bg-slate-500 text-white";
      default:
        return "";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Hot":
        return <Flame className="h-3.5 w-3.5" />;
      case "Warm":
        return <ThermometerSun className="h-3.5 w-3.5" />;
      case "Cold":
        return <Snowflake className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Active Job Banner */}
      {activeJobId && (
        <div className="border-b bg-primary/10">
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span className="text-sm">You have leads still being processed</span>
            </div>
            <Button size="sm" asChild data-testid="button-continue-processing">
              <Link href={`/processing/${activeJobId}`}>
                Continue
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">AI lead prioritization for industrial teams</span>
            </div>

            <h1
              className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
              data-testid="text-hero-headline"
            >
              Your reps are spending Monday morning sorting a spreadsheet.{" "}
              <span className="text-primary">That's the problem.</span>
            </h1>

            <p
              className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl"
              data-testid="text-hero-subheadline"
            >
              SortLeads scores and prioritizes your lead list in 90 seconds — so your team works the
              right accounts from the first call.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="gap-2"
                data-testid="button-get-started"
                onClick={() => trackCtaClicked("try_free_upload", "hero")}
              >
                <Link href="/upload">
                  Try it free — upload a list
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {demoAvailable && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowDemoModal(true)}
                  data-testid="button-try-demo"
                >
                  <Play className="h-4 w-4" />
                  See a live demo
                </Button>
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No account required. No CRM needed. Results in 90 seconds.
            </p>

            <button
              onClick={() => scrollToSection("sample-output")}
              className="mt-8 inline-flex animate-bounce items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              data-testid="button-scroll-preview"
            >
              See what you get
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-1/4 -top-1/2 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-20" data-testid="section-problem">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
              Every week, something kills pipeline before it starts.
            </h2>
            <div className="space-y-4 text-center text-lg text-muted-foreground">
              <p>
                Most manufacturing and industrial sales teams inherit their leads in a spreadsheet.
                No scoring, no ranking, no signal — just a list. Reps sort it by gut feel, call the
                familiar names first, and leave the best-fit accounts sitting untouched until Friday.
              </p>
              <p className="font-medium text-foreground">
                That's not a CRM problem. It's a prioritization problem.
              </p>
              <p>SortLeads fixes it in one step.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y bg-card py-20" data-testid="section-how-it-works">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Three steps. Ninety seconds.
            </h2>
            <p className="text-lg text-muted-foreground">
              Your reps start the week on the right accounts. Not the familiar ones.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <Card className="relative overflow-visible">
              <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                1
              </div>
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Upload your list</h3>
                <p className="text-muted-foreground">
                  CSV or Excel. Company names, contacts, whatever you have.
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-visible">
              <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                2
              </div>
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Describe your ideal customer</h3>
                <p className="text-muted-foreground">
                  In plain English. No configuration, no scoring rubrics.
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-visible">
              <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                3
              </div>
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Download your ranked list</h3>
                <p className="text-muted-foreground">
                  Hot, Warm, and Cold leads sorted and ready to work.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Sample Output — kept from previous version as a concrete illustration of the ranked output */}
      <section id="sample-output" className="py-20" data-testid="section-sample-output">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Every lead, a clear next step
            </h2>
            <p className="text-lg text-muted-foreground">
              Hot / Warm / Cold classification with a rationale and suggested action per lead.
              Here's a sample of real AI output.
            </p>
          </div>

          <div className="mx-auto max-w-4xl space-y-4">
            {SAMPLE_SCORED_LEADS.map((lead, index) => (
              <Card key={index} data-testid={`card-sample-lead-${index}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold">{lead.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {lead.title} at {lead.company}
                        </span>
                        <Badge className={`gap-1 ${getPriorityBadgeClass(lead.priority)}`}>
                          {getPriorityIcon(lead.priority)}
                          {lead.priority}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">
                          Score: {lead.score}/10
                        </span>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                          AI Analysis
                        </p>
                        <p className="text-sm text-muted-foreground">{lead.reasoning}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                          Suggested Action
                        </p>
                        <p className="text-sm font-medium text-primary">{lead.action}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-4xl text-center">
            <Button
              size="lg"
              asChild
              className="gap-2"
              data-testid="button-cta-after-preview"
              onClick={() => trackCtaClicked("try_free_upload", "sample_output")}
            >
              <Link href="/upload">
                Try it with your leads
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Results Callout */}
      <section className="border-y bg-card py-16" data-testid="section-results-callout">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-3xl border-primary/30">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Timer className="h-6 w-6 text-primary" />
              </div>
              <p className="text-2xl font-semibold md:text-3xl">
                44 leads scored, ranked, and ready to work in under 90 seconds.
              </p>
              <p className="text-muted-foreground">
                Hot leads surface in the first 17 seconds. No waiting for a batch run overnight.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20" data-testid="section-features">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Built for teams that run on spreadsheets, not enterprise software.
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-4 rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Flame className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Instant prioritization</h3>
                <p className="text-sm text-muted-foreground">
                  Hot / Warm / Cold classification with a rationale for each score.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Suggested next steps</h3>
                <p className="text-sm text-muted-foreground">
                  Tailored action for every lead — not a generic follow-up template.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">No CRM required</h3>
                <p className="text-sm text-muted-foreground">
                  Works with whatever you have: a trade show list, a broker referral list, a
                  Salesforce export.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Downloadable output</h3>
                <p className="text-sm text-muted-foreground">
                  Ranked CSV ready to hand to your team or import anywhere.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Works on any list</h3>
                <p className="text-sm text-muted-foreground">
                  Contact lists, account lists, conference attendees, inbound inquiries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section id="who-its-for" className="border-y bg-card py-20" data-testid="section-who-its-for">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Designed for commercial ops teams at manufacturing and industrial companies.
            </h2>
            <div className="space-y-4 text-left text-lg text-muted-foreground">
              <p>
                SortLeads is built for sales teams that move fast and don't have six months to
                configure a scoring model. If your leads live in a spreadsheet — trade show
                contacts, distributor referrals, inbound web forms — SortLeads turns them into a
                prioritized call list before your morning standup.
              </p>
              <p>
                PE portfolio companies use it to sharpen commercial execution during hold periods,
                without adding headcount or software overhead.
              </p>
            </div>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Factory className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Manufacturing & Industrial</h3>
                <p className="text-sm text-muted-foreground">
                  Trade show contacts, distributor referrals, and inbound inquiries prioritized
                  before Monday standup.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">PE Portfolio Companies</h3>
                <p className="text-sm text-muted-foreground">
                  Sharpen commercial execution during hold periods without adding headcount or
                  software overhead.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Commercial Ops Teams</h3>
                <p className="text-sm text-muted-foreground">
                  Sales teams that move fast and don't have six months to configure a scoring
                  model.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20" data-testid="section-pricing">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Annual site license. Unlimited users. No per-seat fees.
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={`flex flex-col ${tier.featured ? "border-primary shadow-lg" : ""}`}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
              >
                <CardContent className="flex flex-1 flex-col p-6">
                  {tier.featured && (
                    <Badge className="mb-3 w-fit bg-primary text-primary-foreground">Most popular</Badge>
                  )}
                  <h3 className="mb-1 text-2xl font-bold">{tier.name}</h3>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{tier.annual}</span>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">{tier.monthly}</p>
                  <p className="mb-6 text-sm text-muted-foreground">{tier.bestFor}</p>

                  <Button
                    variant={tier.featured ? "default" : "outline"}
                    className="mt-auto w-full gap-2"
                    data-testid={`button-tier-cta-${tier.name.toLowerCase()}`}
                    onClick={() => handleTierCheckout(tier.name.toLowerCase())}
                    disabled={checkoutTierLoading !== null}
                  >
                    {checkoutTierLoading === tier.name.toLowerCase() ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening checkout...
                      </>
                    ) : (
                      <>
                        Get started
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Card className="bg-muted/40">
              <CardContent className="p-6">
                <p className="mb-3 text-sm font-medium">All plans include:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "Unlimited users",
                    "CSV/Excel upload",
                    "Hot / Warm / Cold scoring",
                    "Suggested next steps",
                    "Downloadable output",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Want to try it first? Upload a sample list free from the{" "}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-primary underline-offset-2 hover:underline"
            >
              top of the page
            </button>
            .
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-3xl overflow-hidden">
            <CardContent className="p-8 text-center md:p-12">
              <h2 className="mb-4 text-2xl font-bold md:text-3xl">
                Upload your next lead list. See who's actually worth calling.
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                No account required to start. Import your list and see results in 90 seconds.
              </p>
              <Button
                size="lg"
                asChild
                className="gap-2"
                data-testid="button-cta-start"
                onClick={() => trackCtaClicked("try_free_upload", "bottom_cta")}
              >
                <Link href="/upload">
                  Try SortLeads free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              SortLeads.io — AI-Powered Lead Prioritization
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/about"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                data-testid="link-footer-about"
              >
                About
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                data-testid="link-privacy"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                data-testid="link-terms"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-lg" data-testid="modal-demo">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Try the Demo</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowDemoModal(false)}
                  data-testid="button-close-demo"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                We'll analyze 50 sample B2B leads based on your criteria. View results on screen and
                download your prioritized CSV.
              </p>

              <div className="mb-4 rounded-lg border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  50 SAMPLE LEADS ACROSS INDUSTRIES:
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>C-suite & VPs at manufacturing, tech, and finance companies</li>
                  <li>Directors & managers across healthcare, logistics, and retail</li>
                  <li>Small business owners and startup founders</li>
                  <li>Companies from 10 to 5,000+ employees</li>
                </ul>
              </div>

              <div className="mb-4">
                <Label htmlFor="demo-prompt" className="mb-2 block">
                  Describe your ideal customer
                </Label>
                <Textarea
                  id="demo-prompt"
                  placeholder="Example: We sell industrial equipment to manufacturing companies. Looking for VP or Director level contacts at companies with 100+ employees..."
                  value={demoPrompt}
                  onChange={(e) => setDemoPrompt(e.target.value)}
                  rows={4}
                  data-testid="textarea-demo-prompt"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleDemoSubmit}
                  disabled={isDemoLoading || demoPrompt.trim().length < 10}
                  data-testid="button-start-demo"
                >
                  {isDemoLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting Demo...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Demo
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDemoModal(false)}
                  data-testid="button-cancel-demo"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
