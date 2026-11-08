"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  Clock, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  AlertOctagon, 
  Key, 
  Coins, 
  Download, 
  ShieldCheck, 
  User, 
  Shield
} from "lucide-react";
import { 
  lockBountyOnChain, 
  revealAndClaimOnChain, 
  triggerDeadMansSwitchOnChain, 
  reclaimBountyOnChain,
  normalizeHexKey,
  computeKeyHash,
  commitVulnerabilityOnChain,
  fetchOnChainEscrow,
  OnChainEscrow,
  getKYCStatus,
  formatContractError,
  DEFAULT_ZEROVAULT_ADDRESS,
  getRefundBalance,
  withdrawRefundOnChain
} from "@/lib/contracts";
import { encryptECIES } from "@/lib/crypto";
import { keccak256, toUtf8Bytes } from "ethers";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export type EscrowStage = "CREATED" | "COMMITTED" | "PROOF_VERIFIED" | "BOUNTY_LOCKED" | "SETTLED" | "EXPIRED" | "REFUNDED";

interface EscrowProgressStepperProps {
  listingId: string;
  merkleRoot: string;
  keyHash: string;
  priceEth: string;
  sellerAddress: string;
  vendorAddress: string;
  currentStage: EscrowStage;
  commitTimestamp?: number;
  bountyLockedAt?: number;
  decryptionKey?: string;
  onStageChange?: (newStage: EscrowStage) => void;
  onDownloadPayload?: () => void;
}

