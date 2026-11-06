import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZeroVault, ReentrancyAttacker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZeroVault", function () {
  let zeroVault: ZeroVault;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let vendor: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("dummy_root"));
  const decryptionKey = "my_secret_decryption_key";
  const keyHash = ethers.keccak256(ethers.toUtf8Bytes(decryptionKey));
  const bountyAmount = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, seller, vendor, attacker] = await ethers.getSigners();
    const ZeroVaultFactory = await ethers.getContractFactory("ZeroVault");
    zeroVault = await ZeroVaultFactory.deploy(7 * 24 * 60 * 60, 14 * 24 * 60 * 60);
    await zeroVault.connect(owner).setKYCStatus(vendor.address, true);
  });

  describe("commitVulnerability", function () {
    it("should allow a seller to commit a vulnerability", async function () {
      await expect(zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address))
        .to.emit(zeroVault, "VulnerabilityCommitted")
        .withArgs(merkleRoot, seller.address, vendor.address, keyHash);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(1); // COMMITTED
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.vendor).to.equal(vendor.address);
      expect(escrow.keyHash).to.equal(keyHash);
    });

    it("should revert if escrow already exists", async function () {
      await zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address);
      await expect(zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address))
        .to.be.revertedWithCustomError(zeroVault, "EscrowAlreadyExists");
    });

    it("should revert if seller designates themselves as vendor", async function () {
      const dummyRoot2 = ethers.keccak256(ethers.toUtf8Bytes("dummy_root_2"));
      await expect(zeroVault.connect(seller).commitVulnerability(dummyRoot2, keyHash, seller.address))
        .to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });

    it("should revert if merkleRoot is bytes32(0)", async function () {
      await expect(zeroVault.connect(seller).commitVulnerability(ethers.ZeroHash, keyHash, vendor.address))
        .to.be.revertedWithCustomError(zeroVault, "InvalidHash");
    });

    it("should revert if keyHash is bytes32(0)", async function () {
      await expect(zeroVault.connect(seller).commitVulnerability(merkleRoot, ethers.ZeroHash, vendor.address))
        .to.be.revertedWithCustomError(zeroVault, "InvalidHash");
    });
  });

  describe("lockBounty", function () {
    beforeEach(async function () {
      await zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address);
    });

    it("should allow vendor to lock bounty", async function () {
      await expect(zeroVault.connect(vendor).lockBounty(merkleRoot, { value: bountyAmount }))
        .to.emit(zeroVault, "BountyLocked")
        .withArgs(merkleRoot, bountyAmount);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(2); // BOUNTY_LOCKED
      expect(escrow.bountyAmount).to.equal(bountyAmount);
    });

    it("should revert if buyer is not KYC verified", async function () {
      await zeroVault.connect(owner).setKYCStatus(vendor.address, false);
      await expect(zeroVault.connect(vendor).lockBounty(merkleRoot, { value: bountyAmount }))
        .to.be.revertedWithCustomError(zeroVault, "KYCNotVerified");
    });

    it("should revert if called by non-vendor", async function () {
      await expect(zeroVault.connect(attacker).lockBounty(merkleRoot, { value: bountyAmount }))
        .to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });
  });

  describe("revealAndClaim", function () {
    beforeEach(async function () {
      await zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address);
      await zeroVault.connect(vendor).lockBounty(merkleRoot, { value: bountyAmount });
    });

    it("should allow seller to reveal key, credit refunds ledger, and withdraw funds (Pull-over-Push)", async function () {
      const initialSellerBalance = await ethers.provider.getBalance(seller.address);

      const tx = await zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKey);
      const receipt = await tx.wait();
      const revealGasCost = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(zeroVault, "SettlementConfirmed")
        .withArgs(merkleRoot, keyHash);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(3); // SETTLED

      // Pull-over-push check: seller is credited in internal ledger
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
      expect(finalSellerBalance).to.equal(initialSellerBalance + bountyAmount - revealGasCost - withdrawGasCost);
    });

    it("should reject wrong key", async function () {
      await expect(zeroVault.connect(seller).revealAndClaim(merkleRoot, "wrong_key"))
        .to.be.revertedWithCustomError(zeroVault, "InvalidKey");
    });

    it("should reject if called by non-seller", async function () {
      await expect(zeroVault.connect(attacker).revealAndClaim(merkleRoot, decryptionKey))
        .to.be.revertedWithCustomError(zeroVault, "Unauthorized");
    });

    it("should reject if 14-day reclaim timeout has passed", async function () {
      await time.increase(14 * 24 * 60 * 60 + 1);
      await expect(zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKey))
        .to.be.revertedWithCustomError(zeroVault, "ReclaimTimeoutPassed");
    });
  });

  describe("triggerDeadMansSwitch", function () {
    beforeEach(async function () {
      await zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address);
    });

    it("should revert if 7 days have not passed", async function () {
      await expect(zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot))
        .to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");
    });

    it("should allow triggering after 7 days", async function () {
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second
      
      await expect(zeroVault.connect(seller).triggerDeadMansSwitch(merkleRoot))
        .to.emit(zeroVault, "VaultExpired")
        .withArgs(merkleRoot);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(4); // EXPIRED
    });
  });

  describe("reclaimBounty", function () {
    beforeEach(async function () {
      await zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address);
      await zeroVault.connect(vendor).lockBounty(merkleRoot, { value: bountyAmount });
    });

    it("should revert if 14 days have not passed", async function () {
      await expect(zeroVault.connect(vendor).reclaimBounty(merkleRoot))
        .to.be.revertedWithCustomError(zeroVault, "TimeoutNotReached");
    });

    it("should allow vendor to reclaim after 14 days and withdraw refund", async function () {
      await time.increase(14 * 24 * 60 * 60 + 1); // 14 days + 1 second

      const initialVendorBalance = await ethers.provider.getBalance(vendor.address);

      const tx = await zeroVault.connect(vendor).reclaimBounty(merkleRoot);
      const receipt = await tx.wait();
      const reclaimGasCost = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(zeroVault, "BountyReclaimed")
        .withArgs(merkleRoot);

      const escrow = await zeroVault.escrows(merkleRoot);
      expect(escrow.state).to.equal(5); // REFUNDED

      // Pull-over-push check: vendor is credited in refunds mapping
      expect(await zeroVault.refunds(vendor.address)).to.equal(bountyAmount);

      // Vendor withdraws refund
      const withdrawTx = await zeroVault.connect(vendor).withdrawRefund();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      await expect(withdrawTx)
        .to.emit(zeroVault, "RefundWithdrawn")
        .withArgs(vendor.address, bountyAmount);

      expect(await zeroVault.refunds(vendor.address)).to.equal(0);

      const finalVendorBalance = await ethers.provider.getBalance(vendor.address);
      expect(finalVendorBalance).to.equal(initialVendorBalance + bountyAmount - reclaimGasCost - withdrawGasCost);
    });

    it("should revert if already settled", async function () {
      await zeroVault.connect(seller).revealAndClaim(merkleRoot, decryptionKey);
      await time.increase(14 * 24 * 60 * 60 + 1);
      
      await expect(zeroVault.connect(vendor).reclaimBounty(merkleRoot))
        .to.be.revertedWithCustomError(zeroVault, "InvalidState");
    });
  });

  describe("withdrawRefund", function () {
    it("should revert if caller has no available refund", async function () {
      await expect(zeroVault.connect(attacker).withdrawRefund())
        .to.be.revertedWithCustomError(zeroVault, "InvalidAmount");
    });
  });

  describe("Reentrancy Attack on withdrawRefund", function () {
    it("should prevent reentrancy during withdrawRefund", async function () {
      const ReentrancyAttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const vaultAddress = await zeroVault.getAddress();
      const attackerContract = await ReentrancyAttackerFactory.deploy(vaultAddress);
      
      const attackerAddress = await attackerContract.getAddress();

      // Attacker (acting as seller) commits vulnerability
      await attackerContract.connect(seller).commitAndAttack(merkleRoot, keyHash, vendor.address);
      await attackerContract.connect(seller).setTarget(merkleRoot, decryptionKey);
      
      // Vendor locks the bounty
      await zeroVault.connect(vendor).lockBounty(merkleRoot, { value: bountyAmount });

      // Attacker attempts the attack
      await expect(attackerContract.connect(seller).attack())
        .to.be.revertedWithCustomError(zeroVault, "TransferFailed");
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
      await expect(zeroVault.connect(attacker).setKYCStatus(attacker.address, true))
        .to.be.revertedWithCustomError(zeroVault, "AccessControlUnauthorizedAccount");
    });

    it("should halt transactions when paused", async function () {
      await zeroVault.connect(owner).pause();
      await expect(zeroVault.connect(seller).commitVulnerability(merkleRoot, keyHash, vendor.address))
        .to.be.revertedWithCustomError(zeroVault, "EnforcedPause");
    });
  });
});
