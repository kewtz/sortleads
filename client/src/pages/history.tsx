import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Download,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Job } from "@/lib/types";

export default function HistoryPage() {
  const { session } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/jobs", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400" variant="outline">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        );
      case "processing":
        return (
          <Badge className="gap-1 bg-primary/10 text-primary" variant="outline">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing
          </Badge>
        );
      case "failed":
        return (
          <Badge className="gap-1 bg-destructive/10 text-destructive" variant="outline">
            <XCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge className="gap-1" variant="outline">
            <Clock className="h-3 w-3" /> {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Uploads</h1>
            <p className="text-muted-foreground">
              {jobs.length === 0
                ? "No uploads yet."
                : `${jobs.length} upload${jobs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              New upload
            </Link>
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">No scored lists yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV or Excel file to get started.
                </p>
              </div>
              <Button asChild className="gap-2">
                <Link href="/upload">
                  Upload your first list
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id} className="transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{job.fileName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{job.totalLeads} leads</span>
                        <span>·</span>
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(job.status)}
                    {job.status === "completed" && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/results/${job.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async (e) => {
                            e.preventDefault();
                            const res = await fetch(`/api/jobs/${job.id}/download`);
                            if (!res.ok) return;
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `prioritized-${job.fileName.replace(/\.(csv|xlsx?)$/i, "")}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {job.status === "processing" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/processing/${job.id}`}>View progress</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