export default function EscrowProgressStepper({
  listingId,
  merkleRoot,
  keyHash,
  priceEth,
  sellerAddress,
  vendorAddress,
  currentStage = "COMMITTED",
  commitTimestamp = Date.now() - 86400000,
  bountyLockedAt,
  decryptionKey,
  onStageChange,
  onDownloadPayload,
}: EscrowProgressStepperProps) {
  const { user, refreshUser } = useAuth();
  const activeRole = user?.role === 'BUYER' ? 'BUYER' : 'SELLER';

  const [decryptionKeyInput, setDecryptionKeyInput] = useState<string>("");
  const [bountyEthInput, setBountyEthInput] = useState<string>(priceEth || "1.5");
  
  const [txState, setTxState] = useState<{
    isLoading: boolean;
    txHash?: string;
    error?: string;
    successMsg?: string;
  }>({ isLoading: false });

  const [onChainState, setOnChainState] = useState<any>(null);
  const [withdrawableBalance, setWithdrawableBalance] = useState<string>("0");

  const refreshWithdrawable = React.useCallback(async () => {
    if (user?.wallet_address) {
      try {
        const bal = await getRefundBalance(user.wallet_address);
        setWithdrawableBalance(bal);
      } catch {}
    }
  }, [user?.wallet_address]);

  React.useEffect(() => {
    fetchOnChainEscrow(merkleRoot).then((res) => {
      if (res && res.state > 0) {
        setOnChainState(res);
      }
    });
    refreshWithdrawable();
  }, [merkleRoot, currentStage, txState, refreshWithdrawable]);

  const isCommittedOnChain = Boolean(
    (onChainState && onChainState.state >= 1) || 
    (currentStage !== "CREATED" && currentStage !== undefined)
  );

  // Linear steps sequence
  const linearSteps: { stage: EscrowStage; code: string; label: string; description: string; icon: any }[] = [
    {
      stage: "COMMITTED",
      code: "01",
      label: !isCommittedOnChain ? "Listing created" : "Root committed",
      description: !isCommittedOnChain ? "Awaiting seller to commit Merkle root on-chain." : "Seller committed Merkle root & key hash on-chain.",
      icon: ShieldCheck,
    },
    {
      stage: "PROOF_VERIFIED",
      code: "02",
      label: "Proof verified",
      description: "Buyer verified partial claims against Merkle root.",
      icon: CheckCircle2,
    },
    {
      stage: "BOUNTY_LOCKED",
      code: "03",
      label: "Bounty locked",
      description: "Buyer deposited ETH into smart contract escrow.",
      icon: Lock,
    },
    {
      stage: "SETTLED",
      code: "04",
      label: "Payload settled",
      description: "Seller revealed key; bounty atomically paid in same transaction.",
      icon: Unlock,
    },
  ];

  const getStepStatus = (stepStage: EscrowStage) => {
    if (currentStage === "EXPIRED" || currentStage === "REFUNDED") {
      return "DISABLED";
    }

    const order: EscrowStage[] = ["COMMITTED", "PROOF_VERIFIED", "BOUNTY_LOCKED", "SETTLED"];
    const currentIdx = order.indexOf(currentStage);
    const stepIdx = order.indexOf(stepStage);

    if (stepIdx < currentIdx) return "COMPLETED";
    if (stepIdx === currentIdx) return "ACTIVE";
    return "PENDING";
  };

  const handleCommit = async () => {
    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      const effectiveVendor = (!vendorAddress || vendorAddress === "0x...") 
        ? "0x0000000000000000000000000000000000000000" 
        : vendorAddress;
      const receipt = await commitVulnerabilityOnChain(merkleRoot, keyHash, effectiveVendor, priceEth);
      
      // 1. Notify backend database directly
      try {
        await fetchApi(`/listings/${listingId}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash_commit: receipt?.hash || "0x" })
        });
      } catch (backendErr) {
        console.warn("Backend commit sync warning (Web3 event bridge will also sync):", backendErr);
      }

      setTxState({
        isLoading: false,
        txHash: receipt?.hash || "0x",
        successMsg: `Successfully committed vulnerability to the blockchain!`,
      });
      setOnChainState({ state: 1 });
      if (onStageChange) onStageChange("COMMITTED");
      const res = await fetchOnChainEscrow(merkleRoot);
      if (res && res.state > 0) setOnChainState(res);
    } catch (err: any) {
      const errStr = (err?.message || JSON.stringify(err) || "").toLowerCase();
      if (errStr.includes("escrowalreadyexists") || errStr.includes("0xed778779")) {
        try {
          await fetchApi(`/listings/${listingId}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tx_hash_commit: "0x" })
          });
        } catch {}
        setOnChainState({ state: 1 });
        if (onStageChange) onStageChange("COMMITTED");
        setTxState({
          isLoading: false,
          successMsg: "Vulnerability was already committed on-chain. State synchronized!",
        });
        const res = await fetchOnChainEscrow(merkleRoot);
        if (res && res.state > 0) setOnChainState(res);
        return;
      }

      setTxState({
        isLoading: false,
        error: err.message || "Web3 transaction failed.",
      });
    }
  };

  const handleLockBounty = async () => {
    if (activeRole === 'BUYER') {
      let isVerifiedOnChain = false;
      try {
        if (user?.wallet_address) {
          isVerifiedOnChain = await getKYCStatus(user.wallet_address);
        }
      } catch (e) {
        console.warn("Could not pre-flight verify KYC status:", e);
      }

      if (!isVerifiedOnChain && !user?.verified_buyer) {
        setTxState({
          isLoading: false,
          error: "Buyer wallet is not KYC-verified. Please ask an Administrator to approve your KYC first."
        });
        return;
      }

      if (isVerifiedOnChain && !user?.verified_buyer && refreshUser) {
        refreshUser().catch(() => {});
      }
    }

    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      let freshEscrow: OnChainEscrow | null = null;
      try {
        freshEscrow = await fetchOnChainEscrow(merkleRoot);
      } catch {}

      if (!freshEscrow || freshEscrow.state === 0) {
        setTxState({
          isLoading: false,
          error: "The seller has created this listing in the database but hasn't committed it to the smart contract yet (or the contract is not synchronized). Please wait for the seller to commit."
        });
        return;
      }

      if (freshEscrow && freshEscrow.state >= 1) {
        const userAddr = user?.wallet_address?.toLowerCase();
        const sellerAddr = freshEscrow.seller?.toLowerCase();
        const vendorAddr = freshEscrow.vendor?.toLowerCase();

        if (userAddr && sellerAddr && userAddr === sellerAddr) {
          setTxState({
            isLoading: false,
            error: "You cannot lock bounty on your own listing (your connected wallet is the seller). Please switch to a buyer wallet in MetaMask."
          });
          return;
        }

        if (
          userAddr &&
          vendorAddr &&
          vendorAddr !== "0x0000000000000000000000000000000000000000" &&
          userAddr !== vendorAddr
        ) {
          setTxState({
            isLoading: false,
            error: `This listing is designated for buyer ${vendorAddr.slice(0, 6)}...${vendorAddr.slice(-4)}. Your connected wallet (${userAddr.slice(0, 6)}...${userAddr.slice(-4)}) is not authorized to lock this bounty.`
          });
          return;
        }
      }

      const receipt = await lockBountyOnChain(merkleRoot, priceEth.toString());
      
      try {
        await fetchApi(`/listings/${listingId}/fund`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tx_hash_fund: receipt?.hash || "0x", contract_address: DEFAULT_ZEROVAULT_ADDRESS })
        });
      } catch (backendErr) {
        console.warn("Backend sync failed, but Web3 transaction succeeded", backendErr);
      }

      setTxState({
        isLoading: false,
        txHash: receipt?.hash || "0x" + Array(64).fill("a").join(""),
        successMsg: `Bounty of ${priceEth} ETH locked successfully in ZeroVault smart contract!`,
      });
      if (onStageChange) onStageChange("BOUNTY_LOCKED");
    } catch (err: any) {
      setTxState({
        isLoading: false,
        error: formatContractError(err),
      });
    }
  };

  const handleRevealAndClaim = async () => {
    const rawKey = decryptionKeyInput.trim();
    if (!rawKey) {
      setTxState({ isLoading: false, error: "Please enter the AES-256 decryption key" });
      return;
    }

    const normalizedKey = normalizeHexKey(rawKey);
    const calculatedHash = computeKeyHash(normalizedKey);
    const expectedHash = keyHash.startsWith('0x') ? keyHash.toLowerCase() : `0x${keyHash}`.toLowerCase();
    const legacyUtf8Hash = keccak256(toUtf8Bytes(normalizedKey)).toLowerCase();
    if (keyHash && calculatedHash.toLowerCase() !== expectedHash && legacyUtf8Hash !== expectedHash) {
      setTxState({
        isLoading: false,
        error: `Key mismatch! Keccak256("${rawKey}") does not match expected KeyHash ${keyHash.slice(0, 14)}...`,
      });
      return;
    }

    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      // Fetch on-chain escrow to obtain registered buyer public key for asymmetric ECIES key encapsulation
      const onChain = await fetchOnChainEscrow(merkleRoot);
      const buyerPubKey = onChain?.buyerPublicKey;

      let payloadForContract = normalizedKey;
      const cleanPubKey = buyerPubKey?.startsWith('0x') ? buyerPubKey.slice(2) : buyerPubKey;
      if (cleanPubKey && (cleanPubKey.length === 66 || cleanPubKey.length === 130)) {
        payloadForContract = await encryptECIES(`0x${cleanPubKey}`, normalizedKey);
      } else {
        payloadForContract = normalizedKey.length >= 130 ? normalizedKey : "0x" + normalizedKey.padEnd(130, "0");
      }

      const receipt = await revealAndClaimOnChain(merkleRoot, normalizedKey, payloadForContract);
      
      try {
        await fetchApi(`/listings/${listingId}/settle`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            tx_hash_settle: receipt?.hash || "0x", 
            decryptionKey: normalizedKey,
            encryptedKey: payloadForContract,
            contract_address: DEFAULT_ZEROVAULT_ADDRESS
          })
        });
      } catch (backendErr) {
        console.warn("Backend sync failed, but Web3 transaction succeeded", backendErr);
      }

      let autoWithdrawn = false;
      try {
        await withdrawRefundOnChain();
        autoWithdrawn = true;
      } catch (withdrawErr) {
        console.warn("Auto-withdrawal deferred or rejected; user can withdraw manually:", withdrawErr);
      }

      await refreshWithdrawable();

      setTxState({
        isLoading: false,
        txHash: receipt?.hash || "0x" + Array(64).fill("a").join(""),
        successMsg: autoWithdrawn
          ? `Decryption key verified! Bounty of ${priceEth} ETH was claimed and transferred directly into your MetaMask wallet!`
          : `Decryption key verified! Bounty of ${priceEth} ETH credited to your ZeroVault ledger. Click "Withdraw to MetaMask" below to receive funds.`,
      });
      if (onStageChange) onStageChange("SETTLED");
    } catch (err: any) {
      setTxState({
        isLoading: false,
        error: formatContractError(err),
      });
    }
  };

  const handleWithdrawFunds = async () => {
    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      const receipt = await withdrawRefundOnChain();
      await refreshWithdrawable();
      setTxState({
        isLoading: false,
        txHash: receipt?.hash,
        successMsg: "Funds successfully withdrawn to your MetaMask wallet!"
      });
    } catch (err: any) {
      setTxState({
        isLoading: false,
        error: formatContractError(err)
      });
    }
  };

  const handleTriggerDeadMan = async () => {
    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      const receipt = await triggerDeadMansSwitchOnChain(merkleRoot);
      
      try {
        await fetchApi(`/listings/${listingId}/expire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash_expire: receipt?.hash || "0x" })
        });
      } catch (backendErr) {
        console.warn("Backend sync failed, but Web3 transaction succeeded", backendErr);
      }

      setTxState({
        isLoading: false,
        txHash: receipt?.hash,
        successMsg: "Dead Man's Switch triggered on-chain. Escrow permanently expired.",
      });
      if (onStageChange) onStageChange("EXPIRED");
    } catch (err: any) {
      setTxState({
        isLoading: false,
        error: formatContractError(err),
      });
    }
  };

  const handleReclaimBounty = async () => {
    setTxState({ isLoading: true, error: undefined, successMsg: undefined });
    try {
      const receipt = await reclaimBountyOnChain(merkleRoot);
      
      try {
        await fetchApi(`/listings/${listingId}/reclaim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash_reclaim: receipt?.hash || "0x" })
        });
      } catch (backendErr) {
        console.warn("Backend sync failed, but Web3 transaction succeeded", backendErr);
      }

      await refreshWithdrawable();

      setTxState({
        isLoading: false,
        txHash: receipt?.hash,
        successMsg: "Bounty reclaimed on-chain! Funds credited to your ZeroVault ledger. Click 'Withdraw to MetaMask' below to pull your ETH.",
      });
      if (onStageChange) onStageChange("REFUNDED");
    } catch (err: any) {
      setTxState({
        isLoading: false,
        error: formatContractError(err),
      });
    }
  };

  return (
    <div className="rounded border border-[#232732] bg-[#14171E] overflow-hidden">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#232732] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-mono text-xs font-semibold text-[#F0F2F5]">
            Escrow Lifecycle & Settlement Engine
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#848B98] border border-[#232732] px-2 py-0.5 rounded bg-[#0C0E12]">
          Stage: {currentStage === "COMMITTED" && !onChainState ? "AWAITING_COMMIT" : currentStage}
        </span>
      </div>

      <div className="p-5 space-y-6">
        
        {/* Terminal State Warning: EXPIRED */}
        {currentStage === "EXPIRED" && (
          <div className="p-4 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#F0F2F5] text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-2 text-[#DC2626] font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>DEAD MAN'S SWITCH TRIGGERED (EXPIRED)</span>
            </div>
            <p className="text-[#848B98] leading-relaxed">
              The buyer did not lock the required bounty within the commitment window (Demo Mode: 1s timeout). The seller has triggered the Dead Man's Switch on-chain; this vault is permanently closed.
            </p>
          </div>
        )}

        {/* Terminal State Warning: REFUNDED */}
        {currentStage === "REFUNDED" && (
          <div className="p-4 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#F0F2F5] text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-2 text-[#DC2626] font-semibold">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>BOUNTY RECLAIMED (REFUNDED)</span>
            </div>
            <p className="text-[#848B98] leading-relaxed">
              The seller did not reveal a valid AES decryption key within the timeout window (Demo Mode: 1s timeout). The locked bounty of {priceEth} ETH has been refunded to the buyer's on-chain ledger.
            </p>
          </div>
        )}

        {/* Linear Stepper Progression Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {linearSteps.map((step) => {
            const status = getStepStatus(step.stage);

            return (
              <div
                key={step.stage}
                className={`p-3 rounded border text-left transition-colors font-mono ${
                  status === "COMPLETED"
                    ? "border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]"
                    : status === "ACTIVE"
                    ? "border-[#2563EB] bg-[#0E1526] text-[#F0F2F5]"
                    : "border-[#232732] bg-[#0C0E12]/50 text-[#848B98] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#848B98]">[{step.code}]</span>
                  {status === "COMPLETED" ? (
                    <span className="text-[#16A34A]">✓</span>
                  ) : status === "ACTIVE" ? (
                    <span className="text-[#2563EB] font-bold">●</span>
                  ) : (
                    <span className="text-[#232732]">○</span>
                  )}
                </div>
                <div className="text-xs font-medium leading-tight text-[#F0F2F5]">
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Panel */}
        <div className="p-4 rounded border border-[#232732] bg-[#0C0E12] space-y-4">
          
          <div className="flex items-center justify-between text-xs font-mono border-b border-[#232732] pb-2.5">
            <span className="text-[#848B98] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#2563EB]" />
              Control Panel [{activeRole}]
            </span>
            <span className="text-[11px] text-[#848B98]">
              {user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : "Wallet disconnected"}
            </span>
          </div>

          {/* Feedback states */}
          {txState.error && (
            <div className="p-3 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#DC2626] font-mono text-xs flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{txState.error}</div>
            </div>
          )}

          {txState.successMsg && (
            <div className="p-3 rounded border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A] font-mono text-xs space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{txState.successMsg}</span>
              </div>
              {txState.txHash && (
                <div className="text-[10px] text-[#848B98] truncate">
                  Tx: <span className="text-[#F0F2F5]">{txState.txHash}</span>
                </div>
              )}
            </div>
          )}

          {/* BUYER WORKFLOW */}
          {activeRole === "BUYER" && (
            <div className="space-y-4">
              
              {(currentStage === "COMMITTED" || currentStage === "CREATED") && !isCommittedOnChain && (
                <div className="p-4 rounded border border-[#232732] bg-[#14171E] text-center space-y-1">
                  <Clock className="w-5 h-5 text-[#848B98] mx-auto mb-1" />
                  <div className="font-mono text-xs text-[#F0F2F5]">Awaiting seller on-chain commitment</div>
                  <div className="text-[11px] text-[#848B98] font-sans">
                    Seller must submit the Merkle root on-chain before bounty can be locked.
                  </div>
                </div>
              )}

              {(currentStage === "COMMITTED" || currentStage === "CREATED") && isCommittedOnChain && (
                <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-2">
                  <div className="font-mono text-xs text-[#F0F2F5] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                    <span>Action required: Verify partial disclosure proof</span>
                  </div>
                  <p className="text-xs text-[#848B98] font-sans">
                    The seller committed the vulnerability on-chain. Inspect and verify inclusion proof in the left pane to unlock escrow deposit.
                  </p>
                </div>
              )}

              {currentStage === "PROOF_VERIFIED" && (
                <div className="space-y-3">
                  {!isCommittedOnChain ? (
                    <div className="p-4 rounded border border-[#232732] bg-[#14171E] text-center space-y-1">
                      <Clock className="w-5 h-5 text-[#848B98] mx-auto mb-1" />
                      <div className="font-mono text-xs text-[#F0F2F5]">Awaiting seller commitment sync</div>
                      <div className="text-[11px] text-[#848B98] font-sans">Listing pending on-chain record.</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-[#848B98]">Required Escrow Bounty:</span>
                        <span className="font-semibold text-[#F0F2F5]">{priceEth} ETH</span>
                      </div>
                      <button
                        onClick={handleLockBounty}
                        disabled={txState.isLoading}
                        className="w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        {txState.isLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        <span>{txState.isLoading ? "Locking bounty on-chain..." : `Lock ${priceEth} ETH in escrow`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentStage === "BOUNTY_LOCKED" && (
                <div className="space-y-3 p-3.5 rounded border border-[#D97706]/40 bg-[#17130B] font-mono text-xs">
                  <div className="flex items-center justify-between text-[#D97706]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5" /> Awaiting seller key reveal
                    </span>
                    <span className="text-[10px] text-[#848B98]">Demo timeout: 1s</span>
                  </div>
                  <p className="text-[11px] text-[#848B98] font-sans">
                    Bounty of {priceEth} ETH is locked in escrow. If seller fails to reveal within timeout, you can reclaim your funds below.
                  </p>
                  <button
                    onClick={handleReclaimBounty}
                    disabled={txState.isLoading}
                    className="w-full py-2 px-3 rounded border border-[#D97706]/50 bg-[#1E190E] hover:bg-[#2A2312] text-[#D97706] text-xs font-mono transition-colors"
                  >
                    {txState.isLoading ? "Reclaiming bounty..." : "Reclaim bounty (timeout expired)"}
                  </button>
                </div>
              )}

              {currentStage === "SETTLED" && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded border border-[#16A34A]/40 bg-[#0F1A14] font-mono text-xs space-y-1">
                    <div className="flex items-center gap-2 text-[#16A34A] font-semibold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Escrow settled successfully</span>
                    </div>
                    <p className="text-[11px] text-[#848B98] font-sans">
                      The seller revealed the decryption key on-chain and bounty was transferred atomically.
                    </p>
                  </div>

                  {decryptionKey && (
                    <div className="p-3 rounded border border-[#232732] bg-[#14171E] font-mono text-xs space-y-1.5">
                      <span className="text-[10px] text-[#848B98] block">AES-256 Decryption Key:</span>
                      <code className="text-[#2563EB] text-[11px] block break-all select-all">
                        {decryptionKey}
                      </code>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (onDownloadPayload) onDownloadPayload();
                    }}
                    className="w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download encrypted payload</span>
                  </button>
                </div>
              )}

              {Number(withdrawableBalance) > 0 && (
                <div className="p-3.5 rounded border border-[#D97706]/40 bg-[#17130B] font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#848B98]">Refund Balance:</span>
                    <span className="font-semibold text-[#D97706]">{withdrawableBalance} ETH</span>
                  </div>
                  <button
                    onClick={handleWithdrawFunds}
                    disabled={txState.isLoading}
                    className="w-full py-2 px-3 rounded bg-[#D97706] hover:bg-[#B45309] text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Withdraw {withdrawableBalance} ETH to MetaMask</span>
                  </button>
                </div>
              )}

              {currentStage === "REFUNDED" && Number(withdrawableBalance) === 0 && (
                <div className="p-3 rounded border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A] font-mono text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All refunded funds have been withdrawn to your wallet.</span>
                </div>
              )}

            </div>
          )}

          {/* SELLER WORKFLOW */}
          {activeRole === "SELLER" && (
            <div className="space-y-4">
              
              {(currentStage === "COMMITTED" || currentStage === "CREATED") && (
                <div className="space-y-3 font-mono text-xs">
                  {!isCommittedOnChain ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-[#848B98] font-sans">
                        Listing is in database. Formally commit the cryptographic hash to the blockchain to allow buyers to lock funds.
                      </p>
                      <button
                        onClick={handleCommit}
                        disabled={txState.isLoading}
                        className="w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        {txState.isLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Shield className="w-3.5 h-3.5" />
                        )}
                        <span>{txState.isLoading ? "Committing on-chain..." : "Commit on-chain"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[#848B98] text-[11px]">
                        <span>Root committed on-chain</span>
                        <span>Demo timeout: 1s</span>
                      </div>
                      <button
                        onClick={handleTriggerDeadMan}
                        disabled={txState.isLoading}
                        className="w-full py-2 px-3 rounded border border-[#D97706]/50 bg-[#1E190E] hover:bg-[#2A2312] text-[#D97706] text-xs font-mono transition-colors"
                      >
                        {txState.isLoading ? "Triggering Dead Man's Switch..." : "Trigger Dead Man's Switch (timeout expired)"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentStage === "BOUNTY_LOCKED" && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-[#F0F2F5] block">
                      Reveal decryption key & claim {priceEth} ETH
                    </span>
                    <p className="text-[11px] text-[#848B98] font-sans">
                      Enter plaintext AES key. Contract validates Keccak256 hash and transfers bounty atomically.
                    </p>
                  </div>

                  {Number(onChainState?.bountyAmountEth) < Number(priceEth) && (
                    <div className="p-3 rounded border border-[#DC2626]/50 bg-[#170E10] text-[#DC2626] text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>EXPLOIT ATTEMPT DETECTED</span>
                      </div>
                      <p className="text-[11px] text-[#848B98] font-sans leading-relaxed">
                        Locked bounty is only {onChainState?.bountyAmountEth} ETH, lower than agreed {priceEth} ETH. Do not reveal key!
                      </p>
                    </div>
                  )}

                  <input
                    type="text"
                    value={decryptionKeyInput}
                    onChange={(e) => setDecryptionKeyInput(e.target.value)}
                    placeholder="Enter AES-256 decryption key (key_0x...)"
                    disabled={Number(onChainState?.bountyAmountEth) < Number(priceEth)}
                    className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB] disabled:opacity-50"
                  />

                  <button
                    onClick={handleRevealAndClaim}
                    disabled={txState.isLoading || !decryptionKeyInput.trim() || Number(onChainState?.bountyAmountEth) < Number(priceEth)}
                    className="w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {txState.isLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    <span>{txState.isLoading ? "Submitting key on-chain..." : `Reveal key & claim ${priceEth} ETH`}</span>
                  </button>
                </div>
              )}

              {(currentStage === "SETTLED" || Number(withdrawableBalance) > 0) && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Bounty settled successfully</span>
                  </div>

                  {Number(withdrawableBalance) > 0 ? (
                    <div className="p-3.5 rounded border border-[#16A34A]/40 bg-[#0F1A14] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[#848B98]">Available Payout:</span>
                        <span className="font-semibold text-[#16A34A]">{withdrawableBalance} ETH</span>
                      </div>
                      <button
                        onClick={handleWithdrawFunds}
                        disabled={txState.isLoading}
                        className="w-full py-2 px-3 rounded bg-[#16A34A] hover:bg-[#15803D] text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Withdraw {withdrawableBalance} ETH to MetaMask</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded border border-[#232732] bg-[#14171E] text-[#848B98] text-[11px]">
                      All settled funds ({priceEth} ETH) have been transferred to your wallet.
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
