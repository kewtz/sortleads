import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Require a valid Supabase JWT. Returns 401 if missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!supabase) {
    return res.status(500).json({ error: "Auth not configured" });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = { id: data.user.id, email: data.user.email ?? "" };
    next();
  } catch {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Validate the JWT if present but don't block unauthenticated requests.
 * req.user will be set if a valid token is provided, undefined otherwise.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!supabase) {
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      req.user = { id: data.user.id, email: data.user.email ?? "" };
    }
  } catch {
    // Token is invalid — proceed without user context
  }
  next();
}
