import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { doubleCsrf } from 'csrf-csrf';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Secret Validation ──────────────────────────────────────────────
// Crash on startup if critical secrets are missing.
const JWT_SECRET: string = process.env.JWT_SECRET as string;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('[FATAL] JWT_SECRET is missing or too short (min 32 chars). Set it in .env');
}

const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET || CSRF_SECRET.length < 16) {
  throw new Error('[FATAL] CSRF_SECRET is missing or too short (min 16 chars). Set it in .env');
}

export { JWT_SECRET };

// Configure double submit cookie CSRF protection
export const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  getSessionIdentifier: (req: Request) => req.cookies?.session || 'anonymous',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  },
  getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
});

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Accept token from cookie OR Authorization header
  let token = req.cookies?.session;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string, role: Role };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    // Don't distinguish between expired, invalid, or malformed tokens
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
