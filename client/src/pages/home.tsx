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
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  Play,
  Loader2,
  X,
  BarChart3,
  Users,
  Timer,
  Flame,
  ThermometerSun,
  Snowflake,
  DollarSign,
  Gift,
  Briefcase,
  GraduationCap,
  UserCheck,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackCtaClicked, trackDemoStarted, trackPageView } from "@/lib/analytics";
import { FREE_TIER_LEAD_LIMIT, PRICE_PER_LEAD } from "@/lib/types";

const SAMPLE_SCORED_LEADS = [
  {
    name: "Sarah Johnson",
    company: "TechStartup Inc",
    title: "CTO",
    priority: "Hot" as const,
    score: 9,
    reasoning: "C-level exec at a growing tech company with 25-50 employees. Strong decision-making authority and likely evaluating automation tools. High urgency to scale operations.",
    action: "Call directly - reference their recent Series A funding and offer a personalized demo.",
  },
  {
    name: "John Smith",
    company: "Acme Manufacturing Corp",
    title: "VP of Engineering",
    priority: "Hot" as const,
    score: 8,
    reasoning: "VP-level at a 500+ employee manufacturing company. Perfect ICP match for industrial automation. Company size indicates budget availability.",
    action: "Send personalized email highlighting ROI case studies from similar manufacturers.",
  },
  {
    name: "Mike Williams",
    company: "Big Retail Co",
    title: "Procurement Manager",
    priority: "Warm" as const,
    score: 6,
    reasoning: "Mid-level role at a large retail company. May influence purchasing decisions but likely not the final decision-maker. Industry is adjacent but not core ICP.",
    action: "Add to nurture sequence - share industry report on retail automation trends.",
  },
  {
    name: "Tom Brown",
    company: "Small Biz LLC",
    title: "Owner",
    priority: "Cold" as const,
    score: 3,
    reasoning: "Very small company (1-10 employees) in consulting. Limited budget and not in target industry. Low probability of conversion at this time.",
    action: "Skip for now - add to quarterly newsletter for long-term nurturing.",
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

  useEffect(() => {
    const savedJobId = localStorage.getItem('sortleads_active_job');
    if (savedJobId) {
      fetch(`/api/jobs/${savedJobId}`)
        .then(res => res.json())
        .then(job => {
          if (job && job.status !== 'completed' && job.status !== 'failed') {
            setActiveJobId(savedJobId);
          } else if (job && job.status === 'completed') {
            localStorage.removeItem('sortleads_active_job');
            setLocation(`/results/${savedJobId}`);
          } else {
            localStorage.removeItem('sortleads_active_job');
          }
        })
        .catch(() => {
          localStorage.removeItem('sortleads_active_job');
        });
    }

    fetch('/api/demo/available')
      .then(res => res.json())
      .then(data => setDemoAvailable(data.available))
      .catch(() => setDemoAvailable(true));

    trackPageView('home');
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
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(error.error || 'Failed to start demo');
      }

      const data = await response.json();
      localStorage.setItem('sortleads_active_job', data.jobId);
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
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Hot': return 'bg-red-500 dark:bg-red-600 text-white';
      case 'Warm': return 'bg-amber-500 dark:bg-amber-600 text-white';
      case 'Cold': return 'bg-slate-400 dark:bg-slate-500 text-white';
      default: return '';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Hot': return <Flame className="h-3.5 w-3.5" />;
      case 'Warm': return <ThermometerSun className="h-3.5 w-3.5" />;
      case 'Cold': return <Snowflake className="h-3.5 w-3.5" />;
      default: return null;
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
            <Button 
              size="sm" 
              asChild
              data-testid="button-continue-processing"
            >
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
              <span className="text-muted-foreground">AI-Powered Lead Prioritization</span>
            </div>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl" data-testid="text-hero-headline">
              Stop Guessing Which{" "}
              <span className="text-primary">Leads to Call First</span>
            </h1>
            
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl" data-testid="text-hero-subheadline">
              Upload your spreadsheet, tell us what matters, and get a prioritized list 
              with next steps in under 2 minutes. First {FREE_TIER_LEAD_LIMIT} leads free, then just ${PRICE_PER_LEAD}/lead.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2" data-testid="button-get-started" onClick={() => trackCtaClicked('sort_leads_free', 'hero')}>
                <Link href="/upload">
                  Sort Your First {FREE_TIER_LEAD_LIMIT} Leads Free
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
                  Try With Sample Data
                </Button>
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required. No CRM needed. Upload and see results in minutes.
            </p>

            <button
              onClick={() => scrollToSection('sample-output')}
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

      {/* Sample Lead Scoring Output */}
      <section id="sample-output" className="py-20" data-testid="section-sample-output">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              See What You Get
            </h2>
            <p className="text-lg text-muted-foreground">
              Every lead scored, ranked, and paired with a clear next step. Here's a sample of real AI output.
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
                        <span className="text-sm text-muted-foreground">{lead.title} at {lead.company}</span>
                        <Badge className={`gap-1 ${getPriorityBadgeClass(lead.priority)}`}>
                          {getPriorityIcon(lead.priority)}
                          {lead.priority}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">Score: {lead.score}/10</span>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">AI Analysis</p>
                        <p className="text-sm text-muted-foreground">{lead.reasoning}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Suggested Action</p>
                        <p className="text-sm font-medium text-primary">{lead.action}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-4xl text-center">
            <Button size="lg" asChild className="gap-2" data-testid="button-cta-after-preview" onClick={() => trackCtaClicked('sort_leads_free', 'sample_output')}>
              <Link href="/upload">
                Try It With Your Leads
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Who Is This For? */}
      <section id="who-its-for" className="border-y bg-card py-20" data-testid="section-who-its-for">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Built for Reps Who Were Promoted Into Sales
            </h2>
            <p className="text-lg text-muted-foreground">
              Not trained on enterprise software. Not interested in a 6-month CRM rollout. 
              Just need to know which leads to call first.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">The Trade Show Rep</h3>
                <p className="text-sm text-muted-foreground">
                  You came back from the conference with 300 business cards. 
                  Now you need to figure out who to call Monday morning.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">The New Sales Hire</h3>
                <p className="text-sm text-muted-foreground">
                  You got handed a list of 1,000 leads and told to "start calling." 
                  No scoring system, no prioritization, just a spreadsheet.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">The Solo Founder</h3>
                <p className="text-sm text-muted-foreground">
                  You bought a lead list but don't have time to research every name. 
                  You need to focus on the ones most likely to buy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof / Pain Point Stats */}
      <section id="stats" className="py-16" data-testid="section-social-proof">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
              The Lead Problem Is Real
            </h2>
            <p className="text-muted-foreground">
              Most sales teams are leaving money on the table with unscored leads.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Timer className="mb-3 h-6 w-6 text-muted-foreground" />
                <div className="mb-1 text-3xl font-bold text-primary" data-testid="stat-time-wasted">67%</div>
                <p className="text-sm text-muted-foreground">of sales rep time is spent on unqualified leads</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Users className="mb-3 h-6 w-6 text-muted-foreground" />
                <div className="mb-1 text-3xl font-bold text-primary" data-testid="stat-leads-ignored">79%</div>
                <p className="text-sm text-muted-foreground">of marketing leads never convert to sales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <BarChart3 className="mb-3 h-6 w-6 text-muted-foreground" />
                <div className="mb-1 text-3xl font-bold text-primary" data-testid="stat-no-scoring">46%</div>
                <p className="text-sm text-muted-foreground">of sales teams have no lead scoring system</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <TrendingUp className="mb-3 h-6 w-6 text-muted-foreground" />
                <div className="mb-1 text-3xl font-bold text-primary" data-testid="stat-revenue-lift">20%</div>
                <p className="text-sm text-muted-foreground">more revenue from prioritized outreach</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y bg-card py-20" data-testid="section-how-it-works">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              From messy spreadsheet to prioritized action plan in under 2 minutes.
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
                <h3 className="mb-2 text-xl font-semibold">Upload</h3>
                <p className="text-muted-foreground">
                  Drop your CSV or Excel file - trade show lists, purchased contacts, 
                  CRM exports. Any lead list works.
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
                <h3 className="mb-2 text-xl font-semibold">Score</h3>
                <p className="text-muted-foreground">
                  AI reads every lead and scores them against your ideal customer profile. 
                  Hot, Warm, or Cold - instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-visible">
              <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                3
              </div>
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Close</h3>
                <p className="text-muted-foreground">
                  Download your sorted list with suggested next steps for every lead. 
                  Call the hottest ones first.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20" data-testid="section-pricing">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              No subscriptions. No contracts. No hidden fees. Just pay for what you use.
            </p>
          </div>

          <div className="mx-auto max-w-lg">
            <Card>
              <CardContent className="p-8">
                <div className="mb-6 text-center">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-1.5">
                    <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">First {FREE_TIER_LEAD_LIMIT} leads free</span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">${PRICE_PER_LEAD}</span>
                    <span className="text-lg text-muted-foreground">/ lead after that</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">$1.00 minimum per order</p>
                </div>

                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm">No credit card for first {FREE_TIER_LEAD_LIMIT} leads</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm">AI scoring with reasoning for every lead</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm">Suggested next steps (call, email, skip)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm">Download prioritized CSV</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm">Results in under 2 minutes</span>
                  </div>
                </div>

                <div className="mb-4 rounded-lg border bg-muted/50 p-4">
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Example</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">200 leads uploaded</span>
                    <span className="text-sm font-medium">
                      {FREE_TIER_LEAD_LIMIT} free + 150 x ${PRICE_PER_LEAD} = <strong>$12.00</strong>
                    </span>
                  </div>
                </div>

                <Button size="lg" asChild className="w-full gap-2" data-testid="button-cta-pricing" onClick={() => trackCtaClicked('sort_leads_free', 'pricing')}>
                  <Link href="/upload">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Competitive with Clay, Apollo, and other lead scoring tools - without the monthly subscription.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y bg-card py-20" data-testid="section-features">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Why SortLeads?
            </h2>
            <p className="text-lg text-muted-foreground">
              No setup, no training, no IT department needed.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="flex gap-4 rounded-lg border bg-background p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Save Hours of Manual Work</h3>
                <p className="text-sm text-muted-foreground">
                  Stop scrolling through endless rows. AI analyzes and prioritizes 
                  your leads in minutes, not hours.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-background p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Focus on High-Value Leads</h3>
                <p className="text-sm text-muted-foreground">
                  AI identifies your hottest prospects based on your criteria, 
                  so you can prioritize your outreach.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-background p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Clear Next Steps</h3>
                <p className="text-sm text-muted-foreground">
                  Each lead comes with a suggested action - call, email, or skip. 
                  No more guessing what to do next.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-lg border bg-background p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Easy to Expense</h3>
                <p className="text-sm text-muted-foreground">
                  One-time payment per list. No subscriptions or contracts. 
                  Simple receipt for expense reports.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-3xl overflow-hidden">
            <CardContent className="p-8 text-center md:p-12">
              <h2 className="mb-4 text-2xl font-bold md:text-3xl">
                Stop Wasting Time on Cold Leads
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                Upload your lead list and get the first {FREE_TIER_LEAD_LIMIT} scored free. 
                No credit card needed. See which leads to call first.
              </p>
              <Button size="lg" asChild className="gap-2" data-testid="button-cta-start" onClick={() => trackCtaClicked('sort_leads_free', 'bottom_cta')}>
                <Link href="/upload">
                  Sort Your First {FREE_TIER_LEAD_LIMIT} Leads Free
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
              SortLeads.io - AI-Powered Lead Prioritization
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="link-privacy">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="link-terms">
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
                We'll analyze 50 sample B2B leads based on your criteria. 
                View results on screen and download your prioritized CSV.
              </p>

              <div className="mb-4 rounded-lg border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">50 SAMPLE LEADS ACROSS INDUSTRIES:</p>
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
