const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, 'qa', 'node_modules', 'playwright'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body {
    width: 1600px;
    height: 980px;
    background: #0B1120;
    color: #F8FAFC;
    padding: 30px 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #1E293B;
    padding-bottom: 16px;
  }
  .title-group h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #38BDF8;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .title-group h1 span {
    background: #0284C7;
    color: #FFFFFF;
    font-size: 13px;
    padding: 3px 10px;
    border-radius: 6px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .title-group p {
    font-size: 14px;
    color: #94A3B8;
    margin-top: 4px;
  }
  .legend {
    display: flex;
    gap: 18px;
    background: #1E293B;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
  }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-auth { background: #818CF8; }
  .dot-crypto { background: #34D399; }
  .dot-onchain { background: #F59E0B; }
  .dot-storage { background: #38BDF8; }

  /* Main Grid */
  .grid-container {
    display: grid;
    grid-template-columns: 280px 1fr 340px;
    grid-template-rows: 1fr;
    gap: 28px;
    height: 820px;
  }

  /* Columns */
  .col {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Cards */
  .card {
    background: #131E32;
    border: 1px solid #1E293B;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    position: relative;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #F1F5F9;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }
  .badge-seller { background: rgba(52, 211, 153, 0.15); color: #34D399; border: 1px solid #34D399; }
  .badge-buyer { background: rgba(56, 189, 248, 0.15); color: #38BDF8; border: 1px solid #38BDF8; }
  .badge-gateway { background: rgba(129, 140, 248, 0.15); color: #818CF8; border: 1px solid #818CF8; }
  .badge-chain { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid #F59E0B; }
  .badge-db { background: rgba(236, 72, 153, 0.15); color: #EC4899; border: 1px solid #EC4899; }

  .item-box {
    background: #0B1323;
    border: 1px solid #1E293B;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: 12px;
  }
  .item-box:last-child { margin-bottom: 0; }
  .item-label {
    font-weight: 600;
    color: #94A3B8;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
  }
  .item-val {
    color: #E2E8F0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
  }

  /* Protocol Step Pills */
  .step-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #1E293B;
    border-radius: 12px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .step-num {
    background: #0284C7;
    color: white;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: bold;
  }

  /* Middle Central Column: Gateway & Contract */
  .center-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Interaction Flow Channels */
  .flow-arrow-box {
    background: rgba(30, 41, 59, 0.7);
    border: 1px dashed #334155;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11.5px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #CBD5E1;
  }
  .flow-arrow-box strong { color: #38BDF8; }

  .tag-protocol {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #0F172A;
    color: #A5B4FC;
    font-family: monospace;
    border: 1px solid #312E81;
  }
  .tag-evm {
    background: #2D1A04;
    color: #FCD34D;
    border: 1px solid #78350F;
  }
  .tag-crypto {
    background: #06281E;
    color: #6EE7B7;
    border: 1px solid #064E3B;
  }

  .state-pill {
    display: inline-block;
    padding: 2px 6px;
    background: #1E293B;
    border-radius: 4px;
    font-family: monospace;
    font-size: 10.5px;
    color: #38BDF8;
    margin-right: 4px;
  }

  /* Footer Note */
  .footer-note {
    font-size: 11px;
    color: #64748B;
    text-align: center;
    margin-top: 10px;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="title-group">
      <h1>ZeroVault End-to-End System Data Flow <span>FIGURE 4.1</span></h1>
      <p>Cryptographic interaction pathways, client-side encryption, Merkle verification, and on-chain atomic settlement</p>
    </div>
    <div class="legend">
      <div class="legend-item"><div class="dot dot-auth"></div> SIWE Authentication</div>
      <div class="legend-item"><div class="dot dot-crypto"></div> AES & Merkle Cryptography</div>
      <div class="legend-item"><div class="dot dot-onchain"></div> Smart Contract Escrow</div>
      <div class="legend-item"><div class="dot dot-storage"></div> Encrypted Storage</div>
    </div>
  </div>

  <!-- Grid Content -->
  <div class="grid-container">

    <!-- Left Column: Researcher Node -->
    <div class="col">
      <div class="card" style="height: 100%;">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#34D399" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Security Researcher
          </div>
          <span class="badge badge-seller">Seller Role</span>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>Identity & Wallet</span>
            <span class="tag-protocol">EIP-4361</span>
          </div>
          <div class="item-val">Web3 Wallet (MetaMask / Viem)<br>SIWE Nonce Challenge Signing</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>1. Payload Encryption</span>
            <span class="tag-crypto">AES-256-GCM</span>
          </div>
          <div class="item-val">Secret Key K &larr; {0,1}<sup>256</sup><br>Ciphertext = Encrypt(K, Exploit)<br>KeyHash H<sub>K</sub> = keccak256(K)</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>2. Merkle Tree Generator</span>
            <span class="tag-crypto">Keccak-256</span>
          </div>
          <div class="item-val">L<sub>i</sub> = {trait_type, value, salt}<br>SortPairs = true &rarr; Root R<br>Proof<sub>i</sub> = getProof(T, h<sub>i</sub>)</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>3. On-Chain Commit</span>
            <span class="tag-evm">commitVulnerability</span>
          </div>
          <div class="item-val">Submits (R, H<sub>K</sub>, vendor)<br>Dead Man's Switch timer starts</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>4. Selective Disclosure</span>
            <span class="tag-protocol">REST API</span>
          </div>
          <div class="item-val">Toggles revealed leaf claims<br>Uploads proof arrays for buyer</div>
        </div>

        <div class="item-box" style="border-color: #059669; background: rgba(5, 150, 105, 0.1);">
          <div class="item-label" style="color: #34D399;">
            <span>5. Atomic Settlement</span>
            <span class="tag-evm">revealAndClaim</span>
          </div>
          <div class="item-val" style="color: #A7F3D0;">Calls revealAndClaim(R, K)<br>Receives 100% ETH payout atomically</div>
        </div>
      </div>
    </div>

    <!-- Center Column: API Gateway & Smart Contract -->
    <div class="col center-layout">

      <!-- Backend API Gateway -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#818CF8" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
            Express.js API Gateway & Blockchain Listener Bridge
          </div>
          <span class="badge badge-gateway">Backend Microservice</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="item-box">
            <div class="item-label"><span>Security Middleware</span><span class="tag-protocol">In-Memory</span></div>
            <div class="item-val">&bull; express-rate-limit (100 req/15m)<br>&bull; 24h HttpOnly Session JWT<br>&bull; Zod Request Schema Validation</div>
          </div>
          <div class="item-box">
            <div class="item-label"><span>Event Listener Bridge</span><span class="tag-evm">Ethers.js</span></div>
            <div class="item-val">&bull; Subscribes: BountyLocked, Settled<br>&bull; Polling with exponential backoff<br>&bull; Reconciles on-chain state with DB</div>
          </div>
        </div>

        <!-- Storage & DB Sub-bar -->
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px;">
          <div class="item-box">
            <div class="item-label"><span>Local Encrypted Storage</span><span class="tag-protocol">IPFS-Compatible URI</span></div>
            <div class="item-val">Stores encrypted ciphertext blobs at <code>/storage/payloads/</code> behind <code>ipfs://</code> URI scheme</div>
          </div>
          <div class="item-box">
            <div class="item-label"><span>Prisma PostgreSQL / SQLite</span><span class="tag-protocol">Relational</span></div>
            <div class="item-val">Users, Listings, Merkle Leaves, Proofs, Transaction Hashes (tx_hash_fund, tx_hash_settle)</div>
          </div>
        </div>
      </div>

      <!-- Smart Contract Card -->
      <div class="card" style="flex: 1; border-color: rgba(245, 158, 11, 0.4);">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#F59E0B" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>
            ZeroVault.sol (Ethereum Sepolia Testnet & Hardhat EVM Node)
          </div>
          <span class="badge badge-chain">Smart Contract</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="item-box">
            <div class="item-label"><span>Security Architecture</span><span class="tag-evm">OpenZeppelin</span></div>
            <div class="item-val">&bull; ReentrancyGuard (nonReentrant)<br>&bull; AccessControl (ADMIN_ROLE)<br>&bull; Pausable (Circuit Breaker)</div>
          </div>
          <div class="item-box">
            <div class="item-label"><span>Timeout Parameters</span><span class="tag-evm">Parameterized</span></div>
            <div class="item-val">&bull; Dead Man's Switch: 7d (demo 5m)<br>&bull; Buyer Reclaim: 14d (demo 10m)<br>&bull; Constructor configured args</div>
          </div>
        </div>

        <div class="item-box" style="background: rgba(245, 158, 11, 0.05); border-color: #B45309;">
          <div class="item-label" style="color: #FBBF24;"><span>State Transitions & Invariants</span><span>Finite State Machine</span></div>
          <div class="item-val" style="color: #FEF3C7; line-height: 1.6;">
            <span class="state-pill">NONE</span> &rarr;
            <span class="state-pill">COMMITTED</span> &rarr;
            <span class="state-pill">BOUNTY_LOCKED</span> &rarr;
            <span class="state-pill" style="color: #34D399; font-weight: bold;">SETTLED</span>
            <span style="color: #94A3B8; margin: 0 4px;">|</span>
            <span class="state-pill" style="color: #F87171;">EXPIRED</span>
            <span class="state-pill" style="color: #F87171;">REFUNDED</span>
          </div>
        </div>

        <!-- Atomic revealAndClaim callout -->
        <div class="item-box" style="background: rgba(16, 185, 129, 0.08); border-color: #10B981; margin-top: 10px;">
          <div class="item-label" style="color: #34D399;">
            <span>Atomic Execution: revealAndClaim(R, K)</span>
            <span class="tag-crypto">Single EVM TX</span>
          </div>
          <div class="item-val" style="color: #E2E8F0;">
            1. Checks: <code>state == BOUNTY_LOCKED && keccak256(K) == keyHash</code><br>
            2. Effects: <code>state = SETTLED; bountyAmount = 0;</code> &rarr; Emits <code>SettlementConfirmed(R, keyHash)</code><br>
            3. Interactions: <code>seller.call{value: amount}("")</code> &rarr; Instant atomic clearing with zero dispute lockup
          </div>
        </div>
      </div>

    </div>

    <!-- Right Column: Buyer / Enterprise Node -->
    <div class="col">
      <div class="card" style="height: 100%;">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#38BDF8" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Prospective Buyer / Vendor
          </div>
          <span class="badge badge-buyer">Buyer Role</span>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>Identity & Compliance</span>
            <span class="tag-protocol">EIP-4361</span>
          </div>
          <div class="item-val">Web3 Wallet Authentication<br>Requires on-chain KYC Approval<br>(<code>isKYCVerified[buyer] == true</code>)</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>1. Inspect Partial Claims</span>
            <span class="tag-protocol">Next.js UI</span>
          </div>
          <div class="item-val">Fetches revealed trait JSON<br>Extracts Merkle audit proofs</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>2. Client-Side Verification</span>
            <span class="tag-crypto">merkletreejs</span>
          </div>
          <div class="item-val">Reconstructs root from proof<br>Verifies: <code>Verify(Proof, R, Leaf)</code><br>UI renders Green Verified Badge</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>3. Lock Bounty Escrow</span>
            <span class="tag-evm">lockBounty</span>
          </div>
          <div class="item-val">Deposits exact ETH bounty into contract<br>State transitions to BOUNTY_LOCKED</div>
        </div>

        <div class="item-box">
          <div class="item-label">
            <span>4. Stalled Seller Timeout</span>
            <span class="tag-evm">reclaimBounty</span>
          </div>
          <div class="item-val">If seller fails to reveal within 14d,<br>buyer invokes reclaim for 100% refund</div>
        </div>

        <div class="item-box" style="border-color: #0284C7; background: rgba(2, 132, 199, 0.1);">
          <div class="item-label" style="color: #38BDF8;">
            <span>5. Payload Decryption</span>
            <span class="tag-crypto">AES-GCM Decrypt</span>
          </div>
          <div class="item-val" style="color: #BAE6FD;">Extracts key K after settlement<br>Fetches ciphertext blob<br>Decrypts full exploit in browser</div>
        </div>
      </div>
    </div>

  </div>

  <div class="footer-note">
    ZeroVault Protocol Specification &bull; Figure 4.1: End-to-End System Data Flow and Component Interaction Architecture
  </div>

</body>
</html>`;

async function render() {
  console.log('Launching browser to render Diagram 1...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 2 // 2x high-resolution rendering
  });
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  const outputPath = path.join(__dirname, 'docs', 'images', 'diagram_1_data_flow.png');
  await page.screenshot({ path: outputPath });
  await browser.close();
  console.log('Diagram 1 successfully rendered to:', outputPath);
}

render().catch(err => {
  console.error('Error rendering diagram 1:', err);
  process.exit(1);
});
