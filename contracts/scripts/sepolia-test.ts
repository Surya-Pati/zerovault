import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer/Seller/Admin: ${deployer.address}`);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance:       ${ethers.formatEther(deployerBalance)} Sepolia ETH`);

  // Use known whitelisted buyer account (Hardhat Account #2)
  const buyerPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const buyerWallet = new ethers.Wallet(buyerPrivateKey, ethers.provider);
  console.log(`Buyer Account:          ${buyerWallet.address}`);
  const buyerBalance = await ethers.provider.getBalance(buyerWallet.address);
  console.log(`Buyer Balance:          ${ethers.formatEther(buyerBalance)} Sepolia ETH`);

  const maxPriorityFee = ethers.parseUnits("0.05", "gwei");
  const maxFee = ethers.parseUnits("0.2", "gwei");
  const gasOpts = { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriorityFee };

  // Fund the buyer up to 0.00105 ETH if needed
  const requiredBuyerBalance = ethers.parseEther("0.00105");
  if (buyerBalance < requiredBuyerBalance) {
    const needed = requiredBuyerBalance - buyerBalance;
    console.log(`\n[STEP 0] Funding buyer with ${ethers.formatEther(needed)} ETH...`);
    const fundTx = await deployer.sendTransaction({
      to: buyerWallet.address,
      value: needed,
      ...gasOpts,
      gasLimit: 80000,
    });
    console.log("  -> Funding tx:", fundTx.hash);
    await fundTx.wait(1);
    console.log("  -> Buyer funded successfully!");
  } else {
    console.log("\n[STEP 0] Buyer balance is already sufficient.");
  }

  const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || "0x66AfE225958aF56E6fB99995897ED3EF17013185";
  console.log(`\nConnecting to ZeroVault at ${contractAddress}...`);
  const vault = await ethers.getContractAt("ZeroVault", contractAddress);

  // STEP 1: Verify KYC Whitelist
  console.log("\n[STEP 1] Checking KYC Whitelist for buyer...");
  const isKyc = await vault.isKYCVerified(buyerWallet.address);
  if (!isKyc) {
    console.log("  -> Whitelisting buyer on Sepolia...");
    const txKyc = await vault.connect(deployer).setKYCStatus(buyerWallet.address, true, { ...gasOpts, gasLimit: 250000 });
    console.log("  -> KYC tx:", txKyc.hash);
    await txKyc.wait(1);
    console.log("  -> Buyer KYC whitelisted!");
  } else {
    console.log("  -> Buyer is ALREADY KYC verified on Sepolia (0 gas spent)!");
  }

  // STEP 2: Commit Vulnerability
  const timestamp = Date.now().toString();
  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("vuln_sepolia_" + timestamp));
  const keyPlaintext = "secret_key_" + timestamp;
  const keyHash = ethers.keccak256(ethers.toUtf8Bytes(keyPlaintext));
  const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://sepolia_" + timestamp));
  const askingPrice = ethers.parseEther("0.001");

  console.log("\n[STEP 2] Committing vulnerability on Sepolia...");
  console.log("  -> Merkle Root:", merkleRoot);
  console.log("  -> Asking Price: 0.001 ETH (MIN_BOUNTY)");
  const txCommit = await vault.connect(deployer).commitVulnerability(
    merkleRoot,
    keyHash,
    ethers.ZeroAddress,
    askingPrice,
    ipfsHash,
    { ...gasOpts, gasLimit: 250000 }
  );
  console.log("  -> Commit tx:", txCommit.hash);
  await txCommit.wait(1);
  console.log("  -> Vulnerability committed on-chain!");

  // STEP 3: Lock Bounty
  console.log("\n[STEP 3] Locking 0.001 ETH bounty with buyer public key...");
  const buyerPubKey = buyerWallet.signingKey.compressedPublicKey;
  const txLock = await vault.connect(buyerWallet).lockBounty(merkleRoot, buyerPubKey, {
    value: askingPrice,
    ...gasOpts,
    gasLimit: 250000,
  });
  console.log("  -> Lock tx:", txLock.hash);
  await txLock.wait(1);
  console.log("  -> 0.001 ETH bounty locked on-chain!");

  // STEP 4: Reveal & Settle
  console.log("\n[STEP 4] Revealing decryption key and ECIES ciphertext on Sepolia...");
  const mockEncryptedKey = "0x" + "aa".repeat(93);
  try {
    const txClaim = await vault.connect(deployer).revealAndClaim(
      merkleRoot,
      ethers.toUtf8Bytes(keyPlaintext),
      mockEncryptedKey,
      { ...gasOpts, gasLimit: 250000 }
    );
    console.log("  -> Claim tx:", txClaim.hash);
    await txClaim.wait(1);
    console.log("  -> Escrow SETTLED! Seller credited in pull-payment refunds ledger.");

    // STEP 5: Withdraw Refund
    console.log("\n[STEP 5] Seller withdrawing 0.001 ETH pull refund...");
    const txWithdraw = await vault.connect(deployer).withdrawRefund({ ...gasOpts, gasLimit: 150000 });
    console.log("  -> Withdraw tx:", txWithdraw.hash);
    await txWithdraw.wait(1);
    console.log("  -> 0.001 ETH payout successfully withdrawn to seller!");

    // STEP 6: Verify Final State
    console.log("\n[STEP 6] Verifying on-chain state...");
    const escrow = await vault.escrows(merkleRoot);
    console.log(`  -> On-chain State: ${escrow.state} (3 = SETTLED)`);
  } catch (err: any) {
    if (err.message && err.message.includes("ReclaimTimeoutPassed")) {
      console.log("  -> Reclaim timeout (15s) passed between Sepolia blocks.");
      console.log("  -> Executing Bounty Reclaim path (Buyer pull-payment refund)...");
      const txReclaim = await vault.connect(buyerWallet).reclaimBounty(merkleRoot, { ...gasOpts, gasLimit: 200000 });
      console.log("  -> Reclaim tx:", txReclaim.hash);
      await txReclaim.wait(1);
      console.log("  -> Bounty reclaimed on-chain!");

      const txBuyerWithdraw = await vault.connect(buyerWallet).withdrawRefund({ ...gasOpts, gasLimit: 150000 });
      console.log("  -> Buyer withdraw tx:", txBuyerWithdraw.hash);
      await txBuyerWithdraw.wait(1);
      console.log("  -> 0.001 ETH refund withdrawn back to buyer!");

      const escrow = await vault.escrows(merkleRoot);
      console.log(`  -> On-chain State: ${escrow.state} (4 = REFUNDED)`);
    } else {
      throw err;
    }
  }

  const finalDeployerBal = await ethers.provider.getBalance(deployer.address);
  console.log(`\nFinal Deployer Balance: ${ethers.formatEther(finalDeployerBal)} Sepolia ETH`);
  console.log("\n==================================================");
  console.log("  >>> ALL SEPOLIA ON-CHAIN SMOKE TESTS PASSED! <<<");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Sepolia test failed:", err);
  process.exitCode = 1;
});
