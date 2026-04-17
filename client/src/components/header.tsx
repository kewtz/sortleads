import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { FileSpreadsheet, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const [location] = useLocation();
  const { user, session } = useAuth();
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  // Check if the signed-in user is an org admin (lightweight — one fetch on mount)
  useEffect(() => {
    if (!user || !session?.access_token) {
      setIsOrgAdmin(false);
      return;
    }
    fetch("/api/org", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setIsOrgAdmin(data?.org?.role === "admin");
      })
      .catch(() => setIsOrgAdmin(false));
  }, [user, session?.access_token]);

  const scrollToSection = (id: string) => {
    if (location !== "/") {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight" data-testid="text-logo">
            SortLeads<span className="text-primary">.io</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {location === "/" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection("sample-output")} data-testid="nav-sample-output">
                Example
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection("how-it-works")} data-testid="nav-how-it-works">
                How It Works
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection("pricing")} data-testid="nav-pricing">
                Pricing
              </Button>
            </>
          )}
          {location !== "/" && (
            <Button variant="ghost" size="sm" asChild data-testid="link-home">
              <Link href="/">Home</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild data-testid="nav-about">
            <Link href="/about">About</Link>
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild data-testid="nav-history">
                <Link href="/history">My Uploads</Link>
              </Button>
              {isOrgAdmin && (
                <Button variant="ghost" size="sm" asChild className="gap-1" data-testid="nav-admin">
                  <Link href="/admin">
                    <Settings className="h-3.5 w-3.5" />
                    Admin
                  </Link>
                </Button>
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline" data-testid="text-header-email">
                {user.email}
              </span>
              <Button variant="default" size="sm" asChild data-testid="link-start">
                <Link href="/upload">Sort My Leads</Link>
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" asChild data-testid="link-sign-in">
              <Link href="/auth">Sign in</Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
