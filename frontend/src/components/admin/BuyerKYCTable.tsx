"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  X,
  XCircle
} from "lucide-react";

export interface Buyer {
  id: string;
  profile_name: string;
  wallet_address: string;
  verified_buyer: boolean;
  role?: string;
  created_at?: string;
}

interface BuyerKYCTableProps {
  buyers: Buyer[];
  loadingBuyers: boolean;
  buyerActionStates: Record<string, { loading: boolean; error?: string; success?: string }>;
  onVerifyBuyer: (buyerId: string, verify: boolean) => Promise<void>;
}

export default function BuyerKYCTable({
  buyers,
  loadingBuyers,
  buyerActionStates,
  onVerifyBuyer
}: BuyerKYCTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "VERIFIED" | "PENDING">("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyAddress = async (address: string, id: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard write failed or denied
    }
  };

  const filteredBuyers = useMemo(() => {
    return buyers.filter((b) => {
      const matchesSearch =
        b.profile_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.wallet_address?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "ALL" ||
        (filter === "VERIFIED" && b.verified_buyer) ||
        (filter === "PENDING" && !b.verified_buyer);
      return matchesSearch && matchesFilter;
    });
  }, [buyers, search, filter]);

  if (loadingBuyers) {
    return (
      <div className="rounded border border-[#232732] bg-[#14171E] p-12 text-center space-y-3 font-mono text-xs">
        <div className="w-6 h-6 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin mx-auto" />
        <p className="text-[#848B98]">Synchronizing registered buyers from database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#848B98] absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter buyers by profile name or Ethereum wallet address..."
            className="w-full pl-9 pr-4 py-2 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] placeholder:text-[#848B98] text-xs font-mono focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="flex items-center gap-1 border border-[#232732] rounded bg-[#14171E] p-1 font-mono text-xs">
          {(["ALL", "VERIFIED", "PENDING"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 rounded text-[11px] transition-colors ${
                filter === mode
                  ? "bg-[#2563EB] text-white font-medium"
                  : "text-[#848B98] hover:text-[#F0F2F5]"
              }`}
            >
              {mode === "ALL" ? "All Buyers" : mode === "VERIFIED" ? "KYC Approved" : "Pending KYC"}
            </button>
          ))}
        </div>
      </div>

      {filteredBuyers.length === 0 ? (
        <div className="rounded border border-[#232732] bg-[#14171E] p-12 text-center space-y-2 font-mono">
          <Users className="w-8 h-8 text-[#848B98] mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-[#F0F2F5]">No matching buyers found</h3>
          <p className="text-xs text-[#848B98] font-sans">
            {search
              ? "Try adjusting your search query."
              : "No institutional buyers have registered with this filter state."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBuyers.map((buyer) => {
            const state = buyerActionStates[buyer.id];
            return (
              <div
                key={buyer.id}
                className="rounded border border-[#232732] bg-[#14171E] p-4 hover:border-[#3B4252] transition-colors space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Identity Info */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded border border-[#232732] bg-[#0C0E12] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-[#2563EB]" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-[#F0F2F5] font-sans truncate">
                          {buyer.profile_name}
                        </span>

                        {buyer.verified_buyer ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>KYC VERIFIED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#848B98]/40 bg-[#0C0E12] text-[#848B98]">
                            <Clock className="w-3 h-3 text-[#D97706]" />
                            <span>UNVERIFIED</span>
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-[#848B98] border border-[#232732] px-1.5 py-0.5 rounded bg-[#0C0E12]">
                          ID: {buyer.id.slice(0, 8)}
                        </span>
                      </div>

                      {/* Wallet Address */}
                      <div className="flex items-center gap-2 text-xs font-mono text-[#848B98]">
                        <span className="text-[10px] uppercase text-[#848B98]/70">Wallet:</span>
                        <span className="text-[#9AA2B2] truncate select-all">
                          {buyer.wallet_address}
                        </span>
                        <button
                          onClick={() => copyAddress(buyer.wallet_address, buyer.id)}
                          title="Copy wallet address"
                          className="text-[#848B98] hover:text-[#F0F2F5] transition-colors shrink-0"
                        >
                          {copiedKey === buyer.id ? (
                            <Check className="w-3 h-3 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`https://sepolia.etherscan.io/address/${buyer.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Sepolia Etherscan"
                          className="text-[#848B98] hover:text-[#2563EB] transition-colors shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {!buyer.verified_buyer ? (
                      <button
                        onClick={() => onVerifyBuyer(buyer.id, true)}
                        disabled={state?.loading}
                        className="px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state?.loading ? (
                          <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>Authorize KYC</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onVerifyBuyer(buyer.id, false)}
                        disabled={state?.loading}
                        className="px-4 py-2 rounded border border-[#DC2626]/40 bg-[#170E10] hover:bg-[#DC2626]/20 text-[#DC2626] font-mono text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state?.loading ? (
                          <span className="w-3 h-3 rounded-full border-2 border-[#DC2626] border-t-transparent animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        <span>Revoke KYC</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Notice */}
                {state?.error && (
                  <div className="p-2.5 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#DC2626] font-mono text-[11px] flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{state.error}</span>
                  </div>
                )}
                {state?.success && (
                  <div className="p-2.5 rounded border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A] font-mono text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{state.success}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
