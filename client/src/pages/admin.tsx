import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  UserPlus,
  Copy,
  Trash2,
  Users,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrgInfo {
  id: string;
  name: string;
  ownerId: string;
  tier: string;
  role: string;
}

interface Member {
  userId: string;
  email: string;
  role: string;
  leadsUsed: number;
  status: string;
  invitedAt: string;
}

interface Invite {
  id: string;
  email: string | null;
  token: string;
  expiresAt: string;
}

export default function AdminPage() {
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h["Authorization"] = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const fetchAll = useCallback(async () => {
    try {
      const [orgRes, membersRes, invitesRes] = await Promise.all([
        fetch("/api/org", { headers: authHeaders() }),
        fetch("/api/org/members", { headers: authHeaders() }),
        fetch("/api/org/invites", { headers: authHeaders() }),
      ]);
      if (orgRes.ok) {
        const data = await orgRes.json();
        setOrg(data.org);
        if (!data.org) {
          setLocation("/upload");
          return;
        }
        if (data.org.role !== "admin") {
          setLocation("/upload");
          return;
        }
      }
      if (membersRes.ok) setMembers((await membersRes.json()).members);
      if (invitesRes.ok) setInvites((await invitesRes.json()).invites);
    } catch {}
    finally {
      setLoading(false);
    }
  }, [authHeaders, setLocation]);

  useEffect(() => {
    if (session?.access_token) fetchAll();
  }, [session?.access_token, fetchAll]);

  const createInvite = async () => {
    setIsCreatingInvite(true);
    setNewInviteLink(null);
    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: inviteEmail || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { invite } = await res.json();
      const link = `${window.location.origin}/invite/${invite.token}`;
      setNewInviteLink(link);
      setInviteEmail("");
      toast({ title: "Invite created", description: "Copy the link and share it with your team." });
      fetchAll();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const copyLink = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const removeMember = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the team?`)) return;
    try {
      const res = await fetch(`/api/org/members/${userId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Member removed" });
      fetchAll();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await fetch(`/api/org/invites/${id}`, { method: "DELETE", headers: authHeaders() });
      toast({ title: "Invite revoked" });
      fetchAll();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) return null;

  const totalLeadsUsed = members.reduce((sum, m) => sum + m.leadsUsed, 0);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/upload">
          <Button variant="ghost" className="mb-4 -ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to upload
          </Button>
        </Link>

        {/* Org header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
            <Badge className="bg-primary/10 text-primary" variant="outline">
              <ShieldCheck className="mr-1 h-3 w-3" /> Portfolio
            </Badge>
          </div>
          <p className="text-muted-foreground">Manage your team and monitor usage.</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-sm text-muted-foreground">Team members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalLeadsUsed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total leads scored</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">Active</p>
                <p className="text-sm text-muted-foreground">Subscription status</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invite section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite a team member
            </CardTitle>
            <CardDescription>
              Create an invite link and share it. Anyone with the link can join your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email (optional — for your reference)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button onClick={createInvite} disabled={isCreatingInvite} className="shrink-0 gap-2">
                {isCreatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                Create link
              </Button>
            </div>
            {newInviteLink && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 truncate text-sm">{newInviteLink}</code>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyLink(newInviteLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {invites.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Pending invites ({invites.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.email || "Open invite"}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyLink(`${window.location.origin}/invite/${inv.token}`)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => revokeInvite(inv.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Leads scored</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell className="font-medium">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.role === "admin" ? "bg-primary/10 text-primary" : ""}>
                          {m.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.leadsUsed.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(m.invitedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {m.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeMember(m.userId, m.email)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
