import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileSpreadsheet,
  X,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Gift,
  Mail,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FREE_TIER_LEAD_LIMIT } from "@/lib/types";
import {
  trackEmailEntered,
  trackFileUploaded,
  trackFreeTierActivated,
} from "@/lib/analytics";
import * as XLSX from "xlsx";

interface FreeTierStatus {
  freeLeadsUsed: number;
  freeLeadsRemaining: number;
  freeLeadLimit: number;
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<{ headers: string[]; rowCount: number } | null>(null);
  const [freeTierStatus, setFreeTierStatus] = useState<FreeTierStatus | null>(null);
  const [isCheckingFreeTier, setIsCheckingFreeTier] = useState(false);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const enhanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const freeLeadsRemaining = freeTierStatus?.freeLeadsRemaining ?? FREE_TIER_LEAD_LIMIT;
  const totalLeads = parseResult?.rowCount || 0;
  const freeLeadsApplied = Math.min(totalLeads, freeLeadsRemaining);
  const billableLeads = Math.max(totalLeads - freeLeadsApplied, 0);

  const isFullyFree = totalLeads > 0 && billableLeads === 0;
  const exceedsFreeTier = totalLeads > 0 && billableLeads > 0;

  const redirectToPricing = () => {
    window.location.href = "/#pricing";
  };

