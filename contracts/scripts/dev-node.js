const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

console.log('====================================================');
console.log('  ZeroVault Blockchain Node & Auto-Reconciler');
console.log('====================================================');

// 1. Spawn hardhat node
const nodeProcess = spawn('npx', ['hardhat', 'node'], {
  cwd: path.resolve(__dirname, '..'),
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe']
});

nodeProcess.stdout.pipe(process.stdout);
nodeProcess.stderr.pipe(process.stderr);

let isReconciling = false;

// 2. Poll until node is ready
function waitForNode() {
  const req = http.request('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (!isReconciling) {
        isReconciling = true;
        console.log('\n[AutoDeploy] Hardhat node is ready! Running ZeroVault state reconciliation & deployment...\n');
        runRecommit();
      }
    });
  });

  req.on('error', () => {
    setTimeout(waitForNode, 500);
  });

  req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }));
  req.end();
}

function runRecommit() {
  const syncProcess = spawn('npx', ['hardhat', 'run', 'scripts/recommit.ts', '--network', 'localhost'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    stdio: 'inherit'
  });

  syncProcess.on('exit', (code) => {
    if (code === 0) {
      console.log('\n[AutoDeploy] ZeroVault smart contracts are fully synchronized and live!\n');
    } else {
      console.warn('\n[AutoDeploy] Warning: Recommit script completed with exit code', code);
    }
  });
}

setTimeout(waitForNode, 1000);

process.on('SIGINT', () => {
  nodeProcess.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  nodeProcess.kill('SIGTERM');
  process.exit();
});
