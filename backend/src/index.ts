import app from './app';
import { startPayloadWorker } from './services/payloadWorker';
import { Web3BridgeService, ZEROVAULT_ABI } from './services/bridge';
import { JsonRpcProvider, WebSocketProvider } from 'ethers';

const port = process.env.PORT || 3001; // Reloaded for ZeroVault sync at 0x610178dA211FEF7D417bC0e6FeD39F05609AD788

app.use((req, res, next) => { console.log(req.method, req.url); next(); });

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
  
  // Start the background payload migration worker
  if (process.env.NODE_ENV !== 'test') {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || '';

    let provider: any;
    if (rpcUrl.includes('alchemy.com') || rpcUrl.startsWith('wss://') || rpcUrl.startsWith('ws://')) {
      const wsUrl = rpcUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      console.log(`[Startup] Connecting to Sepolia via WebSocket push provider...`);
      provider = new WebSocketProvider(wsUrl);
    } else {
      provider = new JsonRpcProvider(rpcUrl, undefined, { polling: true, pollingInterval: 1000 });
    }

    try {
      // Start the background payload migration worker
      startPayloadWorker({
        intervalMs: 5000,
      });

      // Start Web3 Bridge to listen for smart contract events
      if (contractAddress) {
        const bridge = new Web3BridgeService({ provider, contractAddress });
        bridge.start().catch((err) => {
          console.error('[Web3Bridge] Failed to start (non-fatal):', err.message);
        });
      } else {
        console.warn('[Web3Bridge] ZEROVAULT_CONTRACT_ADDRESS not set. Bridge disabled. API server will still work.');
      }
    } catch (err: any) {
      console.error('[Startup] Web3/Worker initialization failed (non-fatal):', err.message);
    }
  }
});
