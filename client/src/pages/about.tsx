import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail } from "lucide-react";

export default function AboutPage() {
  // Manage the browser tab title for this page only. Restore the site-wide
  // default on unmount so other routes don't inherit our title.
  useEffect(() => {
    const previous = document.title;
    document.title = "About — SortLeads";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <article className="mx-auto max-w-2xl">
        {/* Eyebrow + headline — smaller and less flashy than the landing hero
            on purpose. This page should read as an editorial note, not a
            marketing pitch. */}
        <header className="mb-14">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            About
          </p>
          <h1
            className="mb-6 text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
            data-testid="text-about-headline"
          >
            This tool was built by someone who got tired of sorting leads in a
            spreadsheet.
          </h1>
          <p className="text-lg text-muted-foreground">
            Not a startup. Not a team of engineers who read about sales in a book.
            One person with 15 years in commercial operations who built the thing
            he kept wishing existed.
          </p>
        </header>

        <div className="space-y-14 text-base leading-relaxed md:text-[17px]">
          {/* Who built this */}
          <section data-testid="section-who">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              Built in the field. Not in a vacuum.
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                My name is Mike Coutts. I run Blue Chevron Solutions — a
                commercial operations practice focused on PE-backed manufacturing
                and industrial companies.
              </p>
              <p>
                For the past 15 years, I've been walking into factories,
                distributors, and industrial equipment companies and fixing the way
                they manage their sales pipelines. Not by selling them software. By
                doing the work: redesigning how they qualify leads, restructure
                their CRM, and prioritize who their reps actually call.
              </p>
              <p>
                At Trex Company — a PE-backed composite decking manufacturer — that
                work surfaced{" "}
                <span className="font-semibold text-primary">
                  $30 to $55 million in revenue leakage
                </span>{" "}
                that had been sitting in an unstructured opportunity pipeline. At
                Davis-Standard, a PE-backed industrial equipment manufacturer, it
                meant rebuilding a post-acquisition CRM from scratch so the sales
                team could actually use it.
              </p>
              <p>
                I've done this work at Michelin, Continental, and a handful of
                companies you've never heard of that make things like industrial
                conveyors and specialty coatings.
              </p>
              <p>
                The pattern is always the same: good salespeople, bad lead lists.
                Reps sort by gut feel. Best-fit accounts get buried. The top of the
                funnel is slower than it needs to be.
              </p>
            </div>
          </section>

          {/* Why it exists */}
          <section data-testid="section-why">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              I built SortLeads because the alternative was another spreadsheet
              formula.
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Every engagement starts the same way. Someone hands me a list —
                trade show contacts, broker referrals, web form submissions — and
                asks which ones are worth pursuing. The list is always unsorted.
                The answer always requires judgment: industry fit, company size,
                buying signals, role relevance.
              </p>
              <p>For years I did that manually. Then I started automating it.</p>
              <p>
                SortLeads is that automation, productized. You describe your ideal
                customer in plain English. The tool reads your list and returns a
                ranked output — Hot leads at the top, dead weight at the bottom —
                in 90 seconds.
              </p>
              <p>
                The scoring isn't generic. It's built on the same criteria I use
                when I'm doing this work by hand: fit, signal, and likelihood to
                buy. The AI runs the pattern. The logic behind it came from the
                field.
              </p>
            </div>
          </section>

          {/* What it isn't */}
          <section data-testid="section-not">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              A few things worth saying plainly.
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                SortLeads is not a CRM. It doesn't manage your pipeline, track
                your deals, or replace your sales process. It does one thing:
                takes an unsorted list and tells you who to call first.
              </p>
              <p>
                It's also not magic. If your list has no company names or is
                missing context, the scoring will reflect that. Garbage in,
                garbage out — same as any tool.
              </p>
              <p>
                What it is: fast, specific, and built by someone who has done this
                work manually hundreds of times. The output looks like what I'd
                hand you if you asked me to sort your leads myself.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="border-t pt-10" data-testid="section-cta">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              Questions about the tool or how it's being used in the field?
            </h2>
            <p className="mb-8 text-muted-foreground">
              I'm reachable directly. If you're working through a commercial ops
              problem at a manufacturing or industrial company and want a second
              opinion — on lead prioritization or anything else — that's what I
              do.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button asChild className="gap-2" data-testid="button-about-contact">
                <a href="mailto:mike@bluechevronsolutions.com">
                  <Mail className="h-4 w-4" />
                  Get in touch
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="gap-2"
                data-testid="button-about-try-free"
              >
                <Link href="/upload">
                  Try SortLeads free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-10 text-xs text-muted-foreground">
              Blue Chevron Solutions · Commercial Operations for PE-Backed
              Manufacturers
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
