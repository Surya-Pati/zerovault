"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Search, Filter, Layers, Shield } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export default function ListingsBrowsePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function loadListings() {
      try {
        const res = await fetchApi(`/listings`);
        if (res.ok) {
          const data = await res.json();
          setListings(data.listings || []);
        }
      } catch (err) {
        console.error("Failed to load listings", err);
      } finally {
        setLoading(false);
      }
    }
    loadListings();
  }, []);

  const filtered = listings.filter((item) => {
    if (item.status === "EXPIRED" || item.status === "REFUNDED") return false;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase()) ||
      item.merkle_root?.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = selectedSeverity === "ALL" || item.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityBorderColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "border-l-[#DC2626]";
      case "HIGH":
        return "border-l-[#EA580C]";
      case "MEDIUM":
        return "border-l-[#CA8A04]";
      default:
        return "border-l-[#2563EB]";
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "text-[#DC2626]";
      case "HIGH":
        return "text-[#EA580C]";
      case "MEDIUM":
        return "text-[#CA8A04]";
      default:
        return "text-[#2563EB]";
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232732] pb-6">
          <div>
            <span className="text-[11px] font-mono text-[#848B98] uppercase tracking-wider block">
              Vulnerability Marketplace
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F0F2F5] font-sans mt-0.5">
              Active Escrow Disclosures
            </h1>
            <p className="text-xs text-[#9AA2B2] font-sans mt-1">
              Verifiable zero-day disclosures secured by Merkle inclusion proofs and smart contract escrow.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            {user?.role !== "BUYER" && (
              <Link
                href="/submit"
                className="px-4 py-2 rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors font-medium"
              >
                Submit disclosure
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] hover:border-[#3B4252] transition-colors"
              >
                Admin console
              </Link>
            )}
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#848B98] absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search disclosures by title, category, or Merkle root..."
              className="w-full pl-9 pr-4 py-2 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] placeholder:text-[#848B98] text-xs font-mono focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-1 border border-[#232732] rounded bg-[#14171E] p-1 font-mono text-xs">
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-3 py-1 rounded text-[11px] transition-colors ${
                  selectedSeverity === sev
                    ? "bg-[#2563EB] text-white font-medium"
                    : "text-[#848B98] hover:text-[#F0F2F5]"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Ledger */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center font-mono text-xs text-[#848B98] border border-[#232732] rounded bg-[#14171E]">
              Loading active escrows from ZeroVault registry...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center border border-[#232732] rounded bg-[#14171E] space-y-3">
              <span className="text-xs font-mono text-[#848B98]">No disclosures match your search criteria.</span>
            </div>
          ) : (
            filtered.map((item) => {
              const priceEth = item.price_wei ? (Number(item.price_wei) / 1e18).toFixed(2) : "0.00";
              const severityBorder = getSeverityBorderColor(item.severity);
              const severityText = getSeverityTextColor(item.severity);

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] transition-colors border-l-4 ${severityBorder} flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  {/* Left: Metadata & Titles */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className={`font-semibold ${severityText}`}>
                        {item.severity} // CVSS
                      </span>
                      <span className="text-[#232732]">|</span>
                      <span className="text-[#848B98]">{item.category}</span>
                      <span className="text-[#232732]">|</span>
                      <span className="text-[#848B98]">
                        ID: #{item.id.slice(0, 8)}
                      </span>
                    </div>

                    <h2 className="text-base font-semibold text-[#F0F2F5] font-sans">
                      {item.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#848B98]">
                      <span>
                        Root: <span className="text-[#9AA2B2]">{item.merkle_root.slice(0, 16)}...</span>
                      </span>
                      <span>•</span>
                      <span>
                        Seller: {item.seller?.profile_name ? `@${item.seller.profile_name}` : `${item.seller_address?.slice(0, 6)}...${item.seller_address?.slice(-4)}`}
                      </span>
                      <span>•</span>
                      <span>
                        Target: {item.vendor?.profile_name ? `@${item.vendor.profile_name}` : item.vendor_address ? `${item.vendor_address.slice(0, 6)}...` : "Open"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Bounty & Action */}
                  <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0 border-t md:border-t-0 border-[#232732] pt-3 md:pt-0">
                    <div className="font-mono text-right">
                      <span className="text-base font-bold text-[#F0F2F5] block">
                        {priceEth} ETH
                      </span>
                      <span className="text-[10px] text-[#848B98] block">
                        Escrow Bounty
                      </span>
                    </div>

                    <Link
                      href={`/listings/${item.id}`}
                      className="px-4 py-1.5 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] hover:text-white text-[#F0F2F5] transition-colors font-mono text-xs"
                    >
                      Inspect disclosure
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
}
