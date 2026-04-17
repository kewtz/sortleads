import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (!loading && user) {
      setLocation("/upload");
    }
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "reset") {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast({ title: "Check your email", description: "Password reset link sent." });
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setConfirmationSent(true);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        setLocation("/upload");
      }
    } catch (err) {
      toast({
        title: mode === "signin" ? "Sign in failed" : mode === "signup" ? "Sign up failed" : "Reset failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (confirmationSent) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold">Check your email</h2>
            <p className="mb-6 text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account, then come back here to sign in.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmationSent(false);
                setMode("signin");
              }}
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md">
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create an account" : "Reset password"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to upload and score your leads."
                : mode === "signup"
                  ? "Free to start — your first 50 leads are on us."
                  : "Enter your email and we'll send a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-auth-email"
                />
              </div>

              {mode !== "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="input-auth-password"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-auth-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : mode === "signup" ? (
                  "Create account"
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              {mode === "signin" && (
                <>
                  <p className="text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      onClick={() => setMode("signup")}
                      className="text-primary hover:underline"
                    >
                      Sign up
                    </button>
                  </p>
                  <p>
                    <button
                      onClick={() => setMode("reset")}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("signin")}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {mode === "reset" && (
                <p>
                  <button
                    onClick={() => setMode("signin")}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
