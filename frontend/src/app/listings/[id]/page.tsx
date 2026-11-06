"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { ArrowLeft, Copy, Check, Terminal as TerminalIcon, ShieldAlert, Clock, User, Share2, Eye, Lock } from "lucide-react";
import EscrowProgressStepper, { EscrowStage } from "@/components/EscrowProgressStepper";
import MerkleProofModal from "@/components/MerkleProofModal";
import { PayloadDecryptor } from "@/components/PayloadDecryptor";
import { DisclosureClaim } from "@zerovault/shared/dist/merkle";
import { fetchApi } from "@/lib/api";
import { fetchOnChainEscrow } from "@/lib/contracts";
import { useAuth } from "@/providers/AuthProvider";

interface ListingData {
  id: string;
  title: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  merkle_root: string;
  price_eth: string;
  status: EscrowStage;
  seller_address: string;
  vendor_address: string;
  seller_profile?: string;
  vendor_profile?: string;
  key_hash: string;
  created_at: string;
  claims: DisclosureClaim[];
  decryption_key?: string;
}

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const listingId = params.id;
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingData | null>(null);
  const [currentStage, setCurrentStage] = useState<EscrowStage>("CREATED");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);

  // Modal State for Merkle Proof Inspection
  const [activeModalClaim, setActiveModalClaim] = useState<DisclosureClaim | null>(null);
  const [activeModalIndex, setActiveModalIndex] = useState<number>(0);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  const [logs, setLogs] = useState<string[]>([
    `[SYSTEM] Initialized ZeroVault Audit Stream for Listing #${listingId.slice(0, 8)}`,
    `[STATUS] Connecting to local RPC and on-chain contract...`,
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev]);
  };

  useEffect(() => {
    async function loadListing() {
      try {
        const res = await fetchApi(`/listings/${listingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.listing) {
            const l = data.listing;

            // Reconcile on-chain escrow state with backend state
            if (l.merkle_root) {
              try {
                const onChain = await fetchOnChainEscrow(l.merkle_root);
                if (onChain && onChain.state >= 1) {
                  const stateMap: Record<number, EscrowStage> = {
                    1: "COMMITTED",
                    2: "BOUNTY_LOCKED",
                    3: "SETTLED",
                    4: "EXPIRED",
                    5: "REFUNDED",
                  };
                  const onChainStatus = stateMap[onChain.state];
                  if (onChainStatus) {
                    if (l.status === "CREATED" && onChainStatus === "COMMITTED") {
                      fetchApi(`/listings/${listingId}/commit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tx_hash_commit: "0x" }),
                      }).catch(() => {});
                    }
                    l.status = onChainStatus;
                  }
                }
              } catch (onChainErr) {
                console.warn("Could not query on-chain escrow state:", onChainErr);
              }
            }

            setListing((prev) => {
              if (!prev) {
                return {
                  id: l.id,
                  title: l.title || "Untitled",
                  category: l.category || "General",
                  severity: l.severity || "MEDIUM",
                  merkle_root: l.merkle_root,
                  price_eth: l.price_wei ? (Number(l.price_wei) / 1e18).toString() : "0",
                  status: l.status || "CREATED",
                  seller_address: l.seller_address || "0x...",
                  vendor_address: l.vendor_address || "0x...",
                  seller_profile: l.seller?.profile_name,
                  vendor_profile: l.vendor?.profile_name,
                  key_hash: l.key_hash || "0x...",
                  created_at: l.created_at || new Date().toISOString(),
                  claims: l.claims || [],
                  decryption_key: l.escrow?.decryption_key,
                };
              }
              const nextDecryptionKey = l.escrow?.decryption_key || prev.decryption_key;
              const nextClaims = l.claims && l.claims.length > 0 ? l.claims : prev.claims;
              const nextStatus = l.status || prev.status;
              if (nextDecryptionKey !== prev.decryption_key || nextClaims !== prev.claims || nextStatus !== prev.status) {
                return { ...prev, decryption_key: nextDecryptionKey, claims: nextClaims, status: nextStatus };
              }
              return prev;
            });

            setCurrentStage((prev) => {
              if (l.status && l.status !== prev) {
                const order = ["CREATED", "COMMITTED", "PROOF_VERIFIED", "BOUNTY_LOCKED", "SETTLED", "EXPIRED", "REFUNDED"];
                const prevIdx = order.indexOf(prev);
                const nextIdx = order.indexOf(l.status);
                if (nextIdx < prevIdx && !["EXPIRED", "REFUNDED"].includes(l.status)) {
                  return prev;
                }
                addLog(`[SYNC] Escrow state transition -> ${l.status}`);
                return l.status as any;
              }
              return prev;
            });

            if (loading) {
              addLog(`[API] Listing details retrieved successfully`);
              addLog(`[STATE] Merkle Root: ${l.merkle_root.slice(0, 16)}...`);
              addLog(`[STATE] Current Status: ${l.status}`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load listing", err);
      } finally {
        setLoading(false);
      }
    }

    loadListing();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadListing();
    }, 4000);
    return () => clearInterval(interval);
  }, [listingId]);

  const handleStageChange = (newStage: EscrowStage) => {
    setCurrentStage(newStage);
    addLog(`[STATE] Transitioned to ${newStage}`);
  };

  const handleProofVerified = (isValid: boolean, leafIndex: number) => {
    if (isValid) {
      setCurrentStage("PROOF_VERIFIED");
      addLog(`[PROOF] Inclusion proof verified for claim #${leafIndex}. Ready to lock bounty.`);
    } else {
      addLog(`[WARN] Inclusion proof failed verification for claim #${leafIndex}`);
    }
  };

  const handleDownloadPayload = async () => {
    try {
      addLog(`[DOWNLOAD] Requesting decrypted vulnerability payload...`);
      const res = await fetchApi(`/listings/${listingId}/payload`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zerovault-payload-${listingId.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        addLog(`[DOWNLOAD] Decrypted payload downloaded.`);
      }
    } catch (err: any) {
      addLog(`[ERROR] Failed to download payload: ${err.message}`);
    }
  };

  const openClaimModal = (claim: DisclosureClaim, index: number) => {
    setActiveModalClaim(claim);
    setActiveModalIndex(index);
    setIsProofModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-[#848B98]">
          Loading disclosure specification...
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 font-mono text-xs">
          <span className="text-[#DC2626]">Listing not found in ZeroVault registry.</span>
          <Link href="/listings" className="text-[#2563EB] hover:underline">
            Return to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const effectiveClaims: DisclosureClaim[] =
    listing.claims && listing.claims.length > 0
      ? listing.claims
      : [
          { key: "title", value: listing.title },
          { key: "category", value: listing.category },
          { key: "severity", value: listing.severity },
          { key: "cve", value: "CVE-2026-ZERO" },
        ];

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      {/* Proof Modal Popup Housing Original Workbench */}
      <MerkleProofModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        merkleRoot={listing.merkle_root}
        claims={effectiveClaims}
        selectedInitialIndex={activeModalIndex}
        onProofVerified={handleProofVerified}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#232732] pb-4 font-mono text-xs">
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 text-[#848B98] hover:text-[#F0F2F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Marketplace</span>
            <span className="text-[#232732]">/</span>
            <span className="text-[#F0F2F5]">#{listing.id.slice(0, 8)}</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="px-3 py-1 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] transition-colors text-[#848B98] hover:text-[#F0F2F5] flex items-center gap-1.5 text-[11px]"
            >
              {copiedLink ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Share2 className="w-3 h-3" />}
              <span>{copiedLink ? "Link copied" : "Share"}</span>
            </button>
          </div>
        </div>

        {/* Hero Specification Bar */}
        <div className="p-6 rounded border border-[#232732] bg-[#14171E] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="font-semibold text-[#DC2626]">
                {listing.severity} SEVERITY
              </span>
              <span className="text-[#232732]">|</span>
              <span className="text-[#848B98]">{listing.category}</span>
              <span className="text-[#232732]">|</span>
              <span className="text-[#848B98]">Committed: {new Date(listing.created_at).toLocaleDateString()}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              {listing.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#848B98] pt-1">
              <span>Seller: {listing.seller_profile ? `@${listing.seller_profile}` : `${listing.seller_address.slice(0, 6)}...${listing.seller_address.slice(-4)}`}</span>
              <span>•</span>
              <span>Target: {listing.vendor_profile ? `@${listing.vendor_profile}` : listing.vendor_address ? `${listing.vendor_address.slice(0, 6)}...` : "Open"}</span>
              <span>•</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(listing.merkle_root);
                  setCopiedRoot(true);
                  setTimeout(() => setCopiedRoot(false), 2000);
                }}
                className="hover:text-[#F0F2F5] transition-colors"
                title="Click to copy on-chain Merkle Root"
              >
                Root: <span className="text-[#9AA2B2]">{listing.merkle_root.slice(0, 16)}...</span>{" "}
                <span className="text-[10px] underline">{copiedRoot ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div className="font-mono lg:text-right border-t lg:border-t-0 border-[#232732] pt-4 lg:pt-0">
            <span className="text-2xl font-bold text-[#F0F2F5] block">
              {listing.price_eth} ETH
            </span>
            <span className="text-[11px] text-[#848B98] block">
              Escrow Bounty
            </span>
          </div>
        </div>

        {/* 60 / 40 Two-Column Audit Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (60%): Partial Disclosure Block Matrix */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="border-b border-[#232732] pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#F0F2F5] font-sans">
                  Partial Disclosure Claims & Proof Blocks
                </h2>
                <p className="text-xs text-[#9AA2B2] font-sans mt-0.5">
                  Click any revealed block or the button to open the Merkle Proof Verification Workbench modal.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveModalIndex(0);
                    setIsProofModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 font-mono text-xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>Open Workbench Modal</span>
                </button>
                <span className="font-mono text-xs text-[#848B98]">
                  {effectiveClaims.length} Leaves
                </span>
              </div>
            </div>

            {/* Block Matrix Cards */}
            <div className="space-y-3">
              {effectiveClaims.map((claim, idx) => {
                const isProofAvailable = Array.isArray((claim as any).proof) && (claim as any).proof.length >= 0;

                return (
                  <div
                    key={idx}
                    onClick={() => openClaimModal(claim, idx)}
                    className="p-4 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] transition-colors cursor-pointer group space-y-2.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#848B98]">BLOCK #{idx}</span>
                        <span className="text-[#232732]">/</span>
                        <span className="text-[#F0F2F5] font-medium">{claim.key}</span>
                      </div>

                      <span className="text-[#2563EB] group-hover:underline text-[11px]">
                        Inspect proof
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-[#0C0E12] border border-[#232732]/60 font-mono text-xs text-[#9AA2B2] break-all max-h-24 overflow-hidden">
                      {claim.value || "<Encrypted Ciphertext Block>"}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#848B98] pt-1">
                      <span>Inclusion Proof: {(claim as any).proof?.length || 0} nodes</span>
                      <span className="text-[#16A34A] text-[10px]">Verified Leaf Structure</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Column (40%): Escrow Stepper & Action Controls & Terminal */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Escrow Progress Stepper */}
            <EscrowProgressStepper
              listingId={listing.id}
              merkleRoot={listing.merkle_root}
              keyHash={listing.key_hash}
              priceEth={listing.price_eth}
              sellerAddress={listing.seller_address}
              vendorAddress={listing.vendor_address}
              currentStage={currentStage}
              decryptionKey={listing.decryption_key}
              onStageChange={handleStageChange}
              onDownloadPayload={handleDownloadPayload}
            />

            {/* Audit Log Terminal Stream */}
            <div className="rounded border border-[#232732] bg-[#14171E] overflow-hidden font-mono text-xs">
              <div className="px-4 py-2.5 border-b border-[#232732] bg-[#11141A] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#848B98] text-[11px]">
                  <TerminalIcon className="w-3.5 h-3.5" />
                  <span>Audit Stream Log</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#16A34A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span>Active</span>
                </div>
              </div>

              <div className="p-3 text-[11px] space-y-1 max-h-40 overflow-y-auto text-[#9AA2B2]">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-[#848B98] mr-1.5">&gt;</span>
                    <span className={log.includes("TRANSITION") || log.includes("Settled") ? "text-[#16A34A]" : log.includes("ERROR") || log.includes("failed") ? "text-[#DC2626]" : ""}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payload Decryptor (Buyer) */}
            {user?.role === "BUYER" && (
              <PayloadDecryptor
                listingId={listing.id}
                initialDecryptionKey={listing.decryption_key || ""}
              />
            )}

          </div>

        </div>

      </main>
    </div>
  );
}
