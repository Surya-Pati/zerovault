import { JsonRpcProvider } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('http://127.0.0.1:8545');
  const receipt = await provider.getTransactionReceipt('0x8fbf5ea4a0e0aa1335a71771fec8a8353a27572a0ab8a992d92be32752280234');
  console.log("Keys of receipt:", Object.keys(receipt || {}));
  console.log("Receipt hash:", receipt?.hash);
}

main().catch(console.error);
