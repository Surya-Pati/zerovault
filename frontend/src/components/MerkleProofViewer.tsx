"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Search, 
  Key, 
  Terminal, 
  Layers, 
  HelpCircle,
  Hash,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  hashLeaf, 
  verifyProof, 
  DisclosureClaim,
  createMerkleTree
} from "@/lib/crypto";

interface MerkleProofViewerProps {
  merkleRoot: string;
  initialClaims?: DisclosureClaim[];
  selectedInitialIndex?: number;
  onProofVerified?: (isValid: boolean, leafIndex: number) => void;
}

export default function MerkleProofViewer({
  merkleRoot,
  initialClaims = [
    { key: "target", value: "nginx/1.24.0 (Linux x86_64)" },
    { key: "cwe", value: "CWE-787: Out-of-bounds Write" },
    { key: "severity", value: "CRITICAL (CVSS 9.8)" },
    { key: "vulnerability_type", value: "Remote Code Execution (RCE)" },
    { key: "affected_module", value: "ngx_http_parse_header_line" },
    { key: "prerequisites", value: "Unauthenticated HTTP/2 request" },
  ],
  selectedInitialIndex,
  onProofVerified,
}: MerkleProofViewerProps) {
  // Active target root (defaults to props)
  const activeMerkleRoot = merkleRoot || "0x0000000000000000000000000000000000000000000000000000000000000000";

  const [selectedLeafIndex, setSelectedLeafIndex] = useState<number>(selectedInitialIndex ?? 0);
  const [claimKey, setClaimKey] = useState<string>(initialClaims[0]?.key?.trim() || "");
  const [claimValue, setClaimValue] = useState<string>(initialClaims[0]?.value?.trim() || "");
  const [proofInput, setProofInput] = useState<string>(
    JSON.stringify((initialClaims[0] as any)?.proof || [], null, 2)
  );

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
          message: `Claim leaf #${idx} loaded into verifier. Click verify to test.`,
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
  }>({
    status: "IDLE",
    message: "Select a claim leaf and click 'Verify Inclusion Proof' to test cryptographic integrity.",
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

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
        message: `Claim leaf #${index} loaded into verifier. Click verify to test.`,
      });
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleVerify = () => {
    setVerificationResult({ status: "VERIFYING", message: "Calculating keccak256 leaf hash & traversing Merkle proof nodes..." });

    setTimeout(() => {
      try {
        const cleanKey = claimKey.trim();
        const cleanValue = claimValue.trim();
        const activeClaim = initialClaims[selectedLeafIndex];
        const claimSalt = (activeClaim as any)?.salt;
        let computedLeafHash = hashLeaf(cleanKey, cleanValue, claimSalt);

        // Parse proof JSON array
        let proofArray: string[] = [];
        try {
          const parsed = JSON.parse(proofInput);
          if (Array.isArray(parsed)) {
            proofArray = parsed.map((item) => String(item).trim());
          } else {
            throw new Error("Proof must be a JSON array of 0x-prefixed hex strings");
          }
        } catch {
          // Fallback: split by lines or commas
          proofArray = proofInput
            .split(/[\n,]+/)
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter((s) => s.length > 0);
        }

        const targetRoot = activeMerkleRoot.toLowerCase();
        
        if (proofArray.length === 0) {
          setVerificationResult({
            status: "INVALID",
            message: "No Merkle inclusion proof provided for this claim leaf. A valid proof array is required to verify membership against the root.",
            computedRoot: "NO_PROOF",
            computedLeafHash,
            traceLog: [
              `[1] Hashed Leaf ("${cleanKey}:${cleanValue}") -> ${computedLeafHash}`,
              `[2] Inclusion proof array is empty. Cannot traverse to Merkle Root.`
            ],
          });
          if (onProofVerified) {
            onProofVerified(false, selectedLeafIndex);
          }
          return;
        }

        // Use verifyProof from shared library directly
        let isValid = verifyProof(targetRoot, computedLeafHash, proofArray);

        // Fallback: if salted check fails, try unsalted in case claim had no salt
        if (!isValid && claimSalt) {
          const unsaltedHash = hashLeaf(cleanKey, cleanValue);
          if (verifyProof(targetRoot, unsaltedHash, proofArray)) {
            isValid = true;
            computedLeafHash = unsaltedHash;
          }
        }

        // Fallback: if trimmed fails, test raw untrimmed in case leaf was constructed literally
        if (!isValid && (claimKey !== cleanKey || claimValue !== cleanValue)) {
          const rawLeafHash = hashLeaf(claimKey, claimValue, claimSalt);
          if (verifyProof(targetRoot, rawLeafHash, proofArray)) {
            isValid = true;
            computedLeafHash = rawLeafHash;
          }
        }

        // Trace evaluation log
        const traceLog: string[] = [];
        traceLog.push(`[1] Hashed Leaf ("${cleanKey}:${cleanValue}") -> ${computedLeafHash}`);
        traceLog.push(`[2] Verifying proof array with ${proofArray.length} nodes...`);
        traceLog.push(`[Target] Expected Root: ${targetRoot}`);

        if (isValid) {
          setVerificationResult({
            status: "VALID",
            message: "Cryptographic Verification SUCCESS! Claim leaf is proven to be included in on-chain Merkle Root.",
            computedRoot: targetRoot,
            computedLeafHash,
            traceLog,
          });
          if (onProofVerified) {
            onProofVerified(true, selectedLeafIndex);
          }
        } else {
          setVerificationResult({
            status: "INVALID",
            message: "Cryptographic Verification FAILED! The computed hash trajectory does NOT resolve to the target Merkle Root.",
            computedRoot: "MISMATCH",
            computedLeafHash,
            traceLog,
          });
          if (onProofVerified) {
            onProofVerified(false, selectedLeafIndex);
          }
        }
      } catch (err: any) {
        setVerificationResult({
          status: "INVALID",
          message: `Verification Exception: ${err.message || 'Invalid proof format'}`,
        });
      }
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-heading font-semibold text-white tracking-wide">
              Partial Disclosure & Merkle Verification Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Verify zero-knowledge vulnerability assertions against the on-chain Merkle Root without exposing full exploit payload.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-cyan-500/30 font-mono text-xs text-cyan-300">
          <span className="text-slate-500 uppercase text-[10px] tracking-wider">Root:</span>
          <span className="truncate max-w-[180px] md:max-w-[240px]" title={activeMerkleRoot}>
            {activeMerkleRoot}
          </span>
          <button
            onClick={() => handleCopy(activeMerkleRoot, "root")}
            className="p-1 hover:text-white transition-colors"
            title="Copy Merkle Root"
          >
            {copiedField === "root" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Grid: Left - Claims Leaves List | Right - Proof Verifier Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Revealed Claim Leaves (5 Cols) */}
        <Card className="lg:col-span-5 bg-slate-950/80 backdrop-blur-xl border-cyan-500/20 shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Revealed Claim Leaves ({initialClaims.length})
              </CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] font-mono">
                Keccak256 Pre-images
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Select a discrete leaf below to inspect its pre-image key:value and keccak256 hash.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar">
            {initialClaims.map((claim, idx) => {
              const leafHash = hashLeaf(claim.key?.trim() || "", claim.value?.trim() || "", (claim as any)?.salt);
              const isSelected = selectedLeafIndex === idx;

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelectLeaf(idx)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)] text-white"
                      : "bg-slate-900/40 border-white/5 hover:border-cyan-500/30 hover:bg-slate-900/80 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-cyan-400 animate-pulse" : "bg-slate-600"}`} />
                      {claim.key}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                      Leaf #{idx}
                    </span>
                  </div>

                  <p className="text-xs font-sans text-slate-200 font-medium mb-2 line-clamp-2">
                    {claim.value}
                  </p>

                  <div className="flex items-center justify-between bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono text-[11px] text-slate-400">
                    <span className="truncate max-w-[200px]" title={leafHash}>
                      hash: {leafHash}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(leafHash, `leaf-${idx}`);
                      }}
                      className="text-slate-500 hover:text-cyan-300 ml-2"
                      title="Copy leaf hash"
                    >
                      {copiedField === `leaf-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right Column: Proof Verification Workbench (7 Cols) */}
        <Card className="lg:col-span-7 bg-slate-950/80 backdrop-blur-xl border-cyan-500/20 shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Proof Verification Workbench
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const proof = (initialClaims[selectedLeafIndex] as any)?.proof || [];
                  setProofInput(JSON.stringify(proof, null, 2));
                  setVerificationResult({ status: "IDLE", message: "Reset to valid generated proof array." });
                }}
                className="h-7 text-[11px] font-mono text-slate-400 hover:text-cyan-400"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Reset Proof
              </Button>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Input or inspect the Merkle path nodes to verify cryptographic inclusion locally.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            
            {/* Inputs: Claim Key & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3 h-3 text-cyan-400" /> Claim Key
                </Label>
                <Input
                  value={claimKey}
                  onChange={(e) => setClaimKey(e.target.value)}
                  className="font-mono text-xs bg-black/60 border-white/10 text-cyan-300 focus-visible:ring-cyan-500/50"
                  placeholder="e.g. severity"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-cyan-400" /> Claim Value
                </Label>
                <Input
                  value={claimValue}
                  onChange={(e) => setClaimValue(e.target.value)}
                  className="font-sans text-xs bg-black/60 border-white/10 text-white focus-visible:ring-cyan-500/50"
                  placeholder="e.g. CRITICAL"
                />
              </div>
            </div>

            {/* Computed Leaf Hash preview */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400 text-[11px]">Computed Leaf Hash:</span>
              <span className="text-cyan-400 font-semibold truncate max-w-[260px] sm:max-w-[340px]">
                {hashLeaf(claimKey.trim(), claimValue.trim(), (initialClaims[selectedLeafIndex] as any)?.salt)}
              </span>
            </div>

            {/* Inclusion Proof Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-400" /> Inclusion Proof Array (bytes32[])
                </Label>
                <span className="text-[10px] font-mono text-slate-500">
                  JSON format or line-separated 0x-hex strings
                </span>
              </div>
              <textarea
                rows={4}
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                className="w-full font-mono text-xs bg-black/80 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/50 transition-all custom-scrollbar"
                placeholder='["0x...", "0x..."]'
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleVerify}
                disabled={verificationResult.status === "VERIFYING"}
                className="flex-1 h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-heading font-semibold text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all rounded-xl flex items-center justify-center gap-2"
              >
                {verificationResult.status === "VERIFYING" ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                    Evaluating Cryptographic Proof...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Verify Inclusion Proof
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  // Tamper proof to show invalid state visual feedback
                  setProofInput(JSON.stringify(["0xbad0000000000000000000000000000000000000000000000000000000000000"], null, 2));
                  setVerificationResult({
                    status: "IDLE",
                    message: "Injected corrupted proof vector. Click verify to test invalid failure state.",
                  });
                }}
                className="h-11 border-red-500/40 text-red-400 hover:bg-red-950/30 hover:border-red-500/70 font-mono text-xs tracking-wider rounded-xl"
              >
                Tamper Proof (Test Invalid)
              </Button>
            </div>

            {/* Verification Result Feedback Box */}
            <AnimatePresence mode="wait">
              {verificationResult.status !== "IDLE" && (
                <motion.div
                  key={verificationResult.status}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className={`p-4 rounded-xl border relative overflow-hidden ${
                    verificationResult.status === "VALID"
                      ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)] text-emerald-300"
                      : verificationResult.status === "INVALID"
                      ? "bg-red-950/40 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)] text-red-300"
                      : "bg-cyan-950/30 border-cyan-500/30 text-cyan-300"
                  }`}
                >
                  {/* Top glowing edge indicator */}
                  <div
                    className={`absolute top-0 inset-x-0 h-[2px] ${
                      verificationResult.status === "VALID"
                        ? "bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                        : verificationResult.status === "INVALID"
                        ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
                        : "bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"
                    }`}
                  />

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {verificationResult.status === "VALID" && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, 0] }}>
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </motion.div>
                      )}
                      {verificationResult.status === "INVALID" && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1], x: [-2, 2, -2, 0] }}>
                          <XCircle className="w-6 h-6 text-red-400" />
                        </motion.div>
                      )}
                      {verificationResult.status === "VERIFYING" && (
                        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-semibold uppercase text-xs tracking-wider">
                          {verificationResult.status === "VALID"
                            ? "EMERALD VALID - PROOF CONFIRMED"
                            : verificationResult.status === "INVALID"
                            ? "CRIMSON INVALID - PROOF REJECTED"
                            : "EVALUATING MERKLE PROOF"}
                        </span>
                        <Badge
                          className={`font-mono text-[10px] uppercase ${
                            verificationResult.status === "VALID"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : verificationResult.status === "INVALID"
                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                              : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                          }`}
                        >
                          {verificationResult.status}
                        </Badge>
                      </div>

                      <p className="text-xs font-sans leading-relaxed">
                        {verificationResult.message}
                      </p>

                      {/* Execution Trace Log accordion */}
                      {verificationResult.traceLog && verificationResult.traceLog.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block mb-1.5">
                            Merkle Traversal Trace:
                          </span>
                          <div className="p-2.5 rounded-lg bg-black/70 font-mono text-[11px] space-y-1 text-slate-300 max-h-32 overflow-y-auto">
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

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
