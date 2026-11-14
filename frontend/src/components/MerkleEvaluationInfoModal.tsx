"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  ShieldCheck, 
  X, 
  Copy, 
  Check, 
  Binary, 
  Layers, 
  Lock, 
  Key, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle,
  FileCheck,
  Cpu
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_ZEROVAULT_ADDRESS } from "@/lib/contracts";

export interface MerkleEvaluationInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  claimKey: string;
  claimValue: string;
  salt?: string;
  leafHash?: string;
  merkleRoot: string;
  computedRoot?: string;
  isVerified?: boolean | null;
  proofDepth?: number;
  contractAddress?: string;
}

export default function MerkleEvaluationInfoModal({
  isOpen,
  onClose,
  claimKey,
  claimValue,
  salt,
  leafHash = "",
  merkleRoot,
  computedRoot = "",
  isVerified = null,
  proofDepth = 0,
  contractAddress = DEFAULT_ZEROVAULT_ADDRESS,
}: MerkleEvaluationInfoModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"math" | "certificate" | "security">("math");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dismiss on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleCopy = (text: string, fieldId: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedField(fieldId);
          setTimeout(() => setCopiedField(null), 2000);
        })
        .catch(() => {
          // Graceful fallback in environments with restricted clipboard permissions
        });
    }
  };

  const certificateText = [
    "==================================================================",
    "       ZEROVAULT PROTOCOL · CRYPTOGRAPHIC ATTESTATION CERTIFICATE",
    "==================================================================",
    `Timestamp (UTC)    : ${new Date().toISOString()}`,
    `Network            : Ethereum Sepolia (Chain ID 11155111)`,
    `Contract Address   : ${contractAddress}`,
    `On-Chain Merkle Root: ${merkleRoot}`,
    "------------------------------------------------------------------",
    "CLAIM SPECIFICATION:",
    `  Property Name    : "${claimKey}"`,
    `  Property Value   : "${claimValue}"`,
    `  Entropy Salt     : ${salt || "(Unsalted / Legacy)"}`,
    "------------------------------------------------------------------",
    "CRYPTOGRAPHIC EVALUATION:",
    `  Leaf Hash (h0)   : ${leafHash}`,
    `  Computed Root (R): ${computedRoot || merkleRoot}`,
    `  Sibling Depth (k): ${proofDepth} sibling levels traversed`,
    `  Verification Pass: ${isVerified === true ? "CONFIRMED (MATCHES ON-CHAIN STATE)" : isVerified === false ? "REJECTED (HASH DIVERGENCE)" : "AWAITING LOCAL RUN"}`,
    "------------------------------------------------------------------",
    "ZERO-KNOWLEDGE GUARANTEE:",
    "  This proof mathematically guarantees that the vulnerability",
    "  parameter exists within the encrypted payload committed to",
    "  the escrow contract, without leaking the exploit binary or key.",
    "==================================================================",
  ].join("\n");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click backdrop to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card Container */}
      <div className="relative w-full max-w-3xl my-auto z-10 bg-[#0D0F14] border border-[#222634] rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] p-5 sm:p-7 overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[#1E2330]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#131722] border border-[#222634] flex items-center justify-center text-[#10B981] shrink-0 mt-0.5">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-sm sm:text-base font-semibold text-[#F1F5F9]">
                  Cryptographic Leaf Hash & Proof Attestation
                </h2>
                <Badge
                  className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${
                    isVerified === true
                      ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
                      : isVerified === false
                      ? "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30"
                      : "bg-[#1E2330] text-[#94A3B8] border border-[#2E3547]"
                  }`}
                >
                  {isVerified === true
                    ? "Verified On-Chain"
                    : isVerified === false
                    ? "Proof Mismatch"
                    : "Attestation Ready"}
                </Badge>
              </div>
              <p className="text-[11px] text-[#848B98] font-sans mt-0.5">
                Mathematical zero-knowledge disclosure verification mechanics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg border border-[#222634] bg-[#131722] hover:border-[#2E3547] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-mono text-xs flex items-center gap-1.5"
              title="Close modal (Esc)"
            >
              <span className="hidden sm:inline text-[#64748B] text-[10px] uppercase">Esc</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#0A0C10] p-1 rounded-lg border border-[#1E2330] mb-5 font-mono text-xs">
          <button
            onClick={() => setActiveTab("math")}
            className={`flex-1 py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "math"
                ? "bg-[#1E2330] text-[#F1F5F9] font-medium shadow-sm"
                : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3-Phase Verification</span>
          </button>
          <button
            onClick={() => setActiveTab("certificate")}
            className={`flex-1 py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "certificate"
                ? "bg-[#1E2330] text-[#F1F5F9] font-medium shadow-sm"
                : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Audit Certificate</span>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "security"
                ? "bg-[#1E2330] text-[#F1F5F9] font-medium shadow-sm"
                : "text-[#64748B] hover:text-[#CBD5E1]"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ZK Security Guarantee</span>
          </button>
        </div>

        {/* Tab 1: 3-Phase Verification Flow */}
        {activeTab === "math" && (
          <div className="space-y-4">
            
            {/* Phase 1 Card */}
            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#12151D] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#10B981] font-semibold tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Phase 1 · Leaf Pre-Image Hashing
                </span>
                <span className="font-mono text-[10px] text-[#64748B]">keccak256(abi.encode)</span>
              </div>

              <p className="text-xs text-[#94A3B8] font-sans leading-relaxed">
                The evaluated hash represents the cryptographic digest of the claim tuple. ZeroVault uses a 256-bit cryptographically secure salt to prevent dictionary attacks against standard vulnerability attributes.
              </p>

              <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#1E2330] space-y-2 font-mono text-[11px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#CBD5E1]">
                  <span className="text-[#64748B] uppercase text-[10px]">Claim Key:</span>
                  <span className="text-[#F1F5F9] font-semibold">&quot;{claimKey}&quot;</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#CBD5E1]">
                  <span className="text-[#64748B] uppercase text-[10px]">Claim Value:</span>
                  <span className="text-[#F1F5F9] font-semibold truncate max-w-[340px]" title={claimValue}>
                    &quot;{claimValue}&quot;
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#CBD5E1]">
                  <span className="text-[#64748B] uppercase text-[10px]">Pre-Image Salt:</span>
                  <span className="text-[#848B98] truncate max-w-[280px]" title={salt || "None"}>
                    {salt ? `${salt.slice(0, 14)}...${salt.slice(-8)} (256-bit entropy)` : "None"}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#1E2330] flex items-center justify-between">
                  <span className="text-[#10B981] uppercase text-[10px] font-semibold">Computed Leaf Hash:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#10B981] font-semibold truncate max-w-[240px] sm:max-w-[320px]" title={leafHash}>
                      {leafHash || "(Not yet evaluated)"}
                    </span>
                    {leafHash && (
                      <button
                        onClick={() => handleCopy(leafHash, "leaf-hash")}
                        className="p-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
                        title="Copy leaf hash"
                      >
                        {copiedField === "leaf-hash" ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Phase 2 Card */}
            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#12151D] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#3B82F6] font-semibold tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                  Phase 2 · Sibling Tree Ascent (OpenZeppelin)
                </span>
                <span className="font-mono text-[10px] text-[#64748B]">Sorted Pair Hashing</span>
              </div>

              <p className="text-xs text-[#94A3B8] font-sans leading-relaxed">
                The verifier climbs the tree by hashing the current node with its sibling node at each depth: <code className="text-[#CBD5E1] bg-[#0A0C10] px-1 py-0.5 rounded">keccak256(min(a, b) || max(a, b))</code>. OpenZeppelin standard sorted pairs remove position ambiguity and prevent second pre-image attacks.
              </p>

              <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#1E2330] flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#64748B] uppercase text-[10px]">Sibling Path Depth:</span>
                <span className="text-[#CBD5E1]">
                  {proofDepth > 0 ? `${proofDepth} Merkle Levels (${Math.pow(2, proofDepth)} potential leaves)` : "Direct Leaf Test"}
                </span>
              </div>
            </div>

            {/* Phase 3 Card */}
            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#12151D] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#8B5CF6] font-semibold tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                  Phase 3 · Immutable On-Chain Settlement
                </span>
                <span className="font-mono text-[10px] text-[#64748B]">ZeroVault.sol</span>
              </div>

              <p className="text-xs text-[#94A3B8] font-sans leading-relaxed">
                The final computed hash is compared directly against the Merkle Root stored immutably on Ethereum Sepolia. A single altered character in the claim value, salt, or proof array causes root divergence.
              </p>

              <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#1E2330] space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] uppercase text-[10px]">Evaluated Tree Root:</span>
                  <span className="text-[#F1F5F9] font-semibold truncate max-w-[260px] sm:max-w-[340px]" title={computedRoot || merkleRoot}>
                    {computedRoot || merkleRoot}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] uppercase text-[10px]">On-Chain Target Root:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#94A3B8] truncate max-w-[260px] sm:max-w-[340px]" title={merkleRoot}>
                      {merkleRoot}
                    </span>
                    <button
                      onClick={() => handleCopy(merkleRoot, "modal-root")}
                      className="p-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
                      title="Copy on-chain root"
                    >
                      {copiedField === "modal-root" ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Attestation Certificate */}
        {activeTab === "certificate" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#848B98] text-[11px] uppercase tracking-wider">
                Cryptographic Attestation Output
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(certificateText, "cert")}
                className="h-7 px-2.5 text-xs font-mono border-[#1E2330] bg-[#131722] text-[#10B981] hover:bg-[#10B981]/10"
              >
                {copiedField === "cert" ? (
                  <>
                    <Check className="w-3 h-3 mr-1" /> Copied Certificate
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" /> Copy Attestation Certificate
                  </>
                )}
              </Button>
            </div>

            <pre className="p-4 rounded-xl bg-[#0A0C10] border border-[#1E2330] text-[#CBD5E1] font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre selection:bg-[#10B981]/30">
              {certificateText}
            </pre>
          </div>
        )}

        {/* Tab 3: ZK Security Guarantee */}
        {activeTab === "security" && (
          <div className="space-y-4 text-xs font-sans text-[#CBD5E1]">
            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#12151D] space-y-2">
              <h3 className="font-semibold text-sm text-[#F1F5F9] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                Zero-Knowledge Disclosure Protection
              </h3>
              <p className="text-[#94A3B8] leading-relaxed">
                ZeroVault protects both counter-parties through zero-knowledge verification primitives:
              </p>
              <ul className="space-y-2 list-disc list-inside text-[#94A3B8] pt-1">
                <li>
                  <strong className="text-[#F1F5F9]">Buyer Protection:</strong> The buyer can verify that specific technical prerequisites, CWE classifications, and target affected modules were included in the original commitment created before escrow funding.
                </li>
                <li>
                  <strong className="text-[#F1F5F9]">Researcher Protection:</strong> Only the selective claim is revealed off-chain. The actual exploit payload, proof-of-concept scripts, and AES-256 decryption key remain mathematically concealed until escrow bounty is locked on-chain.
                </li>
                <li>
                  <strong className="text-[#F1F5F9]">Second Pre-Image Resistance:</strong> OpenZeppelin lexicographical sorting guarantees that no attacker can craft false tree paths or manipulate node positions.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#0A0C10] space-y-2 font-mono text-[11px]">
              <div className="text-[#64748B] uppercase text-[10px] tracking-wider">
                Smart Contract Audit Reference:
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#848B98]">Escrow Contract:</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#10B981] hover:underline flex items-center gap-1"
                >
                  {contractAddress}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#848B98]">Standard:</span>
                <span className="text-[#CBD5E1]">OpenZeppelin MerkleProof v5.0</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-[#1E2330] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#64748B]">
            ZeroVault Cryptographic Verifier v2.4
          </span>
          <Button
            onClick={onClose}
            className="h-8 px-4 bg-[#1E2330] hover:bg-[#2A3142] text-[#F1F5F9] font-mono text-xs rounded-lg transition-colors"
          >
            Done
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}
