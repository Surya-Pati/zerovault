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
  .dot-target { background: #34D399; }
  .dot-sibling { background: #F59E0B; }
  .dot-root { background: #38BDF8; }
  .dot-masked { background: #64748B; }

  /* Tree Canvas Area */
  .tree-container {
    height: 810px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }

  /* Levels */
  .tree-level {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    position: relative;
    z-index: 2;
  }

  .level-label {
    position: absolute;
    left: 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748B;
    background: #1E293B;
    padding: 4px 10px;
    border-radius: 4px;
    letter-spacing: 0.8px;
  }

  /* Node Boxes */
  .node-box {
    background: #131E32;
    border: 1px solid #1E293B;
    border-radius: 10px;
    padding: 10px 14px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    text-align: center;
  }

  .node-root {
    width: 580px;
    background: linear-gradient(135deg, #0F2B48, #0B192C);
    border: 2px solid #0284C7;
    box-shadow: 0 0 25px rgba(2, 132, 199, 0.3);
  }
  .node-root .hash-title { color: #38BDF8; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .node-root .hash-val { font-family: monospace; font-size: 13px; color: #E2E8F0; }

  .node-branch {
    width: 290px;
    background: #111C30;
    border: 1px solid #334155;
  }
  .node-branch.active-path {
    border-color: #F59E0B;
    background: rgba(245, 158, 11, 0.08);
  }

  /* Leaf Cards */
  .leaf-card {
    width: 228px;
    background: #0D1626;
    border: 1px solid #1E293B;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11.5px;
    text-align: left;
  }
  .leaf-card.revealed {
    border: 1.5px solid #059669;
    background: rgba(5, 150, 105, 0.08);
  }
  .leaf-card.target-leaf {
    border: 2px solid #34D399;
    background: rgba(52, 211, 153, 0.12);
    box-shadow: 0 0 18px rgba(52, 211, 153, 0.25);
  }
  .leaf-card.masked {
    border: 1px dashed #475569;
    background: rgba(30, 41, 59, 0.4);
    opacity: 0.75;
  }

  .leaf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .leaf-idx { font-weight: 700; color: #94A3B8; font-size: 10.5px; }
  .badge-revealed { font-size: 9px; font-weight: 700; background: rgba(52, 211, 153, 0.2); color: #34D399; padding: 2px 6px; border-radius: 4px; }
  .badge-masked { font-size: 9px; font-weight: 700; background: rgba(100, 116, 139, 0.2); color: #94A3B8; padding: 2px 6px; border-radius: 4px; }

  .leaf-field { margin-bottom: 3px; }
  .field-name { color: #64748B; font-size: 10px; font-weight: 600; }
  .field-val { color: #F1F5F9; font-weight: 600; font-size: 11px; }
  .leaf-hash { font-family: monospace; font-size: 10px; color: #38BDF8; margin-top: 6px; word-break: break-all; }

  /* Proof Path Explainer Box */
  .proof-box {
    background: #0A1322;
    border: 1.5px solid #0284C7;
    border-radius: 10px;
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12.5px;
  }
  .proof-box strong { color: #38BDF8; }
  .proof-steps {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: monospace;
    font-size: 12px;
  }
  .proof-step-pill {
    background: #1E293B;
    border: 1px solid #334155;
    padding: 6px 12px;
    border-radius: 6px;
    color: #FBBF24;
  }

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
      <h1>Merkle Tree Generation & Inclusion Proof Path <span>FIGURE 4.2</span></h1>
      <p>Cryptographic trait decomposition, lexicographical pair sorting, and client-side proof reconstruction</p>
    </div>
    <div class="legend">
      <div class="legend-item"><div class="dot dot-target"></div> Verified Target Leaf (L<sub>1</sub>)</div>
      <div class="legend-item"><div class="dot dot-sibling"></div> Audit Proof Sibling</div>
      <div class="legend-item"><div class="dot dot-root"></div> On-Chain Committed Root</div>
      <div class="legend-item"><div class="dot dot-masked"></div> Masked (Unrevealed) Trait</div>
    </div>
  </div>

  <!-- Tree Structure -->
  <div class="tree-container">

    <!-- LEVEL 0: MERKLE ROOT -->
    <div class="tree-level">
      <div class="level-label">Level 0 &bull; On-Chain Root</div>
      <div class="node-box node-root">
        <div class="hash-title">Merkle Root R (Committed to ZeroVault.sol)</div>
        <div class="hash-val">0x8f4c2e19a7b3d56f0821c4e97a31b6df529c0147eb8319ad64f529a3c7104b2e</div>
        <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">
          Stored in <code>escrows[merkleRoot]</code> &bull; Immutable cryptographic anchor for all traits
        </div>
      </div>
    </div>

    <!-- LEVEL 1: INTERMEDIATE BRANCHES -->
    <div class="tree-level">
      <div class="level-label">Level 1 &bull; Branches</div>
      <div class="node-box node-branch active-path" style="width: 440px;">
        <div style="font-size: 11.5px; font-weight: 700; color: #F59E0B;">Node H<sub>0123</sub> = keccak256(H<sub>01</sub> || H<sub>23</sub>)</div>
        <div style="font-family: monospace; font-size: 11px; color: #CBD5E1; margin-top: 2px;">0xd4a19c628e... &bull; Left Branch</div>
      </div>
      <div class="node-box node-branch" style="width: 440px; border-color: #F59E0B; background: rgba(245, 158, 11, 0.08);">
        <div style="font-size: 11.5px; font-weight: 700; color: #F59E0B;">Node H<sub>45</sub> = keccak256(H<sub>4</sub> || H<sub>5</sub>) [Proof Sibling 3]</div>
        <div style="font-family: monospace; font-size: 11px; color: #CBD5E1; margin-top: 2px;">0x71e3b508ca... &bull; Right Branch</div>
      </div>
    </div>

    <!-- LEVEL 2: LEAF PAIR BRANCHES -->
    <div class="tree-level">
      <div class="level-label">Level 2 &bull; Pair Hashes</div>
      <div class="node-box node-branch active-path">
        <div style="font-size: 11px; font-weight: 700; color: #34D399;">H<sub>01</sub> = keccak256(h<sub>0</sub> || h<sub>1</sub>)</div>
        <div style="font-family: monospace; font-size: 10.5px; color: #CBD5E1;">0x39f28a01cd...</div>
      </div>
      <div class="node-box node-branch" style="border-color: #F59E0B; background: rgba(245, 158, 11, 0.08);">
        <div style="font-size: 11px; font-weight: 700; color: #F59E0B;">H<sub>23</sub> = keccak256(h<sub>2</sub> || h<sub>3</sub>) [Sibling 2]</div>
        <div style="font-family: monospace; font-size: 10.5px; color: #CBD5E1;">0x9a834f71b2...</div>
      </div>
      <div class="node-box node-branch" style="opacity: 0.7;">
        <div style="font-size: 11px; font-weight: 700; color: #94A3B8;">h<sub>4</sub> = keccak256(L<sub>4</sub>)</div>
        <div style="font-family: monospace; font-size: 10.5px; color: #94A3B8;">0x12c4b890ea...</div>
      </div>
      <div class="node-box node-branch" style="opacity: 0.7;">
        <div style="font-size: 11px; font-weight: 700; color: #94A3B8;">h<sub>5</sub> = keccak256(L<sub>5</sub>)</div>
        <div style="font-family: monospace; font-size: 10.5px; color: #94A3B8;">0x68d5f34a17...</div>
      </div>
    </div>

    <!-- LEVEL 3: RAW SEMANTIC LEAVES -->
    <div class="tree-level">
      <div class="level-label">Level 3 &bull; Leaves</div>

      <!-- Leaf 0: Sibling 1 -->
      <div class="leaf-card revealed" style="border-color: #F59E0B; background: rgba(245, 158, 11, 0.08);">
        <div class="leaf-header">
          <span class="leaf-idx">Leaf 0 [Proof Sibling 1]</span>
          <span class="badge-revealed" style="color: #F59E0B; border: 1px solid #F59E0B;">Revealed</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">Target System</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val">OpenSSL 3.0.1 Daemon</div></div>
        <div class="leaf-hash">h<sub>0</sub> = 0x5a18...39c2</div>
      </div>

      <!-- Leaf 1: Target Leaf under Verification -->
      <div class="leaf-card target-leaf">
        <div class="leaf-header">
          <span class="leaf-idx" style="color: #34D399;">Leaf 1 (Target Verified)</span>
          <span class="badge-revealed">Verified</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">Vulnerability Type</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val">Heap Buffer Overflow</div></div>
        <div class="leaf-hash" style="color: #34D399; font-weight: bold;">h<sub>1</sub> = 0x7c92...84b1</div>
      </div>

      <!-- Leaf 2 -->
      <div class="leaf-card masked">
        <div class="leaf-header">
          <span class="leaf-idx">Leaf 2</span>
          <span class="badge-masked">Masked</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">Attack Vector</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val" style="color: #94A3B8;">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</div></div>
        <div class="leaf-hash">h<sub>2</sub> = 0x3d41...77fa</div>
      </div>

      <!-- Leaf 3 -->
      <div class="leaf-card revealed">
        <div class="leaf-header">
          <span class="leaf-idx">Leaf 3</span>
          <span class="badge-revealed">Revealed</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">CVSS v3.1 Score</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val">9.8 (Critical)</div></div>
        <div class="leaf-hash">h<sub>3</sub> = 0x8b2e...55c9</div>
      </div>

      <!-- Leaf 4 -->
      <div class="leaf-card masked">
        <div class="leaf-header">
          <span class="leaf-idx">Leaf 4</span>
          <span class="badge-masked">Masked</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">Exploit Reliability</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val" style="color: #94A3B8;">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</div></div>
        <div class="leaf-hash">h<sub>4</sub> = 0x12c4...890e</div>
      </div>

      <!-- Leaf 5 -->
      <div class="leaf-card masked">
        <div class="leaf-header">
          <span class="leaf-idx">Leaf 5</span>
          <span class="badge-masked">Masked</span>
        </div>
        <div class="leaf-field"><div class="field-name">TRAIT</div><div class="field-val">Mitigation Bypass</div></div>
        <div class="leaf-field"><div class="field-name">VALUE</div><div class="field-val" style="color: #94A3B8;">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</div></div>
        <div class="leaf-hash">h<sub>5</sub> = 0x68d5...4a17</div>
      </div>

    </div>

    <!-- Proof Verification Pathway -->
    <div class="proof-box">
      <div>
        <div style="font-weight: 700; color: #F1F5F9; margin-bottom: 2px;">Client-Side Proof Reconstruction for Leaf L<sub>1</sub>:</div>
        <div style="color: #94A3B8; font-size: 11.5px;">Next.js browser runtime computes root in 3 hashing steps without accessing unrevealed traits:</div>
      </div>
      <div class="proof-steps">
        <div class="proof-step-pill">1. keccak256(h<sub>0</sub> || h<sub>1</sub>) &rarr; H<sub>01</sub></div>
        <div style="color: #38BDF8;">&rarr;</div>
        <div class="proof-step-pill">2. keccak256(H<sub>01</sub> || H<sub>23</sub>) &rarr; H<sub>0123</sub></div>
        <div style="color: #38BDF8;">&rarr;</div>
        <div class="proof-step-pill">3. keccak256(H<sub>0123</sub> || H<sub>45</sub>) &rarr; R</div>
      </div>
      <div style="background: rgba(52, 211, 153, 0.15); border: 1px solid #34D399; color: #34D399; font-weight: bold; padding: 6px 12px; border-radius: 6px; font-size: 12px;">
        R == R<sub>on-chain</sub> &check; Verified
      </div>
    </div>

  </div>

  <div class="footer-note">
    ZeroVault Protocol Specification &bull; Figure 4.2: Merkle Tree Generation, Leaf Claim Verification, and Proof Path Construction
  </div>

</body>
</html>`;

async function render() {
  console.log('Launching browser to render Diagram 2...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 2
  });
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  const outputPath = path.join(__dirname, 'docs', 'images', 'diagram_2_merkle_tree.png');
  await page.screenshot({ path: outputPath });
  await browser.close();
  console.log('Diagram 2 successfully rendered to:', outputPath);
}

render().catch(err => {
  console.error('Error rendering diagram 2:', err);
  process.exit(1);
});
