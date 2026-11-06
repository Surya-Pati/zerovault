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
  }
  .title-group p { font-size: 14px; color: #94A3B8; margin-top: 4px; }
  
  .legend {
    display: flex;
    gap: 16px;
    background: #1E293B;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
  }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-evm { background: #F59E0B; }
  .dot-backend { background: #818CF8; }
  .dot-client { background: #38BDF8; }
  .dot-storage { background: #34D399; }

  /* Main 3-Column Layout */
  .grid-container {
    display: grid;
    grid-template-columns: 460px 460px 520px;
    gap: 28px;
    height: 810px;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background: #131E32;
    border: 1px solid #1E293B;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.3);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
  }
  .badge-local { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid #F59E0B; }
  .badge-sepolia { background: rgba(129, 140, 248, 0.15); color: #818CF8; border: 1px solid #818CF8; }
  .badge-server { background: rgba(56, 189, 248, 0.15); color: #38BDF8; border: 1px solid #38BDF8; }
  .badge-client { background: rgba(52, 211, 153, 0.15); color: #34D399; border: 1px solid #34D399; }

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
    align-items: center;
  }
  .item-val {
    color: #E2E8F0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
  }

  .tag {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }
  .tag-rpc { background: #2D1A04; color: #FCD34D; border: 1px solid #78350F; }
  .tag-http { background: #082F49; color: #7DD3FC; border: 1px solid #0369A1; }
  .tag-db { background: #2E1065; color: #DDD6FE; border: 1px solid #5B21B6; }
  .tag-fs { background: #064E3B; color: #A7F3D0; border: 1px solid #059669; }

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
      <h1>Network Topology & Infrastructure Deployment <span>FIGURE 4.3</span></h1>
      <p>Node distribution, local vs. public testnet topologies, API gateway bridging, and storage architecture</p>
    </div>
    <div class="legend">
      <div class="legend-item"><div class="dot dot-evm"></div> Blockchain Consensus Tier</div>
      <div class="legend-item"><div class="dot dot-backend"></div> Backend & Gateway Tier</div>
      <div class="legend-item"><div class="dot dot-storage"></div> Storage & Database Tier</div>
      <div class="legend-item"><div class="dot dot-client"></div> Web3 Client Tier</div>
    </div>
  </div>

  <!-- Grid Content -->
  <div class="grid-container">

    <!-- Column 1: Blockchain Consensus Nodes -->
    <div class="col">
      <!-- Hardhat Local Node -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#F59E0B" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            Hardhat Local Consensus Node
          </div>
          <span class="badge badge-local">Local Node</span>
        </div>

        <div class="item-box">
          <div class="item-label"><span>RPC Endpoint</span><span class="tag tag-rpc">Chain ID 31337</span></div>
          <div class="item-val">http://127.0.0.1:8545 (JSON-RPC)</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Mining & Consensus</span><span class="tag tag-rpc">Instant Automine</span></div>
          <div class="item-val">&bull; Instant block generation on transaction<br>&bull; Supports evm_increaseTime & evm_mine<br>&bull; Gas limit: 30,000,000 per block</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Pre-Funded Dev Accounts</span><span class="tag tag-rpc">10,000 ETH each</span></div>
          <div class="item-val">&bull; Account #0: Deployer & Admin Role<br>&bull; Account #1: Researcher (Seller)<br>&bull; Account #2: Vendor / Buyer (KYC Whitelisted)</div>
        </div>
      </div>

      <!-- Ethereum Sepolia Public Testnet -->
      <div class="card" style="flex: 1;">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#818CF8" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Ethereum Sepolia Public Testnet
          </div>
          <span class="badge badge-sepolia">Public PoS</span>
        </div>

        <div class="item-box">
          <div class="item-label"><span>RPC Provider Gateways</span><span class="tag tag-rpc">Chain ID 11155111</span></div>
          <div class="item-val">&bull; Alchemy: eth-sepolia.g.alchemy.com/v2/...<br>&bull; Infura: sepolia.infura.io/v3/...</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Deployed Contract Instances</span><span class="tag tag-rpc">Dual Deploy</span></div>
          <div class="item-val">
            &bull; Prod Deploy: 7d Commit / 14d Reclaim<br>
            &bull; Demo Deploy: 5m Commit / 10m Reclaim<br>
            &bull; Address: 0x5FbDB2315678afecb3...
          </div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Public Explorer & Verification</span><span class="tag tag-rpc">Etherscan</span></div>
          <div class="item-val">&bull; Verified NatSpec & ABI Interface<br>&bull; Event Logs: VulnerabilityCommitted, Settled</div>
        </div>
      </div>
    </div>

    <!-- Column 2: Backend Host & Data Tiers -->
    <div class="col">
      <!-- API Gateway Host -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#38BDF8" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
            Express.js API Gateway Host
          </div>
          <span class="badge badge-server">Node.js Server</span>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Service Address</span><span class="tag tag-http">Port 5000</span></div>
          <div class="item-val">http://localhost:5000/api/v1</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Security Layer</span><span class="tag tag-http">Middleware</span></div>
          <div class="item-val">&bull; express-rate-limit (In-Memory Sliding Window)<br>&bull; 24h HttpOnly Session JWT Cookie<br>&bull; SIWE EIP-4361 Signature Verification</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Web3 Bridge Listener</span><span class="tag tag-rpc">Ethers.js v6</span></div>
          <div class="item-val">&bull; Continuous polling every 5000ms<br>&bull; Exponential backoff for RPC limits<br>&bull; Reconciles on-chain events with database</div>
        </div>
      </div>

      <!-- Storage & Database Tiers -->
      <div class="card" style="flex: 1;">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#34D399" stroke-width="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
            Data Persistence & Local Storage
          </div>
          <span class="badge badge-client">Storage Tier</span>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Local Encrypted Storage</span><span class="tag tag-fs">IPFS Abstraction</span></div>
          <div class="item-val">&bull; Directory: <code>/backend/storage/payloads/</code><br>&bull; URI Scheme: <code>ipfs://Qm...</code> (compatible)<br>&bull; Stores AES-256-GCM encrypted blobs</div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Relational Database</span><span class="tag tag-db">Prisma ORM</span></div>
          <div class="item-val">
            &bull; PostgreSQL / SQLite (localhost:5432)<br>
            &bull; Tables: User, Listing, PartialDisclosureLeaf<br>
            &bull; Transaction hashes & state cache
          </div>
        </div>
      </div>
    </div>

    <!-- Column 3: Client Nodes (Researcher & Buyer) -->
    <div class="col">
      <!-- Next.js Client App -->
      <div class="card" style="height: 100%;">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" fill="none" stroke="#38BDF8" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
            Next.js 14 Web3 Frontend Client Tier
          </div>
          <span class="badge badge-client">Port 3000</span>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Researcher Browser Node</span><span class="tag tag-http">Client A</span></div>
          <div class="item-val">
            &bull; Web3 Wallet: MetaMask (Researcher account)<br>
            &bull; Browser Crypto: AES-256-GCM key generator<br>
            &bull; Merkle Engine: merkletreejs (Keccak-256)<br>
            &bull; Dual Channel: HTTPS (API) + JSON-RPC (EVM)
          </div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Buyer / Vendor Browser Node</span><span class="tag tag-http">Client B</span></div>
          <div class="item-val">
            &bull; Web3 Wallet: MetaMask (Buyer account)<br>
            &bull; Client Verification: OpenZeppelin Merkle verify<br>
            &bull; Dynamic Badge: Green (verified) / Red (failed)<br>
            &bull; Direct lockBounty ETH funding via Viem
          </div>
        </div>

        <div class="item-box">
          <div class="item-label"><span>Admin Governance Console</span><span class="tag tag-http">Admin Role</span></div>
          <div class="item-val">
            &bull; Protected Route: <code>/admin</code> (Requires ADMIN_ROLE)<br>
            &bull; Actions: <code>setKYCStatus(buyer, true)</code><br>
            &bull; Emergency Pause / Unpause circuit breaker
          </div>
        </div>

        <div class="item-box" style="background: rgba(56, 189, 248, 0.05); border-color: #0284C7; margin-top: 14px;">
          <div class="item-label" style="color: #38BDF8;"><span>Network Protocol Matrix</span><span>Transport</span></div>
          <div class="item-val" style="color: #BAE6FD; font-size: 11px; line-height: 1.5;">
            &bull; Client &harr; API Gateway: TLS / HTTPS (REST + Cookie)<br>
            &bull; Client &harr; EVM Nodes: EIP-1193 / JSON-RPC (HTTP / WSS)<br>
            &bull; Gateway &harr; EVM Nodes: JSON-RPC (Ethers.js provider)<br>
            &bull; Gateway &harr; DB: TCP (Prisma Client Driver)
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="footer-note">
    ZeroVault Protocol Specification &bull; Figure 4.3: Network Topology, Deployment Node Layout, and Testnet Infrastructure
  </div>

</body>
</html>`;

async function render() {
  console.log('Launching browser to render Diagram 3...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 2
  });
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  const outputPath = path.join(__dirname, 'docs', 'images', 'diagram_3_network_topology.png');
  await page.screenshot({ path: outputPath });
  await browser.close();
  console.log('Diagram 3 successfully rendered to:', outputPath);
}

render().catch(err => {
  console.error('Error rendering diagram 3:', err);
  process.exit(1);
});
