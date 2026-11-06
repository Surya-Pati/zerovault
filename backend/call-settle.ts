import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

async function main() {
  const API_URL = 'http://localhost:3001/api';
  const LISTING_ID = 'e77284ea-6a95-4ec3-a1c6-64321a222cb2';
  const TX_HASH = '0xaf97ef1085a5290ec558bc468d528288b45f3cf35a7003cf54e7d2957c9a08c8'; // tx_hash of revealAndClaim
  const DEC_KEY = '7fb5feb5a1d3948e5519f9364146d1e667d8e1d646650efc3c7c005865ebfaa6'; // fake decryption key
  
  const prisma = new PrismaClient();
  const seller = await prisma.user.findFirst({ where: { role: 'RESEARCHER' } });
  if (!seller) throw new Error("No seller found");
  
  const token = jwt.sign(
    { userId: seller.id, role: seller.role },
    process.env.JWT_SECRET || 'zv_prod_jwt_5f8a3c2e91b74d6fa0e12c3d4b5a6f7e8d9c0b1a',
    { expiresIn: '24h' }
  );
  
  try {
    const settleRes = await fetch(`${API_URL}/listings/${LISTING_ID}/settle`, { 
      method: 'POST',
      body: JSON.stringify({
        tx_hash_settle: TX_HASH,
        decryptionKey: DEC_KEY,
        contract_address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
      }),
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Settle Status:", settleRes.status);
    console.log("Settle Response:", await settleRes.text());
  } catch (err: any) {
    console.log("Settle Error:", err);
  }
}

main().catch(console.error);
