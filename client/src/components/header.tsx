import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { FileSpreadsheet, Settings, LogOut, FolderOpen, User, ChevronDown } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const [location, setLocation] = useLocation();
  const { user, session, signOut } = useAuth();
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setIsOrgAdmin(false);
      return;
    }
    fetch("/api/org", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsOrgAdmin(data?.org?.role === "admin"))
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

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight" data-testid="text-logo">
            SortLeads<span className="text-primary">.io</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {/* Landing page scroll links — home only */}
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

          {/* Home link on non-home pages */}
          {location !== "/" && (
            <Button variant="ghost" size="sm" asChild data-testid="link-home">
              <Link href="/">Home</Link>
            </Button>
          )}

          {/* About — always visible */}
          <Button variant="ghost" size="sm" asChild data-testid="nav-about">
            <Link href="/about">About</Link>
          </Button>

          {/* Signed-in: user dropdown + CTA */}
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5" data-testid="nav-user-menu">
                    <User className="h-4 w-4" />
                    <span className="hidden max-w-[140px] truncate sm:inline">
                      {user.email}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Email — visible on mobile where it's hidden in the trigger */}
                  <div className="px-2 py-1.5 sm:hidden">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="sm:hidden" />

                  <DropdownMenuItem asChild>
                    <Link href="/history" className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      My Uploads
                    </Link>
                  </DropdownMenuItem>

                  {isOrgAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Team Admin
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
