import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Zap,
  Users,
  FileSpreadsheet,
  Layers
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

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const [job, setJob] = useState<Job | null>(null);
  const [recentLeads, setRecentLeads] = useState<ProcessedLead[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  useEffect(() => {
    // Save job ID to localStorage for page refresh recovery
    if (params.id) {
      localStorage.setItem('sortleads_active_job', params.id);
    }

    // Fetch initial job data and start processing if just paid
    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setJob(data);
          
          // If already completed, redirect to results
          if (data.status === 'completed') {
            localStorage.removeItem('sortleads_active_job');
            setLocation(`/results/${params.id}`);
            return;
          }
          
          // If job is pending and we just came from payment, start processing
          const urlParams = new URLSearchParams(window.location.search);
          if (data.status === 'pending' && urlParams.get('paid') === 'true') {
            // Clear the URL param
            window.history.replaceState({}, '', `/processing/${params.id}`);
            
            // Start processing
            await fetch(`/api/jobs/${params.id}/start`, {
              method: 'POST',
            });
          }
          
          // Restore progress if resuming
          if (data.processedLeads > 0) {
            setProcessedCount(data.processedLeads);
          }
        }
      } catch (error) {
        console.error('Failed to fetch job:', error);
      }
    };

    fetchJob();

    // Set up SSE for real-time updates
    const eventSource = new EventSource(`/api/jobs/${params.id}/stream`);
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: ProcessingEvent = JSON.parse(event.data);
        
        switch (data.type) {
          case 'started':
            if (data.total) {
              setJob(prev => prev ? { ...prev, totalLeads: data.total! } : null);
              trackProcessingStarted(params.id!, data.total);
            }
            break;
            
          case 'batch_start':
            if (data.batchNumber && data.totalBatches) {
              setCurrentBatch(data.batchNumber);
              setTotalBatches(data.totalBatches);
            }
            break;
            
          case 'batch_complete':
            if (data.processed !== undefined) {
              setProcessedCount(data.processed);
            }
            if (data.errors !== undefined) {
              setErrorCount(data.errors);
            }
            if (data.batchNumber && data.totalBatches) {
              setCurrentBatch(data.batchNumber);
              setTotalBatches(data.totalBatches);
            }
            // Add batch results to recent leads (keep last 5)
            if (data.batchResults && data.batchResults.length > 0) {
              setRecentLeads(prev => [...data.batchResults!, ...prev].slice(0, 5));
            }
            break;
            
          case 'complete':
            setJob(prev => prev ? { ...prev, status: 'completed' } : null);
            setProcessedCount(prev => {
              trackProcessingCompleted(params.id!, data.processed || prev, 0, 0, 0);
              return data.processed || prev;
            });
            localStorage.removeItem('sortleads_active_job');
            setTimeout(() => {
              setLocation(`/results/${params.id}`);
            }, 1500);
            break;
            
          case 'error':
            setJob(prev => prev ? { ...prev, status: 'failed', error: data.error } : null);
            localStorage.removeItem('sortleads_active_job');
            break;
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
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
  const isComplete = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Hot':
        return 'bg-red-500 dark:bg-red-600 text-white';
      case 'Warm':
        return 'bg-amber-500 dark:bg-amber-600 text-white';
      case 'Cold':
        return 'bg-slate-400 dark:bg-slate-500 text-white';
      default:
        return '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
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
                : "Analyzing Your Leads"
            }
          </h1>
          <p className="text-muted-foreground">
            {isComplete 
              ? "Redirecting to your results..." 
              : isFailed 
                ? job?.error || "Something went wrong. Please try again." 
                : "AI is reviewing leads in batches for faster processing."
            }
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
                {errorCount} lead{errorCount !== 1 ? 's' : ''} couldn't be analyzed
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="stat-total">
                  {job?.totalLeads || 0}
                </div>
                <div className="text-xs text-muted-foreground">Total Leads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 dark:text-green-400" data-testid="stat-processed">
                  {processedCount}
                </div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground" data-testid="stat-remaining">
                  {Math.max(0, (job?.totalLeads || 0) - processedCount)}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Leads from Latest Batch */}
        {recentLeads.length > 0 && !isComplete && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Recently Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentLeads.slice(0, 3).map((lead, index) => (
                <div 
                  key={lead.id || index} 
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" data-testid={`text-recent-lead-name-${index}`}>
                      {lead.name || 'Unknown'}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {lead.title && `${lead.title} at `}
                      {lead.company || 'Unknown Company'}
                    </p>
                  </div>
                  <Badge 
                    className={getPriorityBadgeClass(lead.priorityLabel)}
                    data-testid={`badge-priority-${index}`}
                  >
                    {lead.priorityLabel}
                  </Badge>
                </div>
              ))}
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
                <p className="font-medium" data-testid="text-job-filename">{job.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  Uploaded {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tip for large lists */}
        {(job?.totalLeads || 0) > 100 && !isComplete && !isFailed && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Processing large lists can take a few minutes. Feel free to leave this page - 
            we'll email you when your results are ready.
          </p>
        )}
      </div>
    </div>
  );
}
