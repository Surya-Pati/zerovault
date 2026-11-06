import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const updateBuyerKYC = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'Status boolean is required (true or false).' });
  }

  try {
    const buyer = await prisma.user.findUnique({
      where: { id },
    });

    if (!buyer || buyer.role !== 'BUYER') {
      return res.status(404).json({ error: 'Buyer not found.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { verified_buyer: status },
      select: {
        id: true,
        profile_name: true,
        wallet_address: true,
        verified_buyer: true,
        role: true,
      },
    });

    console.log(`[Admin] KYC status for ${updated.profile_name} (${updated.wallet_address}) updated to ${status}`);
    return res.json({ success: true, buyer: updated });
  } catch (error: any) {
    console.error('[Admin] Error updating buyer KYC:', error);
    return res.status(500).json({ error: 'Failed to update buyer KYC status.' });
  }
};
