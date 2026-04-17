import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Supabase handles the token exchange automatically when the page loads
    // with the correct hash params. We just need to wait for the session to
    // appear, then redirect.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLocation("/upload");
      } else {
        // If no session after callback, something went wrong — send to sign in
        setLocation("/auth");
      }
    });
  }, [setLocation]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Confirming your account...</p>
    </div>
  );
}
