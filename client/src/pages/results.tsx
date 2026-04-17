import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Download, 
  ArrowLeft,
  Flame,
  ThermometerSun,
  Snowflake,
  ChevronDown,
  ChevronUp,
  Filter,
  Copy,
  CheckSquare,
  X
} from "lucide-react";
import type { Job, ProcessedLead } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { trackResultsDownloaded, trackPageView } from "@/lib/analytics";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/jobs/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setJob(data);
        } else {
          toast({
            title: "Error loading results",
            description: "Could not find the job results",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error loading results",
          description: "Failed to load results. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    trackPageView('results');
  }, [params.id, toast]);

  const toggleRowExpand = (leadId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/jobs/${params.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prioritized-${job?.fileName || 'leads'}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      trackResultsDownloaded(params.id!, job?.results?.length || 0);
      toast({
        title: "Download complete",
        description: "Security tip: Do not enable macros or external content when opening this file.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredResults = job?.results?.filter(lead => 
    !filterPriority || lead.priorityLabel === filterPriority
  ) || [];

  // Clear selection when filter changes to avoid confusion
  useEffect(() => {
    setSelectedLeads(new Set());
  }, [filterPriority]);

  const hotCount = job?.results?.filter(l => l.priorityLabel === 'Hot').length || 0;
  const warmCount = job?.results?.filter(l => l.priorityLabel === 'Warm').length || 0;
  const coldCount = job?.results?.filter(l => l.priorityLabel === 'Cold').length || 0;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Hot':
        return <Flame className="h-4 w-4" />;
      case 'Warm':
        return <ThermometerSun className="h-4 w-4" />;
      case 'Cold':
        return <Snowflake className="h-4 w-4" />;
      default:
        return null;
    }
  };

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

  const toggleLeadSelection = (leadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredResults.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredResults.map(lead => lead.id)));
    }
  };

  const clearSelection = () => {
    setSelectedLeads(new Set());
  };

  const getSelectedLeads = (): ProcessedLead[] => {
    return filteredResults.filter(lead => selectedLeads.has(lead.id));
  };

  const sanitizeCSVField = (field: string | undefined): string => {
    if (!field) return '';
    const dangerous = /^[=+\-@\t\r]/;
    if (dangerous.test(field)) {
      return "'" + field;
    }
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  };

  const exportSelectedToCSV = () => {
    const selected = getSelectedLeads();
    if (selected.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select at least one lead to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Name', 'Email', 'Company', 'Title', 'Priority', 'Score', 'Estimated Value', 'Reasoning', 'Suggested Action', 'LinkedIn'];
    const rows = selected.map(lead => [
      sanitizeCSVField(lead.name),
      sanitizeCSVField(lead.email),
      sanitizeCSVField(lead.company),
      sanitizeCSVField(lead.title),
      sanitizeCSVField(lead.priorityLabel),
      lead.priority.toString(),
      sanitizeCSVField(lead.estimatedValue),
      sanitizeCSVField(lead.reasoning),
      sanitizeCSVField(lead.suggestedAction),
      sanitizeCSVField(lead.linkedInUrl),
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected-leads-${selected.length}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export complete",
      description: `Exported ${selected.length} selected leads`,
    });
  };

  const copySelectedEmails = async () => {
    const selected = getSelectedLeads();
    const emails = selected.filter(lead => lead.email).map(lead => lead.email);
    
    if (emails.length === 0) {
      toast({
        title: "No emails found",
        description: "None of the selected leads have email addresses",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(emails.join(', '));
      toast({
        title: "Emails copied",
        description: `${emails.length} email addresses copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const isAllSelected = filteredResults.length > 0 && selectedLeads.size === filteredResults.length;
  const isSomeSelected = selectedLeads.size > 0 && selectedLeads.size < filteredResults.length;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Results Not Found</h1>
          <p className="mb-6 text-muted-foreground">
            The job you're looking for doesn't exist or has expired.
          </p>
          <Button asChild>
            <Link href="/upload">Upload New List</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Download reminder banner */}
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm">
              <strong>Download your results</strong> — this is your scored and ranked lead list.
              You can always find it later under{" "}
              <Link href="/history" className="text-primary hover:underline">My Uploads</Link>.
            </p>
          </div>
          <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="shrink-0 gap-2">
            <Download className="h-3.5 w-3.5" />
            {isDownloading ? "..." : "Download CSV"}
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" asChild className="mb-2 -ml-4 gap-2">
              <Link href="/upload">
                <ArrowLeft className="h-4 w-4" />
                Upload Another List
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Your Prioritized Leads
            </h1>
            <p className="text-muted-foreground">
              {job.fileName} • {job.results?.length || 0} leads analyzed
            </p>
          </div>
          <Button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2"
            data-testid="button-download"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download CSV'}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card 
            className={`cursor-pointer transition-colors ${filterPriority === 'Hot' ? 'ring-2 ring-red-500' : 'hover-elevate'}`}
            onClick={() => setFilterPriority(filterPriority === 'Hot' ? null : 'Hot')}
            data-testid="card-hot-leads"
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <Flame className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-3xl font-bold" data-testid="count-hot">{hotCount}</p>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${filterPriority === 'Warm' ? 'ring-2 ring-amber-500' : 'hover-elevate'}`}
            onClick={() => setFilterPriority(filterPriority === 'Warm' ? null : 'Warm')}
            data-testid="card-warm-leads"
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <ThermometerSun className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold" data-testid="count-warm">{warmCount}</p>
                <p className="text-sm text-muted-foreground">Warm Leads</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${filterPriority === 'Cold' ? 'ring-2 ring-slate-500' : 'hover-elevate'}`}
            onClick={() => setFilterPriority(filterPriority === 'Cold' ? null : 'Cold')}
            data-testid="card-cold-leads"
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10">
                <Snowflake className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-3xl font-bold" data-testid="count-cold">{coldCount}</p>
                <p className="text-sm text-muted-foreground">Cold Leads</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter indicator */}
        {filterPriority && (
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Showing {filterPriority} leads only
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFilterPriority(null)}
              data-testid="button-clear-filter"
            >
              Clear filter
            </Button>
          </div>
        )}

        {/* Bulk Action Toolbar */}
        {selectedLeads.size > 0 && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium" data-testid="text-selected-count">
                  {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportSelectedToCSV}
                  className="gap-1"
                  data-testid="button-export-selected"
                >
                  <Download className="h-3 w-3" />
                  Export Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copySelectedEmails}
                  className="gap-1"
                  data-testid="button-copy-emails"
                >
                  <Copy className="h-3 w-3" />
                  Copy Emails
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-1"
                  data-testid="button-clear-selection"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Details</CardTitle>
            <CardDescription>
              Click on a row to see the full analysis and suggested action. Use checkboxes for bulk actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={isSomeSelected ? "indeterminate" : isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all leads"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[100px]">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((lead) => (
                      <>
                        <TableRow 
                          key={lead.id}
                          className={`cursor-pointer ${selectedLeads.has(lead.id) ? 'bg-primary/5' : ''}`}
                          onClick={() => toggleRowExpand(lead.id)}
                          data-testid={`row-lead-${lead.id}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedLeads.has(lead.id)}
                              onCheckedChange={() => {
                                setSelectedLeads(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(lead.id)) {
                                    newSet.delete(lead.id);
                                  } else {
                                    newSet.add(lead.id);
                                  }
                                  return newSet;
                                });
                              }}
                              aria-label={`Select ${lead.name || 'lead'}`}
                              data-testid={`checkbox-lead-${lead.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRows.has(lead.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            {lead.name || '-'}
                          </TableCell>
                          <TableCell>{lead.company || '-'}</TableCell>
                          <TableCell>{lead.title || '-'}</TableCell>
                          <TableCell>
                            <Badge className={`gap-1 ${getPriorityBadgeClass(lead.priorityLabel)}`}>
                              {getPriorityIcon(lead.priorityLabel)}
                              {lead.priorityLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.estimatedValue}</Badge>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(lead.id) && (
                          <TableRow key={`${lead.id}-expanded`}>
                            <TableCell colSpan={7} className="bg-muted/50 p-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                    Why this priority?
                                  </p>
                                  <p className="text-sm" data-testid={`text-reasoning-${lead.id}`}>
                                    {lead.reasoning}
                                  </p>
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                    Suggested Action
                                  </p>
                                  <p className="text-sm font-medium text-primary" data-testid={`text-action-${lead.id}`}>
                                    {lead.suggestedAction}
                                  </p>
                                </div>
                                {lead.email && (
                                  <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                      Email
                                    </p>
                                    <p className="text-sm">{lead.email}</p>
                                  </div>
                                )}
                                {lead.phone && (
                                  <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                      Phone
                                    </p>
                                    <p className="text-sm">{lead.phone}</p>
                                  </div>
                                )}
                                {lead.linkedInUrl && (
                                  <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                      LinkedIn
                                    </p>
                                    <a 
                                      href={lead.linkedInUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline"
                                      data-testid={`link-linkedin-${lead.id}`}
                                    >
                                      View Profile
                                    </a>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-between">
          <Button variant="outline" asChild>
            <Link href="/upload">Upload Another List</Link>
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Full Report'}
          </Button>
        </div>

        {/* Demo Mode Upsell Banner */}
        {job.isDemo && (
          <Card className="mt-8 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:text-left">
              <div className="flex-1">
                <h3 className="font-semibold">Ready to sort your real leads?</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your own lead list to get the same AI-powered prioritization on your actual prospects.
                </p>
              </div>
              <Button asChild data-testid="button-get-started-demo">
                <Link href="/upload">Upload Your Leads</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
