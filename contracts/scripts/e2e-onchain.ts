import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  createMerkleTree,
  getInclusionProof,
  normalizePayload
} from "../../shared/dist/merkle";
import {
  encryptPayload,
  decryptPayload,
  encryptECIES,
  decryptECIES
} from "../../shared/dist/crypto";

async function main() {
  console.log("===============================================================================");
  console.log("         ZeroVault v2 Institutional Protocol End-to-End Lifecycle Simulation");
  console.log("===============================================================================");

  const [admin, seller] = await ethers.getSigners();
  // Create an authentic ephemeral buyer wallet to test real public/private key derivation
  const buyerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

  // Fund the buyer with 2.0 ETH for gas and bounty
  const fundTx = await admin.sendTransaction({
    to: buyerWallet.address,
    value: ethers.parseEther("2.0"),
  });
  await fundTx.wait(1);

  console.log(`[Roles]`);
  console.log(`  Admin:    ${admin.address}`);
  console.log(`  Seller:   ${seller.address}`);
  console.log(`  Buyer:    ${buyerWallet.address}`);

  // ---------------------------------------------------------------------------
  // 1. DEPLOY SMART CONTRACT (v2)
  // ---------------------------------------------------------------------------
  console.log("\n[1/10] Deploying ZeroVault v2...");
  const ZeroVaultFactory = await ethers.getContractFactory("ZeroVault");
  const vault = await ZeroVaultFactory.deploy(7 * 24 * 60 * 60, 14 * 24 * 60 * 60);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`  -> ZeroVault v2 deployed at: ${vaultAddress}`);

  // ---------------------------------------------------------------------------
  // 2. CRYPTOGRAPHIC MERKLE TREE & AES-256-GCM ENCRYPTION
  // ---------------------------------------------------------------------------
  console.log("\n[2/10] Generating 256-bit Salted Merkle Tree & AES-256-GCM Ciphertext...");
  const vulnerabilityReport = {
    title: "Remote Code Execution in EVM Peer-to-Peer Frame Parser",
    affected_version: "v1.14.0 - v1.14.3",
    cve: "CVE-2026-9999",
    severity: "CRITICAL",
    exploit_primitive: "Heap buffer overflow in RLP frame decompression buffer",
    exploit_payload_poc: "0x48656c6c6f205a65726f5661756c742050726f746f636f6c205665726966696564"
  };

  const rawJsonReport = JSON.stringify(vulnerabilityReport);
  
  // Encrypt raw report with AES-256-GCM
  const encryptedPayload = await encryptPayload(rawJsonReport);
  console.log(`  -> Encrypted Payload Length: ${encryptedPayload.ciphertext.length} bytes`);
  console.log(`  -> AES IV: ${encryptedPayload.iv}`);
  console.log(`  -> Raw AES Key: ${encryptedPayload.key.slice(0, 16)}...`);

  const rawKeyHex = encryptedPayload.key.startsWith("0x") ? encryptedPayload.key : `0x${encryptedPayload.key}`;
  const rawKeyBytes = ethers.getBytes(rawKeyHex);
  const keyHash = ethers.keccak256(rawKeyBytes);
  console.log(`  -> On-Chain Key Hash: ${keyHash}`);

  // Build salted Merkle Tree
  const merkleTree = createMerkleTree(vulnerabilityReport);
  const merkleRoot = merkleTree.root;
  console.log(`  -> Salted Merkle Root: ${merkleRoot}`);

  // Extract partial disclosure inclusion proof for Title & Affected Version
  const titleIndex = merkleTree.leaves.findIndex(l => l.key === "title");
  const titleProof = getInclusionProof(merkleTree, titleIndex);
  console.log(`  -> Leaf Proof (Title): ${titleProof.proof.length} Merkle sibling hashes`);
  console.log(`  -> Leaf Salt (Title): ${titleProof.claim.salt}`);

  // ---------------------------------------------------------------------------
  // 3. ON-CHAIN PARTIAL LEAF VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n[3/10] Verifying Partial Disclosure Proof on Smart Contract...");
  const leafHash = titleProof.leafHash;
  const isProofValidOnChain = await vault.verifyPartialLeaf(merkleRoot, leafHash, titleProof.proof);
  if (!isProofValidOnChain) {
    throw new Error("On-chain Merkle leaf verification failed!");
  }
  console.log("  -> [PASS] On-chain Merkle proof successfully verified by buyer!");

  // ---------------------------------------------------------------------------
  // 4. SELLER COMMITMENT
  // ---------------------------------------------------------------------------
  console.log("\n[4/10] Committing Vulnerability On-Chain...");
  const askingPrice = ethers.parseEther("0.5");
  const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes(encryptedPayload.ciphertext));

  const commitTx = await vault.connect(seller).commitVulnerability(
    merkleRoot,
    keyHash,
    ethers.ZeroAddress, // Open listing
    askingPrice,
    ipfsHash
  );
  await commitTx.wait(1);

  const initialEscrow = await vault.escrows(merkleRoot);
  console.log(`  -> Listing Committed! Seller: ${initialEscrow.seller}, Asking Price: ${ethers.formatEther(initialEscrow.askingPrice)} ETH`);

  // ---------------------------------------------------------------------------
  // 5. GRIEFING PREVENTION & KYC CHECKS
  // ---------------------------------------------------------------------------
  console.log("\n[5/10] Testing Griefing Prevention & KYC Enforcement...");
  const buyerCompressedPubKey = buyerWallet.signingKey.compressedPublicKey;
  console.log(`  -> Buyer Compressed Secp256k1 Public Key (33 bytes): ${buyerCompressedPubKey}`);

  // 5.1 KYC Enforcement Check
  try {
    await vault.connect(buyerWallet).lockBounty(merkleRoot, buyerCompressedPubKey, { value: askingPrice });
    throw new Error("Expected KYCNotVerified revert!");
  } catch (err: any) {
    if (!err.message.includes("KYCNotVerified")) throw err;
    console.log("  -> [PASS] Rejected un-KYC'd buyer attempt (KYCNotVerified)");
  }

  // Admin whitelists buyer
  await (await vault.connect(admin).setKYCStatus(buyerWallet.address, true)).wait(1);
  console.log("  -> Admin KYC verified buyer wallet.");

  // 5.2 0.001 ETH Dust Underpayment Attack Check
  try {
    const underpayment = ethers.parseEther("0.001"); // Asking price is 0.5 ETH
    await vault.connect(buyerWallet).lockBounty(merkleRoot, buyerCompressedPubKey, { value: underpayment });
    throw new Error("Expected InvalidAmount revert!");
  } catch (err: any) {
    if (!err.message.includes("InvalidAmount")) throw err;
    console.log("  -> [PASS] Rejected underpayment attack (InvalidAmount: 0.001 ETH < 0.5 ETH askingPrice)");
  }

  // ---------------------------------------------------------------------------
  // 6. BUYER LOCKS BOUNTY
  // ---------------------------------------------------------------------------
  console.log("\n[6/10] Buyer Locking Bounty of 1.0 ETH...");
  const bountyAmount = ethers.parseEther("1.0");
  const lockTx = await vault.connect(buyerWallet).lockBounty(merkleRoot, buyerCompressedPubKey, { value: bountyAmount });
  await lockTx.wait(1);

  const lockedEscrow = await vault.escrows(merkleRoot);
  console.log(`  -> Bounty Locked! State: ${lockedEscrow.state} (BOUNTY_LOCKED), Amount: ${ethers.formatEther(lockedEscrow.bountyAmount)} ETH`);
  console.log(`  -> Registered Buyer Public Key: ${lockedEscrow.buyerPublicKey}`);

  // ---------------------------------------------------------------------------
  // 7. EMERGENCY CIRCUIT BREAKER & TIME DILATION SIMULATION
  // ---------------------------------------------------------------------------
  console.log("\n[7/10] Simulating Emergency Circuit Breaker & Pause Clock Freeze...");
  // Advance 3 days
  await time.increase(3 * 24 * 60 * 60);

  // Admin emergency pause
  await (await vault.connect(admin).pause()).wait(1);
  console.log("  -> ZeroVault PAUSED by emergency circuit breaker.");

  // 10 days pass during emergency pause
  await time.increase(10 * 24 * 60 * 60);

  // Verify state-modifying actions are blocked during pause
  try {
    await vault.connect(seller).triggerDeadMansSwitch(merkleRoot);
    throw new Error("Expected EnforcedPause revert!");
  } catch (err: any) {
    if (!err.message.includes("EnforcedPause")) throw err;
    console.log("  -> [PASS] All mutations halted during emergency pause (EnforcedPause)");
  }

  // Admin unpauses
  await (await vault.connect(admin).unpause()).wait(1);
  console.log("  -> ZeroVault UNPAUSED. Cumulative paused time accumulated.");

  // Total nominal elapsed time is 13 days, but active time is only 3 days.
  // Buyer attempting to reclaim prematurely MUST revert:
  try {
    await vault.connect(buyerWallet).reclaimBounty(merkleRoot);
    throw new Error("Expected TimeoutNotReached revert!");
  } catch (err: any) {
    if (!err.message.includes("TimeoutNotReached")) throw err;
    console.log("  -> [PASS] Reclaim blocked: paused duration correctly dilated active clock (TimeoutNotReached)");
  }

  const activeElapsed = await vault.getActiveLockElapsed(merkleRoot);
  console.log(`  -> Active Lock Elapsed: ${Math.round(Number(activeElapsed) / 86400)} days (nominal 13 days, paused 10 days)`);

  // ---------------------------------------------------------------------------
  // 8. FAKE KEY PREVENTION CHECK
  // ---------------------------------------------------------------------------
  console.log("\n[8/10] Testing Fake Key Bounty Theft Prevention...");
  const fakeKeyBytes = ethers.toUtf8Bytes("corrupt_or_fake_decryption_key_bytes");
  const dummyEncrypted = "0x" + "bb".repeat(93);

  try {
    await vault.connect(seller).revealAndClaim(merkleRoot, fakeKeyBytes, dummyEncrypted);
    throw new Error("Expected InvalidKey revert!");
  } catch (err: any) {
    if (!err.message.includes("InvalidKey")) throw err;
    console.log("  -> [PASS] Prevented seller from claiming bounty with fake key (InvalidKey: atomic hash check passed)");
  }

  // ---------------------------------------------------------------------------
  // 9. ASYMMETRIC ECIES ENCAPSULATION & ATOMIC SETTLEMENT
  // ---------------------------------------------------------------------------
  console.log("\n[9/10] Encrypting AES Key via ECIES and Executing Atomic Settlement...");
  // Seller encapsulates raw AES key specifically for the buyer using buyer's registered public key
  const eciesPayload = await encryptECIES(lockedEscrow.buyerPublicKey, encryptedPayload.key);
  console.log(`  -> ECIES Encapsulated Payload (93 bytes compact): ${eciesPayload.slice(0, 34)}...`);

  const initialSellerBalance = await ethers.provider.getBalance(seller.address);

  const revealTx = await vault.connect(seller).revealAndClaim(
    merkleRoot,
    rawKeyBytes,
    eciesPayload
  );
  const revealReceipt = await revealTx.wait(1);
  const revealGas = revealReceipt!.gasUsed * revealReceipt!.gasPrice;

  const settledEscrow = await vault.escrows(merkleRoot);
  console.log(`  -> Escrow State: ${settledEscrow.state} (SETTLED)`);
  console.log(`  -> On-Chain Delivered ECIES Ciphertext: ${settledEscrow.encryptedKey.slice(0, 34)}...`);

  // Seller executes pull payment withdrawal
  const withdrawTx = await vault.connect(seller).withdrawRefund();
  const withdrawReceipt = await withdrawTx.wait(1);
  const withdrawGas = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

  const finalSellerBalance = await ethers.provider.getBalance(seller.address);
  const sellerDelta = finalSellerBalance - initialSellerBalance;
  console.log(`  -> Seller Withdrew: ${ethers.formatEther(sellerDelta + revealGas + withdrawGas)} ETH (Net +1.0 ETH)`);

  // ---------------------------------------------------------------------------
  // 10. BUYER DECRYPTS ECIES PAYLOAD & RESTORES ORIGINAL EXPLOIT REPORT
  // ---------------------------------------------------------------------------
  console.log("\n[10/10] Buyer Decrypting ECIES Payload & Reconstructing Vulnerability Report...");
  // Buyer fetches delivered encryptedKey from smart contract
  const deliveredCiphertextOnChain = settledEscrow.encryptedKey;

  // Buyer decrypts ECIES payload using their private key to recover the raw AES key
  const recoveredAesKeyHex = await decryptECIES(buyerWallet.privateKey, deliveredCiphertextOnChain);
  console.log(`  -> Decrypted AES Key: ${recoveredAesKeyHex.slice(0, 16)}...`);
  console.log(`  -> Matches Seller Original Key: ${recoveredAesKeyHex.toLowerCase() === encryptedPayload.key.toLowerCase()}`);

  if (recoveredAesKeyHex.toLowerCase() !== encryptedPayload.key.toLowerCase()) {
    throw new Error("Recovered AES key mismatch!");
  }

  // Buyer decrypts the full 0-day vulnerability report
  const decryptedPlaintext = await decryptPayload({
    ciphertext: encryptedPayload.ciphertext,
    iv: encryptedPayload.iv,
    key: recoveredAesKeyHex
  });

  const parsedReport = JSON.parse(decryptedPlaintext);
  console.log("\n===============================================================================");
  console.log("                     DECRYPTED ZERO-DAY VULNERABILITY REPORT");
  console.log("===============================================================================");
  console.log(`  Title:            ${parsedReport.title}`);
  console.log(`  Affected Version: ${parsedReport.affected_version}`);
  console.log(`  CVE:              ${parsedReport.cve}`);
  console.log(`  Severity:         ${parsedReport.severity}`);
  console.log(`  Exploit Primitive:${parsedReport.exploit_primitive}`);
  console.log(`  Exploit PoC:      ${parsedReport.exploit_payload_poc}`);
  console.log("===============================================================================");
  console.log("  >>> E2E PROTOCOL VERIFICATION PASSED WITH 100% CRYPTOGRAPHIC FIDELITY <<<");
  console.log("===============================================================================\n");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR IN E2E SIMULATION]:", err);
  process.exit(1);
});
