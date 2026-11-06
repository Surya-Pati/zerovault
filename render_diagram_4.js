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
  .dot-active { background: #38BDF8; }
  .dot-settled { background: #34D399; }
  .dot-timeout { background: #F87171; }
  .dot-guard { background: #F59E0B; }

  /* Canvas Layout */
  .canvas {
    height: 810px;
    display: grid;
    grid-template-rows: 380px 380px;
    gap: 24px;
    position: relative;
  }

  .row-top {
    display: grid;
    grid-template-columns: 280px 400px 420px 400px;
    gap: 20px;
    align-items: center;
  }

  .row-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }

  /* State Cards */
  .state-card {
    background: #131E32;
    border: 2px solid #1E293B;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    position: relative;
  }
  .state-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .state-name {
    font-size: 17px;
    font-weight: 800;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    letter-spacing: 0.5px;
  }
  .badge-state {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 4px;
  }

  /* Colors */
  .card-init { border-color: #475569; }
  .card-committed { border-color: #0284C7; background: linear-gradient(145deg, #0C1E38, #0B1323); }
  .card-locked { border-color: #F59E0B; background: linear-gradient(145deg, #241705, #0B1323); }
  .card-settled {
    border-color: #10B981;
    background: linear-gradient(145deg, #06281E, #0B1323);
    box-shadow: 0 0 30px rgba(16, 185, 129, 0.25);
  }
  .card-timeout { border-color: #EF4444; background: linear-gradient(145deg, #260B0E, #0B1323); }

  .state-desc { font-size: 12px; color: #94A3B8; margin-bottom: 10px; line-height: 1.4; }
  
  .transition-box {
    background: #0B1323;
    border: 1px solid #1E293B;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 11.5px;
    margin-top: 8px;
  }
  .transition-title { font-weight: 700; color: #F8FAFC; margin-bottom: 2px; font-family: monospace; }
  .transition-guards { color: #94A3B8; font-size: 10.5px; }
  .tag { font-size: 9.5px; padding: 1px 5px; border-radius: 4px; font-family: monospace; }
  .tag-caller { background: #1E293B; color: #38BDF8; }
  .tag-effect { background: #064E3B; color: #6EE7B7; }
  .tag-event { background: #312E81; color: #C7D2FE; }
  .tag-err { background: #450A0A; color: #FCA5A5; }

  /* Circuit Breaker Bar */
  .circuit-bar {
    position: absolute;
    bottom: -10px;
    left: 0;
    right: 0;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
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
      <h1>Smart Contract Finite State Machine Lifecycle <span>FIGURE 4.4</span></h1>
      <p>State transition invariants, atomic settlement, Dead Man's Switch, and buyer reclaim paths</p>
    </div>
    <div class="legend">
      <div class="legend-item"><div class="dot dot-active"></div> Active Escrow States</div>
      <div class="legend-item"><div class="dot dot-settled"></div> Terminal Settled (Happy Path)</div>
      <div class="legend-item"><div class="dot dot-timeout"></div> Terminal Timeout States</div>
      <div class="legend-item"><div class="dot dot-guard"></div> CEI & ReentrancyGuard</div>
    </div>
  </div>

  <!-- Canvas Content -->
  <div class="canvas">

    <!-- ROW 1: PRIMARY ESCROW FLOW (NONE -> COMMITTED -> BOUNTY_LOCKED -> SETTLED) -->
    <div class="row-top">

      <!-- STATE 0: NONE -->
      <div class="state-card card-init">
        <div class="state-header">
          <span class="state-name" style="color: #94A3B8;">NONE</span>
          <span class="badge-state" style="background: #334155; color: #CBD5E1;">Uninitialized</span>
        </div>
        <div class="state-desc">Initial state. No escrow mapping exists for the given Merkle Root.</div>
        <div class="transition-box">
          <div class="transition-title" style="color: #38BDF8;">&rarr; commitVulnerability()</div>
          <div class="transition-guards">
            <span class="tag tag-caller">Caller: Seller</span><br>
            Requires: <code>state == NONE</code><br>
            Checks: <code>seller != vendor</code>
          </div>
        </div>
      </div>

      <!-- STATE 1: COMMITTED -->
      <div class="state-card card-committed">
        <div class="state-header">
          <span class="state-name" style="color: #38BDF8;">COMMITTED</span>
          <span class="badge-state" style="background: rgba(2, 132, 199, 0.2); color: #38BDF8;">Listed</span>
        </div>
        <div class="state-desc">Merkle Root & KeyHash fixed on-chain. Dead Man's Switch countdown commences (7d prod / 5m demo).</div>
        <div class="transition-box">
          <div class="transition-title" style="color: #F59E0B;">&rarr; lockBounty() [payable]</div>
          <div class="transition-guards">
            <span class="tag tag-caller">Caller: KYC Buyer</span>
            <span class="tag tag-effect">nonReentrant</span><br>
            Requires: <code>isKYCVerified[buyer] == true</code><br>
            Requires: <code>msg.value >= MIN_BOUNTY</code>
          </div>
        </div>
      </div>

      <!-- STATE 2: BOUNTY_LOCKED -->
      <div class="state-card card-locked">
        <div class="state-header">
          <span class="state-name" style="color: #F59E0B;">BOUNTY_LOCKED</span>
          <span class="badge-state" style="background: rgba(245, 158, 11, 0.2); color: #F59E0B;">Funded</span>
        </div>
        <div class="state-desc">ETH bounty custodied in contract. Reclaim timer starts (14d prod / 10m demo). Seller must reveal key.</div>
        <div class="transition-box" style="border-color: #10B981; background: rgba(16, 185, 129, 0.08);">
          <div class="transition-title" style="color: #34D399;">&rarr; revealAndClaim(R, key)</div>
          <div class="transition-guards">
            <span class="tag tag-caller">Caller: Seller</span>
            <span class="tag tag-effect">nonReentrant</span><br>
            Checks: <code>keccak256(key) == keyHash</code><br>
            Effects: <code>state = SETTLED</code> &bull; Payout ETH
          </div>
        </div>
      </div>

      <!-- STATE 3: SETTLED (TERMINAL) -->
      <div class="state-card card-settled">
        <div class="state-header">
          <span class="state-name" style="color: #34D399;">SETTLED</span>
          <span class="badge-state" style="background: rgba(16, 185, 129, 0.25); color: #6EE7B7;">Terminal Success</span>
        </div>
        <div class="state-desc">Atomic completion. Seller received 100% ETH bounty. Key emitted in event. Buyer decrypts payload.</div>
        <div class="transition-box" style="border-color: #059669;">
          <div class="transition-title" style="color: #6EE7B7;">Audit Trail Emission</div>
          <div class="transition-guards">
            <span class="tag tag-event">SettlementConfirmed(R, keyHash)</span><br>
            Key hash verified on-chain &bull; No dispute window
          </div>
        </div>
      </div>

    </div>

    <!-- ROW 2: TIMEOUT SAFETY PATHS (EXPIRED & REFUNDED) -->
    <div class="row-bottom">

      <!-- TIMEOUT 1: EXPIRED (Dead Man's Switch) -->
      <div class="state-card card-timeout">
        <div class="state-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="state-name" style="color: #F87171;">EXPIRED</span>
            <span style="font-size: 11px; color: #FCA5A5; font-weight: bold;">(Dead Man's Switch Path)</span>
          </div>
          <span class="badge-state" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5;">Terminal Timeout</span>
        </div>
        <div class="state-desc">
          Triggered if the buyer/vendor fails to lock the bounty within <code>COMMIT_TIMEOUT</code>.
          Protects the researcher against unresponsive vendors and inventory lockup griefing.
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="transition-box">
            <div class="transition-title" style="color: #F87171;">Trigger: triggerDeadMansSwitch()</div>
            <div class="transition-guards">
              <span class="tag tag-caller">Caller: Seller</span><br>
              Requires: <code>state == COMMITTED</code><br>
              Requires: <code>block.timestamp > commitTime + 7d</code>
            </div>
          </div>
          <div class="transition-box">
            <div class="transition-title" style="color: #F87171;">Consequence: Public Disclosure</div>
            <div class="transition-guards">
              <span class="tag tag-event">VaultExpired(merkleRoot)</span><br>
              Authorizes seller to disclose exploit publicly or re-list for alternative buyers.
            </div>
          </div>
        </div>
      </div>

      <!-- TIMEOUT 2: REFUNDED (Stalled Seller Reclaim) -->
      <div class="state-card card-timeout">
        <div class="state-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="state-name" style="color: #F87171;">REFUNDED</span>
            <span style="font-size: 11px; color: #FCA5A5; font-weight: bold;">(Buyer Reclaim Path)</span>
          </div>
          <span class="badge-state" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5;">Terminal Timeout</span>
        </div>
        <div class="state-desc">
          Triggered if the seller fails to reveal the valid decryption key within <code>RECLAIM_TIMEOUT</code> after bounty locking.
          Guarantees 100% principal capital recovery for the buyer.
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="transition-box">
            <div class="transition-title" style="color: #F87171;">Trigger: reclaimBounty()</div>
            <div class="transition-guards">
              <span class="tag tag-caller">Caller: Buyer</span>
              <span class="tag tag-effect">nonReentrant</span><br>
              Requires: <code>state == BOUNTY_LOCKED</code><br>
              Requires: <code>block.timestamp > lockTime + 14d</code>
            </div>
          </div>
          <div class="transition-box">
            <div class="transition-title" style="color: #F87171;">Consequence: 100% ETH Refund</div>
            <div class="transition-guards">
              <span class="tag tag-event">BountyReclaimed(merkleRoot)</span><br>
              Funds transferred via <code>buyer.call{value: amount}("")</code> following CEI pattern.
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>

  <div class="footer-note">
    ZeroVault Protocol Specification &bull; Figure 4.4: Smart Contract Finite State Machine and Transition Lifecycle
  </div>

</body>
</html>`;

async function render() {
  console.log('Launching browser to render Diagram 4...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 2
  });
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  const outputPath = path.join(__dirname, 'docs', 'images', 'diagram_4_state_machine.png');
  await page.screenshot({ path: outputPath });
  await browser.close();
  console.log('Diagram 4 successfully rendered to:', outputPath);
}

render().catch(err => {
  console.error('Error rendering diagram 4:', err);
  process.exit(1);
});
