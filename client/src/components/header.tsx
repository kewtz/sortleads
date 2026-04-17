import { Link, useLocation } from "wouter";
import { FileSpreadsheet } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuth();

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
            <Button variant="default" size="sm" asChild data-testid="link-start">
              <Link href="/upload">Sort My Leads</Link>
            </Button>
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
