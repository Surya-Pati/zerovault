import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

async function main() {
  const API_URL = 'http://localhost:3001/api';
  const LISTING_ID = 'e77284ea-6a95-4ec3-a1c6-64321a222cb2';
  const TX_HASH = '0x8fbf5ea4a0e0aa1335a71771fec8a8353a27572a0ab8a992d92be32752280234';
  
  const prisma = new PrismaClient();
  const buyer = await prisma.user.findFirst({ where: { role: 'BUYER' } });
  
  const token = jwt.sign(
    { userId: buyer.id, role: buyer.role },
    process.env.JWT_SECRET || 'zv_prod_jwt_5f8a3c2e91b74d6fa0e12c3d4b5a6f7e8d9c0b1a',
    { expiresIn: '24h' }
  );
  console.log("Generated token for buyer:", buyer.id);

  try {
    const fundRes = await axios.post(`${API_URL}/listings/${LISTING_ID}/fund`, { 
      tx_hash_fund: TX_HASH,
      contract_address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Fund Success:", fundRes.data);
  } catch (err: any) {
    console.log("Fund Error:", err.response?.status, err.response?.data);
  }
}

main().catch(console.error);
