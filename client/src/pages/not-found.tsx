import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, Home, Upload } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="pt-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <h1 className="mb-2 text-2xl font-bold">Page Not Found</h1>
          <p className="mb-6 text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/upload">
                <Upload className="h-4 w-4" />
                Upload Leads
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
