import type { JWTPayload } from "jose";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        payload: JWTPayload;
      };
    }
  }
}

export {};
