"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  ShieldAlert,
  FileText,
  DollarSign,
  Tag,
  Shield,
  UploadCloud,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
  Check
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { createMerkleTree, getInclusionProof } from "@zerovault/shared/dist/merkle";
import { encryptPayload } from "@zerovault/shared/dist/crypto";
import { computeKeyHash } from "@/lib/contracts";
import { useAuth } from "@/providers/AuthProvider";

export default function SubmitListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buyers, setBuyers] = useState<{ id: string; profile_name: string }[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    severity: "MEDIUM",
    priceEth: "",
    vendor_id: "",
  });

  const [blocks, setBlocks] = useState<{ content: string; reveal: boolean }[]>([
    { content: "", reveal: false }
  ]);

  const [successData, setSuccessData] = useState<{
    listingId: string;
    decryptionKey: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchApi('/auth/buyers')
      .then((res) => res.json())
      .then((data) => setBuyers(data.buyers || []))
      .catch((err) => console.error("Failed to fetch buyers", err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addBlock = () => setBlocks([...blocks, { content: "", reveal: false }]);
  const removeBlock = (index: number) => setBlocks(blocks.filter((_, i) => i !== index));
  const updateBlock = (index: number, content: string) => {
    const newBlocks = [...blocks];
    newBlocks[index].content = content;
    setBlocks(newBlocks);
  };
  const toggleReveal = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks[index].reveal = !newBlocks[index].reveal;
    setBlocks(newBlocks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (
      !formData.title ||
      !formData.category ||
      !formData.severity ||
      !formData.priceEth ||
      !formData.vendor_id ||
      blocks.some((b) => !b.content.trim())
    ) {
      setError("Please fill out all specification fields and code blocks.");
      setLoading(false);
      return;
    }

    try {
      // 1. Build claims object for Merkle Tree
      const claimsObj: Record<string, string> = {
        title: formData.title,
        category: formData.category,
        severity: formData.severity,
      };
      
      blocks.forEach((block, idx) => {
        claimsObj[`block_${idx}`] = block.content.trim();
      });

      // 2. Generate Merkle Tree locally
      const merkleResult = createMerkleTree(claimsObj);

      // 3. Prepare payload for client-side encryption
      const rawPayload = JSON.stringify(claimsObj);

      // 4. Client-side AES-256-GCM encryption
      const encrypted = await encryptPayload(rawPayload);
      const keyHash = computeKeyHash(encrypted.key);

      // 5. Build revealed claims with inclusion proofs
      const revealedClaimsArr: { key: string; value: string; proof: string[]; salt?: string; revealed?: boolean }[] = [];
      
      ['title', 'category', 'severity'].forEach((metaKey) => {
        const leafIndex = merkleResult.leaves.findIndex((l) => l.key === metaKey);
        if (leafIndex !== -1) {
          const inclusion = getInclusionProof(merkleResult, leafIndex);
          revealedClaimsArr.push({
            key: inclusion.claim.key,
            value: inclusion.claim.value,
            proof: inclusion.proof,
            ...(inclusion.claim.salt ? { salt: inclusion.claim.salt } : {}),
            revealed: true,
          });
        }
      });

      blocks.forEach((block, idx) => {
        if (block.reveal) {
          const key = `block_${idx}`;
          const leafIndex = merkleResult.leaves.findIndex((l) => l.key === key);
          if (leafIndex !== -1) {
            const inclusion = getInclusionProof(merkleResult, leafIndex);
            revealedClaimsArr.push({
              key: inclusion.claim.key,
              value: inclusion.claim.value,
              proof: inclusion.proof,
              ...(inclusion.claim.salt ? { salt: inclusion.claim.salt } : {}),
              revealed: true,
            });
          }
        }
      });

      const priceWei = (parseFloat(formData.priceEth) * 1e18).toString();

      // 6. Send ONLY ciphertext and revealed claims to backend
      const response = await fetchApi(`/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          severity: formData.severity,
          price_wei: priceWei,
          vendor_id: formData.vendor_id,
          claims: revealedClaimsArr,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          keyHash: keyHash,
          merkleRoot: merkleResult.root,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create listing.");
      }

      setSuccessData({
        listingId: data.listing.id,
        decryptionKey: encrypted.key,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === "BUYER") {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-16 text-center space-y-4 font-mono">
          <div className="p-6 rounded border border-[#232732] bg-[#14171E] space-y-3">
            <h2 className="text-sm font-semibold text-[#DC2626]">
              Restricted Action (Role: BUYER)
            </h2>
            <p className="text-xs text-[#848B98] font-sans">
              Buyer accounts evaluate and fund vulnerability bounties. Only researcher accounts can submit new disclosures.
            </p>
            <div className="pt-2">
              <Link
                href="/listings"
                className="inline-block px-4 py-2 rounded bg-[#2563EB] text-white text-xs font-mono hover:bg-[#1D4ED8] transition-colors"
              >
                Return to Marketplace
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Breadcrumb */}
        <div className="border-b border-[#232732] pb-4 font-mono text-xs flex items-center justify-between">
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 text-[#848B98] hover:text-[#F0F2F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Marketplace</span>
            <span className="text-[#232732]">/</span>
            <span className="text-[#F0F2F5]">New Disclosure Specification</span>
          </Link>
          <span className="text-[11px] text-[#848B98]">
            Client-Side AES-256-GCM + Merkle Tree
          </span>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="p-6 rounded border border-[#16A34A]/40 bg-[#0F1A14] space-y-6 font-mono">
            <div className="flex items-center gap-3 text-[#16A34A]">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#F0F2F5]">
                  Vulnerability Encrypted & Listed Successfully
                </h2>
                <p className="text-xs text-[#848B98] font-sans mt-0.5">
                  Payload ciphertext and Merkle root have been registered. Next, commit the root on-chain from the listing detail page.
                </p>
              </div>
            </div>

            {/* Crucial Key Backup Warning */}
            <div className="p-4 rounded border border-[#D97706]/40 bg-[#17130B] space-y-2">
              <div className="flex items-center gap-2 text-[#D97706] text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>SAVE YOUR AES-256 DECRYPTION KEY</span>
              </div>
              <p className="text-[11px] text-[#848B98] font-sans leading-relaxed">
                This key was generated in your browser memory. ZeroVault does not store this key on any server. You must provide this exact key to reveal and claim your bounty once the buyer deposits ETH.
              </p>
              
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] text-xs font-mono break-all select-all">
                  {successData.decryptionKey}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successData.decryptionKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-3 py-2 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] text-[#848B98] hover:text-[#F0F2F5] text-xs font-mono transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy key"}</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/listings/${successData.listingId}`}
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-semibold transition-colors"
              >
                Proceed to listing detail & on-chain commitment
              </Link>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header Description */}
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
                Submit Vulnerability Specification
              </h1>
              <p className="text-xs text-[#848B98] font-sans">
                Structure your vulnerability into discrete payload blocks. Select specific blocks for public cryptographic inclusion proofs; all other blocks remain strictly encrypted until on-chain settlement.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#DC2626] font-mono text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Specification Metadata Card */}
            <div className="p-5 rounded border border-[#232732] bg-[#14171E] space-y-4">
              <h2 className="text-xs font-mono font-semibold text-[#848B98] uppercase tracking-wider">
                [01] Vulnerability Metadata
              </h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-mono text-[#848B98]">
                    Vulnerability Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. Memory Corruption in Consensus Engine RPC Handler"
                    className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB] placeholder:text-[#848B98]/50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-[#848B98]">
                      Category / Architecture
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      placeholder="e.g. Protocol Daemon, Smart Contract, Network"
                      className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB] placeholder:text-[#848B98]/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-[#848B98]">
                      Severity Classification
                    </label>
                    <select
                      name="severity"
                      value={formData.severity}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="CRITICAL">CRITICAL // CVSS 9.0-10.0</option>
                      <option value="HIGH">HIGH // CVSS 7.0-8.9</option>
                      <option value="MEDIUM">MEDIUM // CVSS 4.0-6.9</option>
                      <option value="LOW">LOW // CVSS 0.1-3.9</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-[#848B98]">
                      Escrow Bounty Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="priceEth"
                      value={formData.priceEth}
                      onChange={handleChange}
                      placeholder="e.g. 1.5"
                      className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB] placeholder:text-[#848B98]/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-[#848B98]">
                      Target Vendor / Verified Buyer
                    </label>
                    <select
                      name="vendor_id"
                      value={formData.vendor_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] font-mono text-xs focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="" disabled>Select target buyer...</option>
                      {buyers.map((buyer) => (
                        <option key={buyer.id} value={buyer.id}>
                          @{buyer.profile_name || "Unknown"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Exploit Payload Blocks & Disclosure Matrix */}
            <div className="p-5 rounded border border-[#232732] bg-[#14171E] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-mono font-semibold text-[#848B98] uppercase tracking-wider">
                    [02] Payload Blocks & Partial Disclosure Matrix
                  </h2>
                  <p className="text-[11px] text-[#848B98] font-sans mt-0.5">
                    Toggle "Reveal as Proof" to provide verifiable Merkle leaves before payment. Unrevealed blocks remain AES-encrypted ciphertext.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBlock}
                  className="px-2.5 py-1 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#3B4252] text-[#F0F2F5] font-mono text-xs transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add block</span>
                </button>
              </div>

              <div className="space-y-3">
                {blocks.map((block, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-[#232732] bg-[#0C0E12] overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-[#232732] bg-[#11141A] flex items-center justify-between font-mono text-xs">
                      <span className="text-[#848B98]">BLOCK #{idx}</span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleReveal(idx)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${
                            block.reveal
                              ? "border border-[#16A34A]/50 bg-[#0F1A14] text-[#16A34A]"
                              : "border border-[#232732] bg-[#14171E] text-[#848B98]"
                          }`}
                        >
                          {block.reveal ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{block.reveal ? "Revealed proof" : "Encrypted leaf"}</span>
                        </button>

                        {blocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBlock(idx)}
                            className="p-1 text-[#848B98] hover:text-[#DC2626] transition-colors"
                            title="Remove block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={block.content}
                      onChange={(e) => updateBlock(idx, e.target.value)}
                      placeholder="Paste exploit logic, PoC script, memory dump, or stack trace block..."
                      className="w-full min-h-[90px] p-3 bg-transparent text-xs font-mono text-[#F0F2F5] placeholder:text-[#848B98]/40 focus:outline-none resize-y"
                    />
                  </div>
                ))}
              </div>

            </div>

            {/* Submission CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Encrypting payload & generating Merkle tree...</span>
                  </>
                ) : (
                  <span>Submit disclosure specification</span>
                )}
              </button>
            </div>

          </form>
        )}

      </main>
    </div>
  );
}
