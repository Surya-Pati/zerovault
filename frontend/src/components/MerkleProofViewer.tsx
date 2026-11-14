"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Key, 
  Terminal, 
  Layers, 
  Hash, 
  RefreshCw,
  Search,
  ArrowRight,
  Code2,
  GitCommit,
  AlertTriangle,
  Lock,
  Binary,
  Info,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  hashLeaf, 
  verifyProof, 
  DisclosureClaim 
} from "@/lib/crypto";
import { keccak256 } from "ethers";
import MerkleEvaluationInfoModal from "@/components/MerkleEvaluationInfoModal";

interface MerkleProofViewerProps {
  merkleRoot: string;
  initialClaims?: DisclosureClaim[];
  selectedInitialIndex?: number;
  onProofVerified?: (isValid: boolean, leafIndex: number) => void;
}

interface MerkleStepNode {
  step: number;
  currentHash: string;
  siblingHash: string;
  isCurrentLeft: boolean;
  resultingHash: string;
}

export default function MerkleProofViewer({
  merkleRoot,
  initialClaims = [
    { key: "target", value: "nginx/1.24.0 (Linux x86_64)", salt: "0x1111111111111111111111111111111111111111111111111111111111111111" },
    { key: "cwe", value: "CWE-787: Out-of-bounds Write", salt: "0x2222222222222222222222222222222222222222222222222222222222222222" },
    { key: "severity", value: "CRITICAL (CVSS 9.8)", salt: "0x3333333333333333333333333333333333333333333333333333333333333333" },
    { key: "vulnerability_type", value: "Remote Code Execution (RCE)", salt: "0x4444444444444444444444444444444444444444444444444444444444444444" },
    { key: "affected_module", value: "ngx_http_parse_header_line", salt: "0x5555555555555555555555555555555555555555555555555555555555555555" },
    { key: "prerequisites", value: "Unauthenticated HTTP/2 request", salt: "0x6666666666666666666666666666666666666666666666666666666666666666" },
  ],
  selectedInitialIndex = 0,
  onProofVerified,
}: MerkleProofViewerProps) {
  const activeMerkleRoot = merkleRoot || "0x0000000000000000000000000000000000000000000000000000000000000000";

  const [selectedLeafIndex, setSelectedLeafIndex] = useState<number>(selectedInitialIndex);
  const [claimKey, setClaimKey] = useState<string>(initialClaims[0]?.key?.trim() || "");
  const [claimValue, setClaimValue] = useState<string>(initialClaims[0]?.value?.trim() || "");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ladder" | "raw" | "preimage">("ladder");
  const [proofInput, setProofInput] = useState<string>(
    JSON.stringify((initialClaims[0] as any)?.proof || [], null, 2)
  );
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Sync state when initialClaims or selectedInitialIndex prop changes
  useEffect(() => {
    if (initialClaims && initialClaims.length > 0) {
      const idx = (selectedInitialIndex !== undefined && selectedInitialIndex < initialClaims.length)
        ? selectedInitialIndex
        : (selectedLeafIndex < initialClaims.length ? selectedLeafIndex : 0);
      setSelectedLeafIndex(idx);
      const leaf = initialClaims[idx];
      if (leaf) {
        setClaimKey(leaf.key?.trim() || "");
        setClaimValue(leaf.value?.trim() || "");
        const proof = (leaf as any).proof || [];
        setProofInput(JSON.stringify(proof, null, 2));
        setVerificationResult({
          status: "IDLE",
          message: `Claim leaf #${idx} loaded into verifier. Click 'Evaluate Cryptographic Proof' to test.`,
        });
      }
    }
  }, [initialClaims, selectedInitialIndex]);

  const [verificationResult, setVerificationResult] = useState<{
    status: "IDLE" | "VERIFYING" | "VALID" | "INVALID";
    message: string;
    computedRoot?: string;
    computedLeafHash?: string;
    traceLog?: string[];
    steps?: MerkleStepNode[];
  }>({
    status: "IDLE",
    message: "Select a claim leaf and click 'Evaluate Cryptographic Proof' to test mathematical inclusion.",
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filtered claims for left explorer list
  const filteredClaims = useMemo(() => {
    if (!searchFilter.trim()) return initialClaims;
    const q = searchFilter.toLowerCase();
    return initialClaims.filter(
      (c) => c.key.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
    );
  }, [initialClaims, searchFilter]);

  // Sync inputs when selecting a leaf
  const handleSelectLeaf = (index: number) => {
    setSelectedLeafIndex(index);
    const leaf = initialClaims[index];
    if (leaf) {
      setClaimKey(leaf.key?.trim() || "");
      setClaimValue(leaf.value?.trim() || "");
      const proof = (leaf as any).proof || [];
      setProofInput(JSON.stringify(proof, null, 2));
      setVerificationResult({
        status: "IDLE",
        message: `Claim leaf #${index} (${leaf.key}) loaded into verifier. Click 'Evaluate Cryptographic Proof'.`,
      });
    }
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getSafeLeafHash = (key: string, value: string, salt?: string) => {
    try {
      if (!salt) return "(Missing salt)";
      return hashLeaf(key.trim(), value.trim(), salt);
    } catch {
      return "(Invalid salt/leaf)";
    }
  };

  const currentComputedLeafHash = useMemo(() => {
    return getSafeLeafHash(claimKey, claimValue, (initialClaims[selectedLeafIndex] as any)?.salt);
  }, [claimKey, claimValue, initialClaims, selectedLeafIndex]);

  // Perform cryptographic proof verification locally using Keccak-256
  const handleVerify = () => {
    setVerificationResult({
      status: "VERIFYING",
      message: "Recomputing leaf Keccak-256 hash and traversing Merkle path...",
    });

    setTimeout(() => {
      try {
        let proofArray: string[] = [];
        try {
          const trimmed = proofInput.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            proofArray = JSON.parse(trimmed);
          } else {
            proofArray = trimmed
              .split(/[\n,]+/)
              .map((s) => s.trim().replace(/['"]/g, ""))
              .filter((s) => s.startsWith("0x"));
          }
        } catch (parseErr) {
          throw new Error("Invalid proof array format. Expected JSON array of 32-byte hex strings.");
        }

        // Calculate expected leaf hash
        const currentLeaf = initialClaims[selectedLeafIndex];
        const salt = (currentLeaf as any)?.salt;
        const computedLeafHash = hashLeaf(claimKey.trim(), claimValue.trim(), salt);

        // Verify cryptographic path via library
        const isValid = verifyProof(activeMerkleRoot, computedLeafHash, proofArray);

        // Compute step-by-step ladder nodes for interactive visualization
        const steps: MerkleStepNode[] = [];
        let currHash = computedLeafHash;

        for (let i = 0; i < proofArray.length; i++) {
          const sibling = proofArray[i];
          const a = currHash.toLowerCase();
          const b = sibling.toLowerCase();
          const isCurrentLeft = a < b;
          const left = isCurrentLeft ? a : b;
          const right = isCurrentLeft ? b : a;
          const combined = "0x" + left.slice(2) + right.slice(2);
          const nextHash = keccak256(combined);

          steps.push({
            step: i + 1,
            currentHash: currHash,
            siblingHash: sibling,
            isCurrentLeft,
            resultingHash: nextHash,
          });
          currHash = nextHash;
        }

        const traceLog: string[] = [
          `[Pre-Image Key]   : "${claimKey.trim()}"`,
          `[Pre-Image Value] : "${claimValue.trim()}"`,
          `[Pre-Image Salt]  : ${salt ? `"${salt}"` : "(none - legacy packed)"}`,
          `[Computed Leaf]   : ${computedLeafHash}`,
          `[Proof Depth]     : ${proofArray.length} sibling nodes`,
          ...proofArray.map((node, i) => `  ├─ Level ${i + 1} Sibling: ${node.slice(0, 18)}...`),
          `[Computed Root]   : ${currHash}`,
          `[On-Chain Target] : ${activeMerkleRoot}`,
          `[Attestation]     : ${isValid ? "MATCH - PROOF VERIFIED" : "MISMATCH - PROOF INVALID"}`
        ];

        setVerificationResult({
          status: isValid ? "VALID" : "INVALID",
          message: isValid
            ? `Mathematical inclusion confirmed. Leaf #${selectedLeafIndex} is cryptographically rooted in on-chain state without exposing secret exploit payload.`
            : `Proof verification failed. The computed tree root diverges from the committed on-chain root (${activeMerkleRoot.slice(0, 10)}...). Potential data tampering detected.`,
          computedLeafHash,
          computedRoot: currHash,
          traceLog,
          steps,
        });

        // Surface evaluation info and attestation dialog
        setShowInfoModal(true);

        if (onProofVerified) {
          onProofVerified(isValid, selectedLeafIndex);
        }
      } catch (err: any) {
        setVerificationResult({
          status: "INVALID",
          message: `Verification error: ${err.message}`,
          traceLog: [`Error: ${err.message}`],
        });
        setShowInfoModal(true);
        if (onProofVerified) {
          onProofVerified(false, selectedLeafIndex);
        }
      }
    }, 250);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Protocol Status Banner */}
      <div className="p-4 rounded-xl border border-[#1E2330] bg-[#12151D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0A0C10] border border-[#222634] flex items-center justify-center text-[#64748B] shrink-0 mt-0.5">
            <Binary className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-[#F1F5F9] font-sans">
                Selective Disclosure & Merkle Engine
              </h3>
              <Badge variant="outline" className="border-[#10B981]/30 text-[#10B981] bg-[#10B981]/10 text-[10px] font-mono px-2 py-0.5">
                Active Attestation
              </Badge>
            </div>
            <p className="text-[11px] text-[#848B98] font-sans mt-0.5 leading-relaxed">
              Verify zero-knowledge vulnerability assertions against the on-chain Merkle Root without exposing the raw exploit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#0A0C10] px-3 py-2 rounded-lg border border-[#1E2330] font-mono text-xs self-start md:self-auto shrink-0">
          <span className="text-[#64748B] uppercase text-[10px] tracking-wider">Root Hash:</span>
          <span className="text-[#CBD5E1] truncate max-w-[180px] sm:max-w-[220px]" title={activeMerkleRoot}>
            {activeMerkleRoot}
          </span>
          <button
            onClick={() => handleCopy(activeMerkleRoot, "root")}
            className="p-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            title="Copy Merkle Root"
          >
            {copiedField === "root" ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Two-Column Work Surface (5 / 7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Revealed Claim Leaves Explorer (5 Cols) */}
        <div className="lg:col-span-5 rounded-xl border border-[#1E2330] bg-[#12151D] flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#1E2330] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Hash className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="font-semibold text-[#F1F5F9] uppercase tracking-wider text-[11px]">
                  Claim Leaves ({initialClaims.length})
                </span>
              </div>
              <Badge variant="outline" className="border-[#222634] text-[#64748B] bg-[#0A0C10] text-[10px] font-mono">
                Keccak-256
              </Badge>
            </div>

            {/* Quick Filter Search */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-[#64748B]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter claims by key or value..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0C10] border border-[#1E2330] text-[#CBD5E1] placeholder-[#475569] font-mono text-[11px] focus:outline-none focus:border-[#2E3547] transition-colors"
              />
            </div>
          </div>

          {/* Scrollable Leaves List */}
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {filteredClaims.map((claim, idx) => {
              const originalIndex = initialClaims.indexOf(claim);
              const leafHash = getSafeLeafHash(claim.key || "", claim.value || "", (claim as any)?.salt);
              const isSelected = selectedLeafIndex === originalIndex;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectLeaf(originalIndex)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#0A0C10] border-[#3E465D] text-[#F1F5F9] shadow-sm relative overflow-hidden"
                      : "bg-[#131722] border-[#1E2330] hover:border-[#2E3547] text-[#94A3B8]"
                  }`}
                >
                  {/* Selected Active Accent Bar */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#10B981]" />
                  )}

                  <div className="flex items-center justify-between gap-2 mb-1.5 pl-1">
                    <span className="text-[11px] font-mono font-medium flex items-center gap-1.5 text-[#F1F5F9]">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-[#10B981]" : "bg-[#334155]"}`} />
                      {claim.key}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] bg-[#0A0C10] px-2 py-0.5 rounded border border-[#1E2330]">
                      Leaf #{originalIndex}
                    </span>
                  </div>

                  <p className="text-xs font-sans text-[#E2E8F0] font-normal mb-2 line-clamp-2 pl-1 leading-relaxed">
                    {claim.value}
                  </p>

                  <div className="flex items-center justify-between bg-[#0A0C10] px-2.5 py-1.5 rounded border border-[#1E2330] font-mono text-[10px] text-[#64748B]">
                    <span className="truncate max-w-[190px]" title={leafHash}>
                      hash: {leafHash}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(leafHash, `leaf-${originalIndex}`);
                      }}
                      className="text-[#64748B] hover:text-[#CBD5E1] ml-2 transition-colors"
                      title="Copy leaf hash"
                    >
                      {copiedField === `leaf-${originalIndex}` ? (
                        <Check className="w-3 h-3 text-[#10B981]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Cryptographic Engine & Proof Pipeline (7 Cols) */}
        <div className="lg:col-span-7 rounded-xl border border-[#1E2330] bg-[#12151D] flex flex-col overflow-hidden">
          
          {/* Header & View Mode Switcher */}
          <div className="p-3.5 border-b border-[#1E2330] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F1F5F9] font-mono">
                Verification Workbench
              </span>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-[#0A0C10] p-0.5 rounded-lg border border-[#1E2330] self-start sm:self-auto font-mono text-[11px]">
              <button
                onClick={() => setActiveTab("ladder")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === "ladder"
                    ? "bg-[#1E2330] text-[#F1F5F9] font-medium"
                    : "text-[#64748B] hover:text-[#CBD5E1]"
                }`}
              >
                Hash Chain
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === "raw"
                    ? "bg-[#1E2330] text-[#F1F5F9] font-medium"
                    : "text-[#64748B] hover:text-[#CBD5E1]"
                }`}
              >
                Proof Vector
              </button>
              <button
                onClick={() => setActiveTab("preimage")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === "preimage"
                    ? "bg-[#1E2330] text-[#F1F5F9] font-medium"
                    : "text-[#64748B] hover:text-[#CBD5E1]"
                }`}
              >
                Pre-Image
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Tab 1: Interactive Hash Ladder (Default) */}
            {activeTab === "ladder" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#848B98] text-[11px] uppercase tracking-wider">
                    Cryptographic Traversal Ladder
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Lexicographical Pair Hashing (OpenZeppelin)
                  </span>
                </div>

                {/* Ladder Nodes View */}
                {verificationResult.steps && verificationResult.steps.length > 0 ? (
                  <div className="space-y-2 font-mono text-xs">
                    {verificationResult.steps.map((st, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-[#1E2330] bg-[#0A0C10] space-y-2 relative"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                          <span className="font-semibold text-[#848B98]">STAGE 0{st.step} · SIBLING PAIR</span>
                          <span>{st.isCurrentLeft ? "Position: Left" : "Position: Right"}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded bg-[#131722] border border-[#1E2330]">
                            <span className="text-[9px] uppercase tracking-wider text-[#64748B] block mb-0.5">
                              {i === 0 ? "Leaf Hash" : "Intermediate Hash"}
                            </span>
                            <span className="text-[#CBD5E1] truncate block" title={st.currentHash}>
                              {st.currentHash}
                            </span>
                          </div>

                          <div className="p-2 rounded bg-[#131722] border border-[#1E2330]">
                            <span className="text-[9px] uppercase tracking-wider text-[#64748B] block mb-0.5">
                              Sibling Node
                            </span>
                            <span className="text-[#94A3B8] truncate block" title={st.siblingHash}>
                              {st.siblingHash}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#1E2330] text-[11px]">
                          <span className="text-[#64748B] text-[10px]">↳ Resulting Hash:</span>
                          <span className="text-[#10B981] font-semibold truncate max-w-[260px]" title={st.resultingHash}>
                            {st.resultingHash}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border border-[#1E2330] bg-[#0A0C10] text-center space-y-2">
                    <Layers className="w-6 h-6 text-[#475569] mx-auto" />
                    <p className="text-xs text-[#94A3B8] font-sans">
                      Click <strong className="text-[#F1F5F9]">"Evaluate Cryptographic Proof"</strong> below to trace the complete hash chain from the discrete leaf up to the on-chain Merkle Root.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Raw Proof Vector (JSON / Hex Array) */}
            {activeTab === "raw" && (
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-[#848B98] uppercase tracking-wider flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-[#64748B]" /> Inclusion Proof Array (bytes32[])
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const proof = (initialClaims[selectedLeafIndex] as any)?.proof || [];
                      setProofInput(JSON.stringify(proof, null, 2));
                      setVerificationResult({ status: "IDLE", message: "Reset to canonical proof array." });
                    }}
                    className="h-6 px-2 text-[10px] font-mono text-[#848B98] hover:text-[#F1F5F9]"
                  >
                    <RefreshCw className="w-2.5 h-2.5 mr-1" /> Reset Vector
                  </Button>
                </div>
                <textarea
                  rows={5}
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  className="w-full font-mono text-xs bg-[#0A0C10] border border-[#1E2330] rounded-lg p-3 text-[#CBD5E1] placeholder-[#475569] focus:outline-none focus:border-[#2E3547] transition-colors"
                  placeholder='["0x...", "0x..."]'
                />
              </div>
            )}

            {/* Tab 3: Pre-Image Inspection */}
            {activeTab === "preimage" && (
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#848B98] uppercase tracking-wider">
                      Claim Key (Pre-image Component 1)
                    </Label>
                    <Input
                      value={claimKey}
                      onChange={(e) => setClaimKey(e.target.value)}
                      className="font-mono text-xs bg-[#0A0C10] border-[#1E2330] text-[#F1F5F9] focus-visible:border-[#2E3547] rounded-lg h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#848B98] uppercase tracking-wider">
                      Claim Value (Pre-image Component 2)
                    </Label>
                    <Input
                      value={claimValue}
                      onChange={(e) => setClaimValue(e.target.value)}
                      className="font-sans text-xs bg-[#0A0C10] border-[#1E2330] text-[#F1F5F9] focus-visible:border-[#2E3547] rounded-lg h-9"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#1E2330] space-y-1">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">
                    Pre-Image Salt (Dictionary Protection):
                  </span>
                  <span className="text-[#94A3B8] font-mono text-[11px] break-all block">
                    {(initialClaims[selectedLeafIndex] as any)?.salt || "(Legacy unpadded - No salt)"}
                  </span>
                </div>
              </div>
            )}

            {/* Computed Leaf Hash preview badge */}
            <div className="p-2.5 rounded-lg bg-[#0A0C10] border border-[#1E2330] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#64748B] text-[10px] uppercase tracking-wider">
                  Computed Leaf Hash:
                </span>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="inline-flex items-center gap-1 text-[10px] text-[#10B981] hover:text-[#34D399] transition-colors"
                  title="What is this evaluated hash?"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Info</span>
                </button>
              </div>
              <span className="text-[#F1F5F9] font-semibold truncate max-w-[220px] sm:max-w-[320px]" title={currentComputedLeafHash}>
                {currentComputedLeafHash}
              </span>
            </div>

            {/* Action Buttons Bar */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Button
                onClick={handleVerify}
                disabled={verificationResult.status === "VERIFYING"}
                className="flex-1 h-10 bg-[#F1F5F9] hover:bg-white text-[#0D0F14] font-sans font-semibold text-xs tracking-wider uppercase transition-colors rounded-lg flex items-center justify-center gap-2"
              >
                {verificationResult.status === "VERIFYING" ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-[#0D0F14] border-t-transparent animate-spin" />
                    Executing Cryptographic Traverse...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                    Evaluate Cryptographic Proof
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="h-10 border-[#1E2330] bg-[#0A0C10] hover:border-[#10B981]/50 text-[#CBD5E1] hover:text-[#F1F5F9] font-mono text-xs tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 px-3 shrink-0"
                title="View cryptographic evaluation mechanics and attestation certificate"
              >
                <Info className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Evaluation Info</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setProofInput(JSON.stringify(["0xbad0000000000000000000000000000000000000000000000000000000000000"], null, 2));
                  setVerificationResult({
                    status: "IDLE",
                    message: "Injected corrupted sibling node. Click 'Evaluate Cryptographic Proof' to test anti-fraud defense.",
                  });
                }}
                className="h-10 border-[#1E2330] bg-[#0A0C10] hover:border-[#EF4444]/60 text-[#848B98] hover:text-[#EF4444] font-mono text-xs tracking-wider rounded-lg transition-colors shrink-0"
                title="Inject bad vector to simulate adversary tamper attack"
              >
                Simulate Tamper
              </Button>
            </div>

            {/* Verification Result Feedback HUD */}
            <AnimatePresence mode="wait">
              {verificationResult.status !== "IDLE" && (
                <motion.div
                  key={verificationResult.status}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className={`p-4 rounded-xl border relative overflow-hidden ${
                    verificationResult.status === "VALID"
                      ? "bg-[#0A0C10] border-[#10B981]/50 text-[#F1F5F9]"
                      : verificationResult.status === "INVALID"
                      ? "bg-[#0A0C10] border-[#EF4444]/50 text-[#F1F5F9]"
                      : "bg-[#0A0C10] border-[#1E2330] text-[#F1F5F9]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {verificationResult.status === "VALID" && (
                        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                      )}
                      {verificationResult.status === "INVALID" && (
                        <XCircle className="w-5 h-5 text-[#EF4444]" />
                      )}
                      {verificationResult.status === "VERIFYING" && (
                        <RefreshCw className="w-5 h-5 text-[#64748B] animate-spin" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-semibold text-xs tracking-wider uppercase">
                          {verificationResult.status === "VALID"
                            ? "CRYPTOGRAPHIC PROOF CONFIRMED"
                            : verificationResult.status === "INVALID"
                            ? "CRYPTOGRAPHIC PROOF REJECTED"
                            : "EVALUATING INCLUSION PROOF"}
                        </span>
                        <Badge
                          className={`font-mono text-[10px] uppercase rounded px-2 py-0.5 ${
                            verificationResult.status === "VALID"
                              ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30"
                              : verificationResult.status === "INVALID"
                              ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30"
                              : "bg-[#131722] text-[#848B98] border border-[#1E2330]"
                          }`}
                        >
                          {verificationResult.status}
                        </Badge>
                      </div>

                      <p className="text-xs font-sans leading-relaxed text-[#94A3B8]">
                        {verificationResult.message}
                      </p>

                      {/* Interactive Button to Open Evaluation Info Modal */}
                      <div className="pt-2.5 mt-2.5 border-t border-[#1E2330] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowInfoModal(true)}
                          className="text-[11px] font-mono text-[#10B981] hover:text-[#34D399] flex items-center gap-1.5 transition-colors underline-offset-2 hover:underline"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span>View Evaluation Details & Cryptographic Attestation</span>
                        </button>
                      </div>

                      {/* Merkle Traversal Trace Log */}
                      {verificationResult.traceLog && verificationResult.traceLog.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#1E2330]">
                          <span className="text-[10px] font-mono uppercase text-[#64748B] tracking-wider block mb-1.5">
                            Merkle Path Verification Log:
                          </span>
                          <div className="p-2.5 rounded bg-[#131722] border border-[#1E2330] font-mono text-[10.5px] space-y-1 text-[#848B98] max-h-32 overflow-y-auto">
                            {verificationResult.traceLog.map((line, lIdx) => (
                              <div key={lIdx} className="leading-tight">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Cryptographic Evaluation Info Modal */}
      <MerkleEvaluationInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        claimKey={claimKey}
        claimValue={claimValue}
        salt={(initialClaims[selectedLeafIndex] as any)?.salt}
        leafHash={currentComputedLeafHash}
        merkleRoot={activeMerkleRoot}
        computedRoot={verificationResult.computedRoot}
        isVerified={
          verificationResult.status === "VALID"
            ? true
            : verificationResult.status === "INVALID"
            ? false
            : null
        }
        proofDepth={verificationResult.steps?.length || 0}
      />
    </div>
  );
}
