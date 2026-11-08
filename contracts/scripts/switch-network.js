const fs = require('fs');
const path = require('path');

const targetNetwork = (process.argv[2] || '').toLowerCase();
const customAddress = process.argv[3];

if (!['sepolia', 'localhost', 'local'].includes(targetNetwork)) {
  console.log('Usage: node scripts/switch-network.js <sepolia|localhost> [contractAddress]');
  process.exit(1);
}

const isSepolia = targetNetwork === 'sepolia';

const config = isSepolia ? {
  name: 'Ethereum Sepolia',
  chainId: '11155111',
  contractAddress: customAddress || '0x66AfE225958aF56E6fB99995897ED3EF17013185',
  rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/alch_6Vg9aD0dEisSAvxZ4lUfn',
} : {
  name: 'Hardhat Localhost (31337)',
  chainId: '31337',
  contractAddress: customAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  rpcUrl: 'http://127.0.0.1:8545',
};

console.log('==================================================');
console.log(`  Switching ZeroVault to: ${config.name}`);
console.log(`  Chain ID: ${config.chainId}`);
console.log(`  Contract: ${config.contractAddress}`);
console.log(`  RPC URL:  ${config.rpcUrl}`);
console.log('==================================================\n');

// 1. Update root .env
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  let content = fs.readFileSync(rootEnvPath, 'utf8');
  content = content.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${config.contractAddress}"`);
  content = content.replace(/RPC_URL=".*?"/, `RPC_URL="${config.rpcUrl}"`);
  fs.writeFileSync(rootEnvPath, content, 'utf8');
  console.log('  [OK] Updated root .env');
}

// 2. Update backend/.env
const backendEnvPath = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(backendEnvPath)) {
  let content = fs.readFileSync(backendEnvPath, 'utf8');
  content = content.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${config.contractAddress}"`);
  content = content.replace(/RPC_URL=".*?"/, `RPC_URL="${config.rpcUrl}"`);
  fs.writeFileSync(backendEnvPath, content, 'utf8');
  console.log('  [OK] Updated backend/.env');
}

// 3. Update frontend/.env.local
const frontendEnvPath = path.resolve(__dirname, '../../frontend/.env.local');
const frontendEnvContent = `NEXT_PUBLIC_ZEROVAULT_ADDRESS="${config.contractAddress}"
NEXT_PUBLIC_RPC_URL="${config.rpcUrl}"
NEXT_PUBLIC_CHAIN_ID=${config.chainId}
NEXT_PUBLIC_API_URL=http://localhost:3001/api
`;
fs.writeFileSync(frontendEnvPath, frontendEnvContent, 'utf8');
console.log('  [OK] Generated frontend/.env.local');

// 4. Update frontend/src/lib/contracts.ts address fallback
const frontendContractsPath = path.resolve(__dirname, '../../frontend/src/lib/contracts.ts');
if (fs.existsSync(frontendContractsPath)) {
  let content = fs.readFileSync(frontendContractsPath, 'utf8');
  content = content.replace(
    /DEFAULT_ZEROVAULT_ADDRESS = process\.env\.NEXT_PUBLIC_ZEROVAULT_ADDRESS \|\| ['"].*?['"];/,
    `DEFAULT_ZEROVAULT_ADDRESS = process.env.NEXT_PUBLIC_ZEROVAULT_ADDRESS || '${config.contractAddress}';`
  );
  fs.writeFileSync(frontendContractsPath, content, 'utf8');
  console.log('  [OK] Updated frontend/src/lib/contracts.ts address fallback');
}

console.log('\n>>> Successfully switched network configuration!');
console.log('Note: Backend and Frontend will auto-reload with the updated settings.');
