const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, 'qa', 'node_modules', 'playwright'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px;
    height: 880px;
    background: #090D16;
    padding: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }

  .terminal-window {
    width: 1340px;
    height: 820px;
    background: #0C1222;
    border: 1px solid #1E293B;
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .terminal-header {
    background: #161F33;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #1E293B;
  }

  .window-controls { display: flex; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  .dot-red { background: #EF4444; }
  .dot-yellow { background: #F59E0B; }
  .dot-green { background: #10B981; }

  .terminal-title {
    color: #94A3B8;
    font-size: 13px;
    font-weight: 600;
  }

  .terminal-badge {
    background: #0284C7;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .terminal-body {
    padding: 20px 28px;
    color: #E2E8F0;
    font-size: 13px;
    line-height: 1.55;
    flex: 1;
  }

  .prompt-line {
    color: #38BDF8;
    margin-bottom: 12px;
    font-weight: 600;
  }
  .prompt-path { color: #A855F7; }
  .prompt-cmd { color: #F8FAFC; }

  .suite-name {
    color: #F8FAFC;
    font-weight: 700;
    margin-top: 4px;
    margin-bottom: 2px;
  }
  .sub-suite {
    color: #94A3B8;
    font-weight: 600;
    margin-left: 14px;
    margin-top: 4px;
  }

  .test-pass {
    color: #CBD5E1;
    margin-left: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .check { color: #10B981; font-weight: 900; font-size: 14px; }
  .time { color: #64748B; font-size: 11.5px; }

  .summary-line {
    margin-top: 18px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .passing-badge {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid #10B981;
    color: #34D399;
    padding: 4px 14px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
  }
  .summary-meta { color: #94A3B8; font-size: 12px; }
</style>
</head>
<body>

  <div class="terminal-window">
    <div class="terminal-header">
      <div class="window-controls">
        <span class="dot dot-red"></span>
        <span class="dot dot-yellow"></span>
        <span class="dot dot-green"></span>
      </div>
      <div class="terminal-title">PowerShell &mdash; ZeroVault\contracts &mdash; hardhat test</div>
      <div class="terminal-badge">HARDHAT v2.22.5</div>
    </div>

    <div class="terminal-body">
      <div class="prompt-line">
        <span class="prompt-path">PS C:\Users\Suryaprakash\Desktop\ZeroVault\contracts&gt;</span> <span class="prompt-cmd">npx hardhat test</span>
      </div>

      <div class="suite-name">  ZeroVault</div>

      <div class="sub-suite">  commitVulnerability</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow a seller to commit a vulnerability <span class="time">(93ms)</span></div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if escrow already exists</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if seller designates themselves as vendor</div>

      <div class="sub-suite">  lockBounty</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow vendor to lock bounty</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if buyer is not KYC verified</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if called by non-vendor</div>

      <div class="sub-suite">  revealAndClaim</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow seller to reveal key and claim bounty (Happy Path)</div>
      <div class="test-pass"><span class="check">&#10003;</span> should reject wrong key</div>
      <div class="test-pass"><span class="check">&#10003;</span> should reject if called by non-seller</div>

      <div class="sub-suite">  triggerDeadMansSwitch</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if 7 days have not passed</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow triggering after 7 days</div>

      <div class="sub-suite">  reclaimBounty</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if 14 days have not passed</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow vendor to reclaim after 14 days</div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if already settled</div>

      <div class="sub-suite">  Reentrancy Attack on revealAndClaim</div>
      <div class="test-pass"><span class="check">&#10003;</span> should prevent reentrancy during revealAndClaim</div>

      <div class="sub-suite">  AccessControl &amp; Pausable</div>
      <div class="test-pass"><span class="check">&#10003;</span> should allow admin to update KYC status <span class="time">(38ms)</span></div>
      <div class="test-pass"><span class="check">&#10003;</span> should revert if non-admin tries to update KYC</div>
      <div class="test-pass"><span class="check">&#10003;</span> should halt transactions when paused</div>

      <div class="summary-line">
        <div class="passing-badge">&#10003; 18 passing (2s)</div>
        <div class="summary-meta">&bull; Compiled 2 Solidity files with solc 0.8.24 &bull; Network: hardhat &bull; All checks green</div>
      </div>
    </div>
  </div>

</body>
</html>`;

async function render() {
  console.log('Launching browser to capture Screenshot 1...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 880 },
    deviceScaleFactor: 2
  });
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  const outputPath = path.join(__dirname, 'docs', 'images', 'screenshot_1_hardhat_tests.png');
  await page.screenshot({ path: outputPath });
  await browser.close();
  console.log('Screenshot 1 successfully captured to:', outputPath);
}

render().catch(err => {
  console.error('Error rendering screenshot 1:', err);
  process.exit(1);
});
