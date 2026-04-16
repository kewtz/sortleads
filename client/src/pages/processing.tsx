import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  FileSpreadsheet,
  Layers,
  Flame,
  ThermometerSun,
  Snowflake,
  Download,
} from "lucide-react";
import type { Job, ProcessedLead } from "@/lib/types";
import { trackProcessingStarted, trackProcessingCompleted } from "@/lib/analytics";

interface ProcessingEvent {
  type: string;
  total?: number;
  processed?: number;
  errors?: number;
  batchNumber?: number;
  totalBatches?: number;
  batchSize?: number;
  batchResults?: ProcessedLead[];
  error?: string;
}

const priorityOrder = (label: string) =>
  label === "Hot" ? 0 : label === "Warm" ? 1 : label === "Cold" ? 2 : 3;

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const [job, setJob] = useState<Job | null>(null);
  const [allResults, setAllResults] = useState<ProcessedLead[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const redirectedRef = useRef(false);

  // Merge new results into allResults, dedup by lead.id
  const mergeResults = (incoming: ProcessedLead[]) => {
    setAllResults(prev => {
      const byId = new Map(prev.map(r => [r.id, r]));
      for (const r of incoming) {
        byId.set(r.id, r);
      }
      return Array.from(byId.values());
    });
  };

  useEffect(() => {
    if (params.id) {
      localStorage.setItem("sortleads_active_job", params.id);
    }

    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${params.id}`);
        if (!response.ok) return;
        const data = await response.json();
        setJob(data);

        // Hydrate allResults from whatever's scored so far (handles page refresh mid-job)
        if (Array.isArray(data.results) && data.results.length > 0) {
          mergeResults(data.results);
        }

        if (typeof data.processedLeads === "number") {
          setProcessedCount(data.processedLeads);
        }

        if (data.status === "completed" && !redirectedRef.current) {
          redirectedRef.current = true;
          localStorage.removeItem("sortleads_active_job");
          setLocation(`/results/${params.id}`);
          return;
        }

        // If pending and arrived from checkout, kick off processing
        const urlParams = new URLSearchParams(window.location.search);
        if (data.status === "pending" && urlParams.get("paid") === "true") {
          window.history.replaceState({}, "", `/processing/${params.id}`);
          await fetch(`/api/jobs/${params.id}/start`, { method: "POST" });
        }
      } catch (error) {
        console.error("Failed to fetch job:", error);
      }
    };

    fetchJob();

    const eventSource = new EventSource(`/api/jobs/${params.id}/stream`);

    eventSource.onopen = () => setIsConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data: ProcessingEvent = JSON.parse(event.data);

        switch (data.type) {
          case "started":
            if (data.total) {
              setJob(prev => (prev ? { ...prev, totalLeads: data.total! } : null));
              trackProcessingStarted(params.id!, data.total);
            }
            break;

          case "batch_start":
            if (data.batchNumber && data.totalBatches) {
              setCurrentBatch(data.batchNumber);
              setTotalBatches(data.totalBatches);
            }
            break;

          case "batch_complete":
            if (typeof data.processed === "number") setProcessedCount(data.processed);
            if (typeof data.errors === "number") setErrorCount(data.errors);
            if (data.batchNumber && data.totalBatches) {
              setCurrentBatch(data.batchNumber);
              setTotalBatches(data.totalBatches);
            }
            if (data.batchResults && data.batchResults.length > 0) {
              mergeResults(data.batchResults);
            }
            break;

          case "complete":
            setJob(prev => (prev ? { ...prev, status: "completed" } : null));
            setProcessedCount(prev => {
              const finalCount = data.processed ?? prev;
              trackProcessingCompleted(params.id!, finalCount, 0, 0, 0);
              return finalCount;
            });
            localStorage.removeItem("sortleads_active_job");
            // Short pause so the user sees the "complete" state before being
            // taken to the full results page with bulk actions + download.
            setTimeout(() => {
              if (!redirectedRef.current) {
                redirectedRef.current = true;
                setLocation(`/results/${params.id}`);
              }
            }, 2500);
            break;

          case "error":
            setJob(prev =>
              prev ? { ...prev, status: "failed", error: data.error } : null,
            );
            localStorage.removeItem("sortleads_active_job");
            break;
        }
      } catch (e) {
        console.error("Failed to parse SSE event:", e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [params.id, setLocation]);

  const progress = job?.totalLeads ? (processedCount / job.totalLeads) * 100 : 0;
  const isComplete = job?.status === "completed";
  const isFailed = job?.status === "failed";

  // Live-sorted view: Hot > Warm > Cold, then descending priority score.
  // Also computed live counts from the actual results we've seen so far.
  const { sortedResults, hotCount, warmCount, coldCount } = useMemo(() => {
    const sorted = [...allResults].sort((a, b) => {
      const po = priorityOrder(a.priorityLabel) - priorityOrder(b.priorityLabel);
      if (po !== 0) return po;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
    return {
      sortedResults: sorted,
      hotCount: sorted.filter(r => r.priorityLabel === "Hot").length,
      warmCount: sorted.filter(r => r.priorityLabel === "Warm").length,
      coldCount: sorted.filter(r => r.priorityLabel === "Cold").length,
    };
  }, [allResults]);

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
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {isComplete ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : isFailed ? (
              <XCircle className="h-8 w-8 text-destructive" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
          </div>

          <h1 className="mb-3 text-3xl font-bold tracking-tight">
            {isComplete
              ? "Processing Complete!"
              : isFailed
                ? "Processing Failed"
                : "Analyzing Your Leads"}
          </h1>
          <p className="text-muted-foreground">
            {isComplete
              ? "Taking you to your full results..."
              : isFailed
                ? job?.error || "Something went wrong. Please try again."
                : "Results appear below as each lead is scored. Hot leads show up first."}
          </p>
        </div>

        {/* Progress Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Processing Progress
              </span>
              <div className="flex items-center gap-2">
                {totalBatches > 0 && !isComplete && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Batch {currentBatch}/{totalBatches}
                  </Badge>
                )}
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? "Live" : "Connecting..."}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {processedCount} of {job?.totalLeads || 0} leads processed
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" data-testid="progress-bar" />
            </div>

            {errorCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {errorCount} lead{errorCount !== 1 ? "s" : ""} couldn't be analyzed
                (see table below for details)
              </p>
            )}

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                  <Flame className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none" data-testid="count-hot">
                    {hotCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Hot</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                  <ThermometerSun className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none" data-testid="count-warm">
                    {warmCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Warm</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-500/10">
                  <Snowflake className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none" data-testid="count-cold">
                    {coldCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Cold</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Results Table */}
        {sortedResults.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Scored so far ({sortedResults.length})
              </CardTitle>
              {isComplete && (
                <Button asChild size="sm" className="gap-2">
                  <Link href={`/results/${params.id}`}>
                    <Download className="h-4 w-4" />
                    Open full results
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="max-h-[480px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="hidden md:table-cell">Title</TableHead>
                      <TableHead className="w-[110px]">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((lead) => (
                      <TableRow key={lead.id} data-testid={`row-live-${lead.id}`}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>{lead.company || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {lead.title || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`gap-1 ${getPriorityBadgeClass(lead.priorityLabel)}`}
                          >
                            {getPriorityIcon(lead.priorityLabel)}
                            {lead.priorityLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Info */}
        {job && (
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium" data-testid="text-job-filename">
                  {job.fileName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Uploaded {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {(job?.totalLeads || 0) > 100 && !isComplete && !isFailed && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Large lists take a few minutes. Feel free to leave this page — your
            scored leads are saved as they come in.
          </p>
        )}
      </div>
    </div>
  );
}
