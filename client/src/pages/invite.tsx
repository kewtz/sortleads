import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, session, loading: authLoading } = useAuth();

  const [orgName, setOrgName] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepted" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  // Fetch invite details
  useEffect(() => {
    fetch(`/api/org/invite/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Invalid invite");
        }
        return res.json();
      })
      .then((data) => {
        setOrgName(data.orgName);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }, [params.token]);

  // If not signed in, redirect to auth with return URL
  useEffect(() => {
    if (!authLoading && !user && status === "ready") {
      // Store the invite URL so we can redirect back after auth
      sessionStorage.setItem("sortleads_invite_redirect", `/invite/${params.token}`);
      setLocation("/auth");
    }
  }, [authLoading, user, status, params.token, setLocation]);

  // Auto-accept if user is signed in and was redirected back from auth
  useEffect(() => {
    if (user && session?.access_token && status === "ready" && !isAccepting) {
      acceptInvite();
    }
  }, [user, session?.access_token, status]);

  const acceptInvite = async () => {
    if (!session?.access_token) return;
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/org/invite/${params.token}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to accept invite");
      }
      setStatus("accepted");
      // Clear any stored redirect
      sessionStorage.removeItem("sortleads_invite_redirect");
      setTimeout(() => setLocation("/upload"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invite");
      setStatus("error");
    }
  };

  if (status === "loading" || authLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading invite...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-md">
        <CardContent className="p-8 text-center">
          {status === "error" && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <h2 className="mb-2 text-xl font-bold">Invite not available</h2>
              <p className="mb-6 text-muted-foreground">{errorMsg}</p>
              <Button asChild variant="outline">
                <a href="/">Go to home</a>
              </Button>
            </>
          )}

          {status === "ready" && !user && (
            <>
              <Users className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h2 className="mb-2 text-xl font-bold">Join {orgName}</h2>
              <p className="mb-6 text-muted-foreground">Sign in or create an account to join this team.</p>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Redirecting to sign in...</p>
            </>
          )}

          {status === "ready" && user && isAccepting && (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <h2 className="mb-2 text-xl font-bold">Joining {orgName}...</h2>
            </>
          )}

          {status === "accepted" && (
            <>
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h2 className="mb-2 text-xl font-bold">You're in!</h2>
              <p className="mb-6 text-muted-foreground">
                Welcome to {orgName}. Redirecting to upload...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
