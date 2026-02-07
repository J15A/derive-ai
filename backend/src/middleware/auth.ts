import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface AuthContext {
  sub: string;
  payload: JWTPayload;
}

let cachedVerifier:
  | {
      issuer: string;
      audience: string;
      jwks: ReturnType<typeof createRemoteJWKSet>;
    }
  | null = null;

function normalizeIssuer(domain: string): string {
  const base = domain.startsWith("http://") || domain.startsWith("https://")
    ? domain
    : `https://${domain}`;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function getVerifier() {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!domain || !audience) {
    throw new Error("Missing AUTH0_DOMAIN or AUTH0_AUDIENCE");
  }

  const issuerBase = normalizeIssuer(domain);
  const issuer = `${issuerBase}/`;

  if (cachedVerifier && cachedVerifier.issuer === issuer && cachedVerifier.audience === audience) {
    return cachedVerifier;
  }

  cachedVerifier = {
    issuer,
    audience,
    jwks: createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`)),
  };

  return cachedVerifier;
}

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const { issuer, audience, jwks } = getVerifier();
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      res.status(401).json({ error: "Token missing subject" });
      return;
    }

    req.auth = {
      sub: payload.sub,
      payload,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes("AUTH0_")) {
      res.status(500).json({ error: "Auth configuration error" });
      return;
    }
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
