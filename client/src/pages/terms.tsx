import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <Card>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6">
            <h1 className="text-2xl font-bold mb-2">Terms of Service - SortLeads</h1>
            <p className="text-muted-foreground mb-6">Last updated: {today}</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">What SortLeads Does</h2>
            <p>
              We score your sales leads using AI and give you a prioritized spreadsheet. 
              That's it.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">What You Agree To</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">1. Your data is your responsibility</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>You own your lead data</li>
              <li>You're responsible for having permission to process it</li>
              <li>Don't upload illegal or stolen data</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2. No guarantees</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI scoring is our best effort, not perfect</li>
              <li>We don't guarantee specific results or conversion rates</li>
              <li>You're responsible for verifying leads before contacting them</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">3. One-time payment</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>All sales are final</li>
              <li>No refunds after processing starts</li>
              <li>If processing fails due to our error, we'll refund or reprocess</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">4. Service availability</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We aim for reliable uptime but don't guarantee it</li>
              <li>Service provided "as-is"</li>
              <li>We may change pricing or features at any time</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">What We Won't Do</h2>
            <ul className="list-none space-y-1">
              <li>Sell your data</li>
              <li>Contact your leads</li>
              <li>Permanently store your data</li>
              <li>Use your data to train AI models</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">Liability</h2>
            <p>We're not liable for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Decisions you make based on AI scores</li>
              <li>Data quality issues in your uploaded file</li>
              <li>Lost revenue from missed opportunities</li>
              <li>Any damages beyond what you paid us</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">Termination</h2>
            <p>
              We can refuse service to anyone for any reason. You can stop using the 
              service anytime (no account to cancel).
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">Governing Law</h2>
            <p>
              These terms are governed by South Carolina law. Any disputes go to SC courts.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">Contact</h2>
            <p>Questions: hello@sortleads.io</p>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Plain English:</strong> You upload leads, we score them with AI, 
                you download results. No refunds once processing starts. 
                Not our fault if AI scores aren't perfect. Don't upload data you shouldn't have.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
