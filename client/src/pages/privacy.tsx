import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold mb-2">Privacy Policy - SortLeads</h1>
            <p className="text-muted-foreground mb-6">Last updated: {today}</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">What We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">Files You Upload</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We temporarily store your lead spreadsheet in memory to process it</li>
              <li>Data is not persisted to disk and is cleared when the server restarts</li>
              <li>We do not use your data to train AI models</li>
              <li>We do not sell or share your data with third parties</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Payment Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Credit card data is processed by Stripe (stripe.com)</li>
              <li>We never see or store your credit card numbers</li>
              <li>Stripe is PCI-DSS Level 1 certified</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Email Address</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We collect your email address when you upload leads to track your free tier usage (first 50 leads free)</li>
              <li>Your email is stored in our database alongside a count of free leads used</li>
              <li>We do not send marketing emails or share your email with third parties</li>
              <li>Your email is used solely to manage your free tier allowance</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Analytics</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We use Google Analytics, Microsoft Clarity, and PostHog to understand how people use our tool</li>
              <li>These services collect anonymous usage data such as pages visited and features used</li>
              <li>Microsoft Clarity may record anonymized session replays and heatmaps</li>
              <li>No personally identifiable information is shared with analytics providers beyond your email (if provided)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">What We Don't Collect</h3>
            <ul className="list-none space-y-1">
              <li>No user accounts or passwords</li>
              <li>No phone numbers or personal identification</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">How We Use Your Data</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong>To process your leads:</strong> We send company names and contact info to Anthropic's Claude AI to score and prioritize leads</li>
              <li><strong>To generate results:</strong> We create a downloadable spreadsheet with scored leads</li>
              <li><strong>For payment processing:</strong> Stripe handles all payment data</li>
            </ol>
            <p className="mt-2">That's it. We don't use your data for anything else.</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">Data Security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>All connections use HTTPS/TLS encryption</li>
              <li>Data is processed in memory and not written to permanent storage</li>
              <li>Lead data is cleared when you close your browser session</li>
              <li>Hosted on secure cloud infrastructure</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">AI Data Protection</h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
              <p className="font-medium mb-2">Your lead data is protected by Anthropic's Commercial API guarantees:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Never used for AI training</strong> - Anthropic contractually guarantees they do not train models on Commercial API data</li>
                <li><strong>7-day retention only</strong> - Data is automatically deleted from Anthropic's systems within 7 days</li>
                <li><strong>Not sold or shared</strong> - Your data is never sold to third parties</li>
                <li><strong>Encrypted in transit</strong> - All API calls use TLS encryption</li>
              </ul>
            </div>

            <h2 className="text-xl font-semibold mt-6 mb-3">Third-Party Services</h2>
            <p>We use these services to operate:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Anthropic (Claude AI):</strong> Processes lead data via their Commercial API with contractual data protection guarantees. Data is never used for training and is deleted within 7 days.{" "}
                <a href="https://www.anthropic.com/legal/commercial-terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Commercial Terms
                </a>
              </li>
              <li>
                <strong>Stripe:</strong> Processes payments.{" "}
                <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Stripe Privacy Policy
                </a>
              </li>
              <li>
                <strong>Vercel & Railway:</strong> Host our frontend and backend infrastructure.{" "}
                <a href="https://vercel.com/legal/privacy-policy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Vercel Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google Analytics:</strong> Tracks anonymous page views and usage patterns.{" "}
                <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <strong>Microsoft Clarity:</strong> Session replays and heatmaps for UX improvement.{" "}
                <a href="https://privacy.microsoft.com/en-us/privacystatement" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Microsoft Privacy Statement
                </a>
              </li>
              <li>
                <strong>PostHog:</strong> Product analytics for feature usage tracking.{" "}
                <a href="https://posthog.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  PostHog Privacy Policy
                </a>
              </li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">Your Rights</h2>
            
            <h3 className="text-lg font-medium mt-4 mb-2">Your Data</h3>
            <p>
              Your lead data is processed in memory and not permanently stored. 
              Once you download your results, that's all we have. Your email address and free tier usage count 
              are stored in our database. You can request deletion of your email data by contacting us.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Questions</h3>
            <p>Email: hello@sortleads.io</p>

            <h2 className="text-xl font-semibold mt-6 mb-3">Changes to This Policy</h2>
            <p>
              We'll update this page if our privacy practices change. 
              Check back occasionally.
            </p>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Simple version:</strong> We collect your email to track your free tier usage (first 50 leads free). 
                We process your leads with AI, give you results, and don't permanently store your lead data. 
                We don't sell data, send marketing emails, or create accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