  const checkFreeTier = useCallback(async (emailValue: string) => {
    const trimmed = emailValue.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setFreeTierStatus(null);
      return;
    }

    setIsCheckingFreeTier(true);
    try {
      const response = await fetch("/api/free-tier/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (response.ok) {
        const data = await response.json();
        setFreeTierStatus(data);
        trackEmailEntered(trimmed, data.freeLeadsRemaining);
      }
    } catch {
      // Fail silently - show default free tier
    } finally {
      setIsCheckingFreeTier(false);
    }
  }, []);

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
      emailCheckTimeoutRef.current = setTimeout(() => {
        checkFreeTier(value);
      }, 500);
    },
    [checkFreeTier],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  }, []);

  const validateAndSetFile = async (file: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const extension = file.name.toLowerCase().split(".").pop();
    const isValidExtension = ["csv", "xls", "xlsx"].includes(extension || "");

    if (!validTypes.includes(file.type) && !isValidExtension) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file (.csv, .xls, .xlsx)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setFile(file);
    trackFileUploaded(file.name, 0);

    if (extension === "csv") {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
        setParseResult({ headers, rowCount: lines.length - 1 });
      }
    } else {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });

        if (data.length > 0) {
          const headerRow = data[0] as unknown[];
          const headers = headerRow.map((h) => String(h || "").trim());
          setParseResult({ headers, rowCount: data.length - 1 });
        }
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        toast({
          title: "Error reading file",
          description: "Could not parse the Excel file. Please try a different file.",
          variant: "destructive",
        });
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setParseResult(null);
  };

  const handlePromptBlur = useCallback(async () => {
    const trimmed = prompt.trim();

    if (trimmed.length < 3 || trimmed.split(/\s+/).length >= 10 || trimmed.length >= 100) {
      return;
    }

    setSuggestion(null);

    if (enhanceTimeoutRef.current) {
      clearTimeout(enhanceTimeoutRef.current);
    }

    enhanceTimeoutRef.current = setTimeout(async () => {
      setIsEnhancing(true);
      try {
        const response = await fetch("/api/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.suggestion) {
            setSuggestion(data.suggestion);
          }
        }
      } catch (err) {
        console.error("Failed to enhance prompt:", err);
      } finally {
        setIsEnhancing(false);
      }
    }, 300);
  }, [prompt]);

  const acceptSuggestion = () => {
    if (suggestion) {
      setPrompt(suggestion);
      setSuggestion(null);
    }
  };

  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please upload a spreadsheet first",
        variant: "destructive",
      });
      return;
    }

    if (prompt.trim().length < 10) {
      toast({
        title: "Please describe your ideal leads",
        description: "Write at least a few sentences about what makes a good lead for you",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address to continue",
        variant: "destructive",
      });
      return;
    }

    // Upfront guard: if this upload would exceed the free tier, route the user
    // to the pricing section to pick a subscription. Don't waste a job row.
    if (exceedsFreeTier) {
      redirectToPricing();
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", prompt);
      formData.append("email", email.trim());

      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      const result = await response.json();

      if (result.freeLeadsApplied > 0) {
        trackFreeTierActivated(result.totalLeads, result.freeLeadsApplied);
      }

      // Happy path: backend covered the whole job under the free tier and
      // returned a redirect to the processing page.
      if (result.redirect) {
        localStorage.setItem("sortleads_active_job", result.jobId);
        setLocation(result.redirect);
        return;
      }

      // Defensive: if the backend found billable leads (race condition between
      // free-tier check and upload, or a user whose allowance changed under
      // them), send them to pricing instead of silently failing.
      toast({
        title: "Subscription required",
        description:
          "This upload exceeds your free tier. Choose a subscription plan to continue.",
      });
      redirectToPricing();
    } catch (error) {
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const promptPlaceholder = `Example: I'm looking for manufacturing companies in the Midwest with 50-500 employees. Decision makers like Plant Managers, Operations Directors, or VP of Manufacturing are ideal. We sell industrial automation equipment, so companies that still use manual processes are our best fit.`;

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight" data-testid="text-upload-title">
            Sort Your Leads
          </h1>
          <p className="text-muted-foreground">
            Upload your spreadsheet, tell us what you're looking for, and get a prioritized list
            with next steps.
          </p>
        </div>

        <div className="space-y-6">
          {/* Free Tier Banner */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium" data-testid="text-free-tier-banner">
                  Your first {FREE_TIER_LEAD_LIMIT} leads are free
                </p>
                <p className="text-sm text-muted-foreground">
                  {freeTierStatus
                    ? freeTierStatus.freeLeadsRemaining > 0
                      ? `You have ${freeTierStatus.freeLeadsRemaining} free leads remaining. Larger lists require a subscription.`
                      : `You've used your free leads. Choose a subscription plan to continue.`
                    : `Enter your email below to get started. Larger lists require a subscription.`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Your Email
              </CardTitle>
              <CardDescription>
                We use your email to track your free lead allowance. We'll never spam you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  data-testid="input-email"
                />
                {isCheckingFreeTier && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking free tier status...
                  </div>
                )}
                {isEmailValid && freeTierStatus && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-free-tier-status">
                    {freeTierStatus.freeLeadsRemaining > 0 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-green-600 dark:text-green-400">
                          {freeTierStatus.freeLeadsRemaining} free leads remaining
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Free tier used ({freeTierStatus.freeLeadsUsed}/{FREE_TIER_LEAD_LIMIT} leads).
                          Subscription required to continue.
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload Spreadsheet
              </CardTitle>
              <CardDescription>
                CSV or Excel files with leads. Include columns like name, email, company, title.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-file"
                >
                  <input
                    type="file"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileSelect}
                    data-testid="input-file"
                  />
                  <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="mb-1 text-sm font-medium">Drag and drop your file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (CSV, XLSX up to 10MB - no macro files)
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-filename">
                          {file.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                          {parseResult && ` • ${parseResult.rowCount} leads found`}
                        </p>
                        {parseResult && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {parseResult.headers.slice(0, 6).map((header, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                              >
                                {header}
                              </span>
                            ))}
                            {parseResult.headers.length > 6 && (
                              <span className="text-xs text-muted-foreground">
                                +{parseResult.headers.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Card: Free vs Subscription-required */}
          {parseResult && parseResult.rowCount > 0 && (
            <>
              {isFullyFree && (
                <Card
                  className="border-green-500/30 bg-green-500/5"
                  data-testid="section-status-free"
                >
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                      <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">Free</p>
                      <p className="text-sm text-muted-foreground">
                        {totalLeads} leads covered by your free tier (
                        {freeLeadsRemaining - totalLeads} remaining after this)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {exceedsFreeTier && (
                <Card
                  className="border-primary/30 bg-primary/5"
                  data-testid="section-status-subscription-required"
                >
                  <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Subscription required</p>
                        <p className="text-sm text-muted-foreground">
                          This list has {totalLeads} leads. Your free tier covers{" "}
                          {freeLeadsApplied}; the other {billableLeads} need an annual plan.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="gap-2 sm:shrink-0"
                      onClick={redirectToPricing}
                      data-testid="button-view-pricing"
                    >
                      View plans
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Prompt Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Describe Your Ideal Lead
              </CardTitle>
              <CardDescription>
                Tell us in 3-4 sentences what makes a great lead for you. What industry, company
                size, job titles, or other criteria matter?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="prompt" className="sr-only">
                  Describe your ideal lead
                </Label>
                <Textarea
                  id="prompt"
                  placeholder={promptPlaceholder}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setSuggestion(null);
                  }}
                  onBlur={handlePromptBlur}
                  className="min-h-[150px] resize-none"
                  data-testid="textarea-prompt"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{prompt.length} characters</p>
                  {isEnhancing && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Enhancing...</span>
                    </div>
                  )}
                </div>

                {suggestion && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Would you like to expand this?</span>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground" data-testid="text-suggestion">
                      "{suggestion}"
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={acceptSuggestion}
                        className="gap-1"
                        data-testid="button-accept-suggestion"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Yes, use this
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={dismissSuggestion}
                        data-testid="button-dismiss-suggestion"
                      >
                        No, keep mine
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            className="w-full gap-2"
            size="lg"
            disabled={!file || prompt.trim().length < 10 || !isEmailValid || isUploading}
            onClick={handleSubmit}
            data-testid="button-submit"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : exceedsFreeTier ? (
              <>
                View subscription plans
                <ArrowRight className="h-4 w-4" />
              </>
            ) : isFullyFree ? (
              <>
                Sort My Leads — Free
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Sort My Leads
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {/* Help Text */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="mb-1 font-medium">Tips for best results:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Make sure your spreadsheet has column headers in the first row</li>
                  <li>Include at least name and company for each lead</li>
                  <li>Email and title columns help with better prioritization</li>
                  <li>
                    Be specific in your description - mention industries, company sizes, and titles
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Protection Trust Badge */}
          <div className="rounded-lg border bg-card p-4" data-testid="section-data-protection">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
              <div className="text-sm">
                <p className="mb-1 font-medium">Your data is protected</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <strong>Never used for AI training</strong> - Anthropic's Commercial API
                    guarantee
                  </li>
                  <li>
                    <strong>Auto-deleted in 7 days</strong> - No long-term data storage
                  </li>
                  <li>
                    <strong>Encrypted connections</strong> - All data transmitted securely
                  </li>
                </ul>
                <a
                  href="/privacy"
                  className="mt-2 inline-block text-primary hover:underline"
                  data-testid="link-privacy-policy"
                >
                  Read our Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
