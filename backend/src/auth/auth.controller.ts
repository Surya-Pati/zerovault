import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { generateNonce, SiweMessage } from 'siwe';
import { z } from 'zod';
import { generateCsrfToken, JWT_SECRET } from './auth.middleware';

const prisma = new PrismaClient();

// ─── Zod Validation Schemas ─────────────────────────────────────────

const verifySiweSchema = z.object({
  message: z.string().min(1, 'SIWE message is required'),
  signature: z.string().min(1, 'Signature is required'),
  role: z.enum([Role.RESEARCHER, Role.BUYER]).optional(),
});

// ─── Cookie Config ──────────────────────────────────────────────────
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

// ─── CSRF Token ─────────────────────────────────────────────────────
export const getCsrfToken = (req: Request, res: Response) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
};

// ─── SIWE Auth ──────────────────────────────────────────────────────

// ─── SIWE Nonce ─────────────────────────────────────────────────────
export const getNonce = (req: Request, res: Response) => {
  const nonce = generateNonce();
  // Store nonce in a cookie for server-side verification
  res.cookie('siwe-nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000, // 5 minutes
  });
  res.setHeader('Content-Type', 'text/plain');
  res.send(nonce);
};

// ─── SIWE Verify ────────────────────────────────────────────────────
export const verifySiwe = async (req: Request, res: Response) => {
  const parseResult = verifySiweSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed' });
  }

  const { message, signature, role } = parseResult.data;

  try {
    const siweMessage = new SiweMessage(message);
    
    const storedNonce = req.cookies?.['siwe-nonce'];
    if (!storedNonce) {
      return res.status(401).json({ error: 'Nonce missing or expired. Please try again.' });
    }

    const expectedDomain = process.env.ALLOWED_ORIGINS 
      ? new URL(process.env.ALLOWED_ORIGINS.split(',')[0]).host 
      : 'localhost:3000';

    const result = await siweMessage.verify({ 
      signature, 
      nonce: storedNonce,
      domain: expectedDomain
    });
    
    if (result.success) {
      // Clear the nonce cookie after use (one-time use)
      res.clearCookie('siwe-nonce');
      
      const wallet_address = result.data.address.toLowerCase();
      
      // Find or create user - check both lowercase and checksummed to avoid case-sensitivity bugs
      let user = await prisma.user.findFirst({
        where: {
          wallet_address: {
            equals: wallet_address,
            mode: 'insensitive'
          }
        }
      });
      
      if (user) {
        // Strict Action: If a role was provided, it means they used the Registration form
        if (role) {
          return res.status(409).json({ error: 'Strict Security Enforced: This wallet is already registered. Role modification is not allowed. Please use the Login page.' });
        }
      } else {
        if (!role) {
          return res.status(400).json({ error: 'Role is required for new registration (RESEARCHER or BUYER)' });
        }
        user = await prisma.user.create({
          data: {
            wallet_address,
            role,
            profile_name: `${role === 'BUYER' ? 'Buyer' : 'Researcher'}-${wallet_address.slice(2, 8).toUpperCase()}`
          }
        });
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('session', token, cookieConfig);
      // Client-readable indicator cookie to prevent 401 noise on mount
      res.cookie('is_logged_in', '1', { ...cookieConfig, httpOnly: false });
      
      return res.json({ token, user: { id: user.id, wallet_address: user.wallet_address, role: user.role, verified_buyer: user.verified_buyer } });
    } else {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('[Auth] SIWE verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Logout ─────────────────────────────────────────────────────────
export const logout = (_req: Request, res: Response) => {
  const { maxAge, ...clearConfig } = cookieConfig;
  res.clearCookie('session', clearConfig);
  res.clearCookie('is_logged_in', { ...clearConfig, httpOnly: false });
  res.json({ success: true });
};

// ─── Get Current User ───────────────────────────────────────────────
export const getMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Only return safe fields — never return password_hash
  res.json({ user: { id: user.id, email: user.email, wallet_address: user.wallet_address, role: user.role, verified_buyer: user.verified_buyer, profile_name: user.profile_name } });
};

// ─── Get Buyers ─────────────────────────────────────────────────────
export const getBuyers = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const isAdmin = caller?.role === Role.ADMIN;

    const buyers = await prisma.user.findMany({
      where: { role: 'BUYER' },
      select: {
        id: true,
        profile_name: true,
        // Only expose sensitive fields to admins
        wallet_address: isAdmin,
        verified_buyer: isAdmin,
      }
    });
    res.json({ buyers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
};
