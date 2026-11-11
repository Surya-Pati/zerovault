"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { formatEther } from "ethers";
import { Layers, Search, Check, Copy, ExternalLink } from "lucide-react";

export interface ListingSummary {
  id: string;
  title: string;
  category?: string;
  severity?: string;
  merkle_root: string;
  price_wei?: string;
  status: string;
  seller_address?: string;
  vendor_address?: string;
  created_at?: string;
}

interface EscrowOversightTableProps {
  listings: ListingSummary[];
  loadingListings: boolean;
}

export default function EscrowOversightTable({
  listings,
  loadingListings
}: EscrowOversightTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyRoot = async (root: string, id: string) => {
    try {
      await navigator.clipboard.writeText(root);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard write failed or denied
    }
  };

  const formatPrice = (priceWei?: string): string => {
    if (!priceWei) return "0";
    try {
      return formatEther(BigInt(priceWei));
    } catch {
      return "0";
    }
  };

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      const matchesSearch =
        l.title?.toLowerCase().includes(search.toLowerCase()) ||
        l.merkle_root?.toLowerCase().includes(search.toLowerCase()) ||
        l.category?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "ALL" || l.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [listings, search, filter]);

  if (loadingListings) {
    return (
      <div className="rounded border border-[#232732] bg-[#14171E] p-12 text-center space-y-3 font-mono text-xs">
        <div className="w-6 h-6 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin mx-auto" />
        <p className="text-[#848B98]">Synchronizing protocol escrows...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#848B98] absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter escrows by title, category, or Merkle root..."
            className="w-full pl-9 pr-4 py-2 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] placeholder:text-[#848B98] text-xs font-mono focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="flex items-center gap-1 border border-[#232732] rounded bg-[#14171E] p-1 font-mono text-xs">
          {["ALL", "CREATED", "COMMITTED", "BOUNTY_LOCKED", "SETTLED"].map((stage) => (
            <button
              key={stage}
              onClick={() => setFilter(stage)}
              className={`px-3 py-1 rounded text-[11px] transition-colors ${
                filter === stage
                  ? "bg-[#2563EB] text-white font-medium"
                  : "text-[#848B98] hover:text-[#F0F2F5]"
              }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div className="rounded border border-[#232732] bg-[#14171E] p-12 text-center space-y-2 font-mono">
          <Layers className="w-8 h-8 text-[#848B98] mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-[#F0F2F5]">No matching escrows found</h3>
          <p className="text-xs text-[#848B98] font-sans">
            No disclosures match your query or filter stage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredListings.map((listing) => {
            const priceEth = formatPrice(listing.price_wei);

            return (
              <div
                key={listing.id}
                className="rounded border border-[#232732] bg-[#14171E] p-4 hover:border-[#3B4252] transition-colors space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#F0F2F5] font-sans truncate">
                        {listing.title}
                      </span>

                      {/* Lifecycle Stage Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          listing.status === "SETTLED"
                            ? "border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]"
                            : listing.status === "BOUNTY_LOCKED"
                            ? "border-[#D97706]/40 bg-[#17130B] text-[#D97706]"
                            : listing.status === "COMMITTED"
                            ? "border-[#2563EB]/40 bg-[#101726] text-[#2563EB]"
                            : "border-[#848B98]/40 bg-[#0C0E12] text-[#848B98]"
                        }`}
                      >
                        {listing.status}
                      </span>

                      {listing.severity && (
                        <span className="text-[10px] font-mono border border-[#232732] px-1.5 py-0.5 rounded bg-[#0C0E12] text-[#848B98]">
                          {listing.severity}
                        </span>
                      )}
                    </div>

                    {/* Merkle Root & Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-[#848B98]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] uppercase text-[#848B98]/70">Root:</span>
                        <span className="text-[#9AA2B2] truncate select-all">
                          {listing.merkle_root}
                        </span>
                        <button
                          onClick={() => copyRoot(listing.merkle_root, listing.id)}
                          title="Copy Merkle root"
                          className="text-[#848B98] hover:text-[#F0F2F5] transition-colors shrink-0"
                        >
                          {copiedKey === listing.id ? (
                            <Check className="w-3 h-3 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-[#848B98]/70">Asking Price:</span>
                        <span className="text-[#F0F2F5] font-semibold">{priceEth} ETH</span>
                        {listing.category && (
                          <>
                            <span className="text-[#232732]">•</span>
                            <span className="text-[#848B98] truncate">{listing.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* View Action Link */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="px-4 py-2 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#3B4252] text-[#F0F2F5] font-mono text-xs transition-colors inline-flex items-center gap-2"
                    >
                      <span>Inspect Escrow</span>
                      <ExternalLink className="w-3 h-3 text-[#848B98]" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
