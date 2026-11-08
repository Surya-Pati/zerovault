import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZeroVault, ReentrancyAttacker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZeroVault v2", function () {
  let zeroVault: ZeroVault;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let vendor: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("dummy_root"));
  const decryptionKey = "my_secret_decryption_key";
  const decryptionKeyBytes = ethers.toUtf8Bytes(decryptionKey);
  const keyHash = ethers.keccak256(decryptionKeyBytes);
  const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("QmTestIPFSCID123456789"));
  const askingPrice = ethers.parseEther("0.5");
  const bountyAmount = ethers.parseEther("1.0");

  // Valid 33-byte compressed secp256k1 public key (starts with 0x02)
  const validBuyerCompressedPubKey = "0x02" + "11".repeat(32);
  // Valid 65-byte uncompressed secp256k1 public key (starts with 0x04)
  const validBuyerUncompressedPubKey = "0x04" + "22".repeat(64);
  // Invalid public key (e.g. 32 bytes)
  const invalidPubKey = "0x" + "33".repeat(32);

  // ECIES encrypted key payload (>= 65 bytes, e.g. 93 bytes from @zerovault/shared)
  const validEncryptedKey = "0x" + "aa".repeat(93);
  const invalidShortEncryptedKey = "0x" + "aa".repeat(32);

  beforeEach(async function () {
    [owner, seller, vendor, attacker] = await ethers.getSigners();
    const ZeroVaultFactory = await ethers.getContractFactory("ZeroVault");
    zeroVault = await ZeroVaultFactory.deploy(7 * 24 * 60 * 60, 14 * 24 * 60 * 60);
    await zeroVault.connect(owner).setKYCStatus(vendor.address, true);
  });

  describe("commitVulnerability v2", function () {
    it("should allow a seller to commit a vulnerability with askingPrice and ipfsHash", async function () {
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash)
      )
        .to.emit(zeroVault, "VulnerabilityCommitted")
        .withArgs(merkleRoot, seller.address, vendor.address, keyHash, askingPrice, ipfsHash);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(1); // COMMITTED
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.vendor).to.equal(vendor.address);
      expect(escrow.keyHash).to.equal(keyHash);
      expect(escrow.ipfsHash).to.equal(ipfsHash);
      expect(escrow.askingPrice).to.equal(askingPrice);
      expect(escrow.bountyAmount).to.equal(0);
    });

    it("should revert if askingPrice < MIN_BOUNTY (1e15 wei)", async function () {
      const lowPrice = ethers.parseEther("0.0001");
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, keyHash, vendor.address, lowPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidAmount");
    });

    it("should revert if ipfsHash is bytes32(0)", async function () {
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidHash");
    });

    it("should revert if escrow already exists", async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "EscrowAlreadyExists");
    });

    it("should revert if seller designates themselves as vendor", async function () {
      const dummyRoot2 = ethers.keccak256(ethers.toUtf8Bytes("dummy_root_2"));
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(dummyRoot2, keyHash, seller.address, askingPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });

    it("should revert if merkleRoot is bytes32(0)", async function () {
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(ethers.ZeroHash, keyHash, vendor.address, askingPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidHash");
    });

    it("should revert if keyHash is bytes32(0)", async function () {
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, ethers.ZeroHash, vendor.address, askingPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidHash");
    });
  });

  describe("lockBounty v2", function () {
    beforeEach(async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
    });

    it("should allow vendor to lock bounty with valid buyer public key and value >= askingPrice", async function () {
      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount })
      )
        .to.emit(zeroVault, "BountyLocked")
        .withArgs(merkleRoot, vendor.address, bountyAmount, validBuyerCompressedPubKey);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(2); // BOUNTY_LOCKED
      expect(escrow.bountyAmount).to.equal(bountyAmount);
      expect(escrow.buyerPublicKey).to.equal(validBuyerCompressedPubKey);
    });

    it("should accept 65-byte uncompressed public key", async function () {
      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(merkleRoot, validBuyerUncompressedPubKey, { value: bountyAmount })
      ).to.emit(zeroVault, "BountyLocked");
    });

    it("should revert if value < askingPrice (prevents 0.001 ETH griefing)", async function () {
      const underpayment = ethers.parseEther("0.1"); // askingPrice is 0.5 ETH
      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: underpayment })
      ).to.be.revertedWithCustomError(zeroVault, "InvalidAmount");
    });

    it("should revert if buyer public key length is invalid", async function () {
      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(merkleRoot, invalidPubKey, { value: bountyAmount })
      ).to.be.revertedWithCustomError(zeroVault, "InvalidKey");
    });

    it("should revert if buyer is not KYC verified", async function () {
      await zeroVault.connect(owner).setKYCStatus(vendor.address, false);
      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount })
      ).to.be.revertedWithCustomError(zeroVault, "KYCNotVerified");
    });

    it("should revert if called by non-vendor on targeted listing", async function () {
      await zeroVault.connect(owner).setKYCStatus(attacker.address, true);
      await expect(
        zeroVault
          .connect(attacker)
          .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount })
      ).to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });

    it("should allow any KYC buyer to lock an open listing (vendor == address(0))", async function () {
      const openRoot = ethers.keccak256(ethers.toUtf8Bytes("open_root"));
      await zeroVault
        .connect(seller)
        .commitVulnerability(openRoot, keyHash, ethers.ZeroAddress, askingPrice, ipfsHash);

      await expect(
        zeroVault
          .connect(vendor)
          .lockBounty(openRoot, validBuyerCompressedPubKey, { value: bountyAmount })
      )
        .to.emit(zeroVault, "BountyLocked")
        .withArgs(openRoot, vendor.address, bountyAmount, validBuyerCompressedPubKey);

      const escrow = await zeroVault.escrows(openRoot);
      expect(escrow.vendor).to.equal(vendor.address);
    });
  });

  describe("revealAndClaim v2 (ECIES & Asymmetric Settlement)", function () {
    beforeEach(async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await zeroVault
        .connect(vendor)
        .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount });
    });

    it("should allow seller to verify keyHash and submit encrypted key for buyer", async function () {
      const initialSellerBalance = await ethers.provider.getBalance(seller.address);

      const tx = await zeroVault
        .connect(seller)
        .revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey);
      const receipt = await tx.wait();
      const revealGasCost = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(zeroVault, "SettlementConfirmed")
        .withArgs(merkleRoot, keyHash, validEncryptedKey);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(3); // SETTLED
      expect(escrow.encryptedKey).to.equal(validEncryptedKey);

      // Pull-over-push check: seller is credited in internal refunds ledger
      expect(await zeroVault.refunds(seller.address)).to.equal(bountyAmount);

      // Seller executes pull withdrawal
      const withdrawTx = await zeroVault.connect(seller).withdrawRefund();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      await expect(withdrawTx)
        .to.emit(zeroVault, "RefundWithdrawn")
        .withArgs(seller.address, bountyAmount);

      expect(await zeroVault.refunds(seller.address)).to.equal(0);

      const finalSellerBalance = await ethers.provider.getBalance(seller.address);
      expect(finalSellerBalance).to.equal(
        initialSellerBalance + bountyAmount - revealGasCost - withdrawGasCost
      );
    });

    it("should revert if decryptionKey does not match keyHash (prevents fake key bounty theft)", async function () {
      const wrongKeyBytes = ethers.toUtf8Bytes("wrong_secret_decryption_key");
      await expect(
        zeroVault.connect(seller).revealAndClaim(merkleRoot, wrongKeyBytes, validEncryptedKey)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidKey");
    });

    it("should revert if encryptedKey length is < 65 bytes", async function () {
      await expect(
        zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKeyBytes, invalidShortEncryptedKey)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidKey");
    });

    it("should reject if called by non-seller", async function () {
      await expect(
        zeroVault.connect(attacker).revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey)
      ).to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });

    it("should reject if 14-day reclaim timeout has passed", async function () {
      await time.increase(14 * 24 * 60 * 60 + 1);
      await expect(
        zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey)
      ).to.be.revertedWithCustomError(zeroVault, "ReclaimTimeoutPassed");
    });
  });

  describe("Pause Clock Freeze & Time Dilation (Anti-Griefing)", function () {
    beforeEach(async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await zeroVault
        .connect(vendor)
        .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount });
    });

    it("should freeze elapsed time when contract is paused and dilate claim/reclaim windows", async function () {
      // 1. Advance 5 days into the 14-day reclaim window
      await time.increase(5 * 24 * 60 * 60);

      // 2. Admin pauses contract for 10 days
      await zeroVault.connect(owner).pause();
      await time.increase(10 * 24 * 60 * 60);
      await zeroVault.connect(owner).unpause();

      // Total wall-clock time passed since lock = 15 days (> 14 days RECLAIM_TIMEOUT).
      // But because 10 days were paused, active elapsed time is only 5 days!

      // 3. Buyer attempts to reclaim prematurely -> REVERTS because active time < 14 days
      await expect(
        zeroVault.connect(vendor).reclaimBounty(merkleRoot)
      ).to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");

      // 4. Seller CAN still reveal and claim key within the dilated active window!
      await expect(
        zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey)
      )
        .to.emit(zeroVault, "SettlementConfirmed")
        .withArgs(merkleRoot, keyHash, validEncryptedKey);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(3); // SETTLED
    });

    it("should allow buyer reclaim after 14 days of ACTIVE (unpaused) time", async function () {
      // 1. Advance 5 days
      await time.increase(5 * 24 * 60 * 60);

      // 2. Pause for 5 days
      await zeroVault.connect(owner).pause();
      await time.increase(5 * 24 * 60 * 60);
      await zeroVault.connect(owner).unpause();

      // 3. Advance remaining 9 days + 1 second of active time (Total active = 14 days + 1 sec)
      await time.increase(9 * 24 * 60 * 60 + 1);

      // 4. Now seller's claim window has expired
      await expect(
        zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey)
      ).to.be.revertedWithCustomError(zeroVault, "ReclaimTimeoutPassed");

      // 5. Vendor can successfully reclaim
      await expect(zeroVault.connect(vendor).reclaimBounty(merkleRoot))
        .to.emit(zeroVault, "BountyReclaimed")
        .withArgs(merkleRoot);

      expect(await zeroVault.refunds(vendor.address)).to.equal(bountyAmount);
    });
  });

  describe("triggerDeadMansSwitch", function () {
    beforeEach(async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
    });

    it("should revert if 7 days have not passed", async function () {
      await expect(
        zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot)
      ).to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");
    });

    it("should dilate dead man's switch window if contract was paused during commit phase", async function () {
      // 1. Advance 4 days into the 7-day commit window
      await time.increase(4 * 24 * 60 * 60);

      // 2. Admin pauses for 5 days
      await zeroVault.connect(owner).pause();
      await time.increase(5 * 24 * 60 * 60);
      await zeroVault.connect(owner).unpause();

      // Total wall-clock time = 9 days (> 7 days COMMIT_TIMEOUT).
      // But active time is only 4 days! Seller cannot expire early.
      await expect(
        zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot)
      ).to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");

      // Advance remaining 3 days + 1 second of active time
      await time.increase(3 * 24 * 60 * 60 + 1);

      await expect(zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot))
        .to.emit(zeroVault, "VaultExpired")
        .withArgs(merkleRoot);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(4); // EXPIRED
    });

    it("should allow triggering after 7 days unpaused", async function () {
      await time.increase(7 * 24 * 60 * 60 + 1);

      await expect(zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot))
        .to.emit(zeroVault, "VaultExpired")
        .withArgs(merkleRoot);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(4); // EXPIRED
    });
  });

  describe("reclaimBounty", function () {
    beforeEach(async function () {
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await zeroVault
        .connect(vendor)
        .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount });
    });

    it("should revert if 14 days have not passed", async function () {
      await expect(
        zeroVault.connect(vendor).reclaimBounty(merkleRoot)
      ).to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");
    });

    it("should allow vendor to reclaim after 14 days and withdraw refund", async function () {
      await time.increase(14 * 24 * 60 * 60 + 1);

      const initialVendorBalance = await ethers.provider.getBalance(vendor.address);

      const tx = await zeroVault.connect(vendor).reclaimBounty(merkleRoot);
      const receipt = await tx.wait();
      const reclaimGasCost = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx).to.emit(zeroVault, "BountyReclaimed").withArgs(merkleRoot);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(5); // REFUNDED

      // Vendor withdraws refund
      const withdrawTx = await zeroVault.connect(vendor).withdrawRefund();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      await expect(withdrawTx)
        .to.emit(zeroVault, "RefundWithdrawn")
        .withArgs(vendor.address, bountyAmount);

      expect(await zeroVault.refunds(vendor.address)).to.equal(0);

      const finalVendorBalance = await ethers.provider.getBalance(vendor.address);
      expect(finalVendorBalance).to.equal(
        initialVendorBalance + bountyAmount - reclaimGasCost - withdrawGasCost
      );
    });

    it("should revert if already settled", async function () {
      await zeroVault
        .connect(seller)
        .revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey);
      await time.increase(14 * 24 * 60 * 60 + 1);

      await expect(
        zeroVault.connect(vendor).reclaimBounty(merkleRoot)
      ).to.be.revertedWithCustomError(zeroVault, "InvalidState");
    });
  });

  describe("Reentrancy Attack on withdrawRefund", function () {
    it("should prevent reentrancy during withdrawRefund", async function () {
      const ReentrancyAttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const vaultAddress = await zeroVault.getAddress();
      const attackerContract = await ReentrancyAttackerFactory.deploy(vaultAddress);

      // Attacker (acting as seller) commits vulnerability
      await attackerContract
        .connect(seller)
        .commitAndAttack(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await attackerContract
        .connect(seller)
        .setTarget(merkleRoot, decryptionKeyBytes, validEncryptedKey);

      // Vendor locks the bounty
      await zeroVault
        .connect(vendor)
        .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount });

      // Attacker attempts the reentrancy attack
      await expect(attackerContract.connect(seller).attack()).to.be.revertedWithCustomError(
        zeroVault,
        "TransferFailed"
      );
    });
  });

  describe("Helpers & View Functions", function () {
    it("should verify partial leaf correctly", async function () {
      const leaf = ethers.keccak256(ethers.toUtf8Bytes("leaf1"));
      const isValid = await zeroVault.verifyPartialLeaf(leaf, leaf, []);
      expect(isValid).to.equal(true);

      const invalidProof = [ethers.keccak256(ethers.toUtf8Bytes("random"))];
      const isInvalid = await zeroVault.verifyPartialLeaf(leaf, leaf, invalidProof);
      expect(isInvalid).to.equal(false);
    });

    it("should compute getActiveLockElapsed correctly and return 0 when settled or uncommitted", async function () {
      // Unlocked escrow returns 0
      expect(await zeroVault.getActiveLockElapsed(merkleRoot)).to.equal(0);

      // Lock escrow
      await zeroVault
        .connect(seller)
        .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash);
      await zeroVault
        .connect(vendor)
        .lockBounty(merkleRoot, validBuyerCompressedPubKey, { value: bountyAmount });

      await time.increase(100);
      const elapsed1 = await zeroVault.getActiveLockElapsed(merkleRoot);
      expect(elapsed1).to.be.greaterThanOrEqual(100);

      // Pause contract and advance time
      await zeroVault.connect(owner).pause();
      await time.increase(50);
      const elapsedWhilePaused = await zeroVault.getActiveLockElapsed(merkleRoot);
      expect(elapsedWhilePaused).to.be.closeTo(elapsed1, 2);

      // Unpause
      await zeroVault.connect(owner).unpause();
      await time.increase(20);
      const elapsedPostUnpause = await zeroVault.getActiveLockElapsed(merkleRoot);
      expect(elapsedPostUnpause).to.be.greaterThanOrEqual(120);

      // Once settled, getActiveLockElapsed returns 0
      await zeroVault
        .connect(seller)
        .revealAndClaim(merkleRoot, decryptionKeyBytes, validEncryptedKey);
      expect(await zeroVault.getActiveLockElapsed(merkleRoot)).to.equal(0);
    });
  });

  describe("AccessControl & Pausable", function () {
    it("should allow admin to update KYC status", async function () {
      await expect(zeroVault.connect(owner).setKYCStatus(attacker.address, true))
        .to.emit(zeroVault, "KYCStatusUpdated")
        .withArgs(attacker.address, true);
      expect(await zeroVault.isKYCVerified(attacker.address)).to.equal(true);
    });

    it("should revert if non-admin tries to update KYC", async function () {
      await expect(
        zeroVault.connect(attacker).setKYCStatus(attacker.address, true)
      ).to.be.revertedWithCustomError(zeroVault, "AccessControlUnauthorizedAccount");
    });

    it("should halt transactions when paused", async function () {
      await zeroVault.connect(owner).pause();
      await expect(
        zeroVault
          .connect(seller)
          .commitVulnerability(merkleRoot, keyHash, vendor.address, askingPrice, ipfsHash)
      ).to.be.revertedWithCustomError(zeroVault, "EnforcedPause");
    });
  });
});
