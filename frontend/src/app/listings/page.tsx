"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  Search,
  Layers,
  Shield,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  RefreshCw,
  Coins
} from "lucide-react";
import { formatEther } from "ethers";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface ListingItem {
  id: string;
  title: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  merkle_root: string;
  price_wei?: string;
  status: string;
  seller_address?: string;
  vendor_address?: string;
  seller?: { profile_name?: string };
  vendor?: { profile_name?: string };
  created_at: string;
}

export default function ListingsBrowsePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadListings = async () => {
    setLoading(true);
    try {
      const res = await fetchApi("/listings");
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch {
      // Non-blocking error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const formatEthPrice = (priceWei?: string): string => {
    if (!priceWei) return "0.00";
    try {
      const ethString = formatEther(BigInt(priceWei));
      const num = parseFloat(ethString);
      if (num > 0 && num < 0.01) {
        return ethString; // Preserve exact 0.001 ETH
      }
      return num.toFixed(2);
    } catch {
      return "0.00";
    }
  };

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      if (item.status === "EXPIRED" || item.status === "REFUNDED") return false;
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.category?.toLowerCase().includes(search.toLowerCase()) ||
        item.merkle_root?.toLowerCase().includes(search.toLowerCase());
      const matchesSeverity =
        selectedSeverity === "ALL" || item.severity === selectedSeverity;
      const matchesStatus =
        selectedStatus === "ALL" || item.status === selectedStatus;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [listings, search, selectedSeverity, selectedStatus]);

  // Protocol Metrics
  const activeCount = useMemo(
    () => listings.filter((l) => l.status === "COMMITTED" || l.status === "BOUNTY_LOCKED").length,
    [listings]
  );
  const settledCount = useMemo(
    () => listings.filter((l) => l.status === "SETTLED").length,
    [listings]
  );
  const totalVolumeEth = useMemo(() => {
    let sumWei = BigInt(0);
    listings
      .filter((l) => l.status === "SETTLED" && l.price_wei)
      .forEach((l) => {
        try {
          sumWei += BigInt(l.price_wei!);
        } catch {}
      });
    return parseFloat(formatEther(sumWei)).toFixed(2);
  }, [listings]);

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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]">
            <CheckCircle2 className="w-3 h-3" />
            <span>SETTLED</span>
          </span>
        );
      case "BOUNTY_LOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#CA8A04]/40 bg-[#1A1608] text-[#EAB308]">
            <Lock className="w-3 h-3" />
            <span>BOUNTY LOCKED</span>
          </span>
        );
      case "COMMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#2563EB]/40 bg-[#0E1526] text-[#60A5FA]">
            <ShieldCheck className="w-3 h-3" />
            <span>COMMITTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#232732] bg-[#0C0E12] text-[#848B98]">
            <Clock className="w-3 h-3" />
            <span>{status || "CREATED"}</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232732] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] font-mono text-[11px] text-[#848B98] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>Verifiable Zero-Day Disclosures</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              Marketplace Disclosures
            </h1>
            <p className="text-xs text-[#9AA2B2] font-sans mt-1">
              Verify cryptographic Merkle inclusion proofs off-chain, lock bounties in smart contract escrow, and inspect live vulnerability commitments.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              onClick={loadListings}
              disabled={loading}
              className="px-3.5 py-2 rounded border border-[#232732] bg-[#14171E] text-[#848B98] hover:text-[#F0F2F5] hover:border-[#3B4252] transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2563EB]" : ""}`} />
              <span>Refresh</span>
            </button>
            {user?.role !== "BUYER" && (
              <Link
                href="/submit"
                className="px-4 py-2 rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors font-medium inline-flex items-center gap-2"
              >
                <span>Submit disclosure</span>
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

        {/* 4-Card Protocol Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
          <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-1">
            <div className="flex items-center justify-between text-[#848B98] text-xs">
              <span>TOTAL DISCLOSURES</span>
              <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
            </div>
            <div className="text-xl font-bold text-[#F0F2F5]">{listings.length}</div>
            <div className="text-[10px] text-[#848B98]">registered on protocol</div>
          </div>

          <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-1">
            <div className="flex items-center justify-between text-[#848B98] text-xs">
              <span>ACTIVE ESCROWS</span>
              <Shield className="w-3.5 h-3.5 text-[#3B82F6]" />
            </div>
            <div className="text-xl font-bold text-[#60A5FA]">{activeCount}</div>
            <div className="text-[10px] text-[#848B98]">committed & locked</div>
          </div>

          <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-1">
            <div className="flex items-center justify-between text-[#848B98] text-xs">
              <span>SETTLED DISCLOSURES</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            </div>
            <div className="text-xl font-bold text-[#16A34A]">{settledCount}</div>
            <div className="text-[10px] text-[#848B98]">atomic settlements</div>
          </div>

          <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-1">
            <div className="flex items-center justify-between text-[#848B98] text-xs">
              <span>SETTLED VOLUME</span>
              <Coins className="w-3.5 h-3.5 text-[#EAB308]" />
            </div>
            <div className="text-xl font-bold text-[#F0F2F5]">{totalVolumeEth} ETH</div>
            <div className="text-[10px] text-[#848B98]">transferred to researchers</div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#848B98] absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search disclosures by title, category, or Merkle root..."
                aria-label="Search disclosures by title, category, or Merkle root"
                className="w-full pl-9 pr-4 py-2 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] placeholder:text-[#848B98] text-xs font-mono focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1 border border-[#232732] rounded bg-[#14171E] p-1 font-mono text-xs overflow-x-auto">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-3 py-1 rounded text-[11px] transition-colors shrink-0 ${
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

          {/* Secondary Lifecycle Status Filters */}
          <div className="flex items-center gap-2 font-mono text-xs text-[#848B98] overflow-x-auto pb-1">
            <span className="text-[10px] uppercase">Stage:</span>
            {["ALL", "COMMITTED", "BOUNTY_LOCKED", "SETTLED"].map((stage) => (
              <button
                key={stage}
                onClick={() => setSelectedStatus(stage)}
                className={`px-2.5 py-0.5 rounded text-[11px] border transition-colors shrink-0 ${
                  selectedStatus === stage
                    ? "border-[#2563EB] bg-[#0E1526] text-[#60A5FA]"
                    : "border-[#232732] bg-[#0C0E12] hover:border-[#3B4252] text-[#848B98]"
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Ledger */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center font-mono text-xs text-[#848B98] border border-[#232732] rounded bg-[#14171E] space-y-3">
              <div className="w-6 h-6 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin mx-auto" />
              <p>Loading active escrows from ZeroVault registry...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center border border-[#232732] rounded bg-[#14171E] space-y-3 font-mono">
              <Layers className="w-8 h-8 text-[#848B98] mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-[#F0F2F5]">No matching disclosures</h3>
              <p className="text-xs text-[#848B98] font-sans">
                {search || selectedSeverity !== "ALL" || selectedStatus !== "ALL"
                  ? "Try resetting your search filters."
                  : "No vulnerability escrows are currently active on this network."}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const priceEth = formatEthPrice(item.price_wei);
              const severityBorder = getSeverityBorderColor(item.severity);
              const severityText = getSeverityTextColor(item.severity);

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] transition-colors border-l-4 ${severityBorder} flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  {/* Left: Metadata & Titles */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
                      <span className={`font-semibold ${severityText}`}>
                        {item.severity} {"// CVSS"}
                      </span>
                      <span className="text-[#232732]">|</span>
                      <span className="text-[#848B98]">{item.category}</span>
                      <span className="text-[#232732]">|</span>
                      {renderStatusBadge(item.status)}
                      <span className="text-[#232732]">|</span>
                      <span className="text-[#848B98]">
                        ID: #{item.id.slice(0, 8)}
                      </span>
                    </div>

                    <h2 className="text-base font-semibold text-[#F0F2F5] font-sans truncate">
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
                      className="px-4 py-1.5 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] hover:text-white text-[#F0F2F5] transition-colors font-mono text-xs shrink-0"
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
