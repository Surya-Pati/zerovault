"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Users,
  RefreshCw,
  Layers
} from "lucide-react";
import {
  setKYCStatusOnChain,
  pauseContractOnChain,
  unpauseContractOnChain,
  getContractPausedState,
  formatContractError
} from "@/lib/contracts";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import AdminTelemetry from "@/components/admin/AdminTelemetry";
import CircuitBreakerBanner from "@/components/admin/CircuitBreakerBanner";
import BuyerKYCTable, { Buyer } from "@/components/admin/BuyerKYCTable";
import EscrowOversightTable, { ListingSummary } from "@/components/admin/EscrowOversightTable";

type TabType = "buyers" | "escrows";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("buyers");

  // Buyers state
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [buyerActionStates, setBuyerActionStates] = useState<
    Record<string, { loading: boolean; error?: string; success?: string }>
  >({});

  // Listings state
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Contract pause state
  const [contractPaused, setContractPaused] = useState<boolean>(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const fetchBuyersList = useCallback(async () => {
    setLoadingBuyers(true);
    try {
      const res = await fetchApi("/auth/buyers");
      if (res.ok) {
        const data = await res.json();
        setBuyers(data.buyers || []);
      }
    } catch {
      // Non-blocking error handling
    } finally {
      setLoadingBuyers(false);
    }
  }, []);

  const fetchListingsList = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await fetchApi("/listings");
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch {
      // Non-blocking error handling
    } finally {
      setLoadingListings(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchBuyersList();
    fetchListingsList();
    getContractPausedState().then(setContractPaused).catch(() => {});
  }, [fetchBuyersList, fetchListingsList]);

  // MetaMask Account Tracker with proper cleanup
  useEffect(() => {
    refreshAll();

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;

      eth
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setConnectedWallet(accounts[0]);
          }
        })
        .catch(() => {});

      const handleAccountsChanged = (accounts: string[]) => {
        setConnectedWallet(accounts?.[0] || null);
      };

      eth.on?.("accountsChanged", handleAccountsChanged);
      return () => {
        eth.removeListener?.("accountsChanged", handleAccountsChanged);
      };
    }
  }, [refreshAll]);

  const handleVerifyBuyer = async (buyerId: string, verify: boolean) => {
    setBuyerActionStates((prev) => ({
      ...prev,
      [buyerId]: { loading: true, error: undefined, success: undefined }
    }));

    try {
      const buyer = buyers.find((b) => b.id === buyerId);
      if (!buyer?.wallet_address) {
        throw new Error("Buyer wallet address not found");
      }

      await setKYCStatusOnChain(buyer.wallet_address, verify);

      try {
        await fetchApi(`/admin/buyers/${buyerId}/kyc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: verify })
        });
      } catch {
        // Direct DB sync warning (bridge reconciler will still sync)
      }

      setBuyers((prev) =>
        prev.map((b) => (b.id === buyerId ? { ...b, verified_buyer: verify } : b))
      );

      setBuyerActionStates((prev) => ({
        ...prev,
        [buyerId]: {
          loading: false,
          success: verify
            ? "KYC approved & synchronized on-chain"
            : "KYC authorization revoked on-chain"
        }
      }));

      setTimeout(() => {
        fetchBuyersList();
      }, 2500);
    } catch (err: any) {
      setBuyerActionStates((prev) => ({
        ...prev,
        [buyerId]: { loading: false, error: formatContractError(err) }
      }));
    }
  };

  const handleTogglePause = async () => {
    setPauseLoading(true);
    setPauseError(null);
    try {
      if (contractPaused) {
        await unpauseContractOnChain();
        setContractPaused(false);
      } else {
        await pauseContractOnChain();
        setContractPaused(true);
      }
    } catch (err: any) {
      setPauseError(formatContractError(err));
    } finally {
      setPauseLoading(false);
    }
  };

  const verifiedCount = useMemo(() => buyers.filter((b) => b.verified_buyer).length, [buyers]);

  // Auth Hydration Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 font-mono text-xs text-[#848B98]">
            <div className="w-6 h-6 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
            <span>Authenticating administrative credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  // Access Control Guard
  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <div className="w-full p-6 rounded border border-[#DC2626]/40 bg-[#170E10] space-y-4 text-center font-mono">
            <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#DC2626] uppercase">
                Restricted Action (Role: {user?.role || "GUEST"})
              </h2>
              <p className="text-xs text-[#848B98] font-sans leading-relaxed">
                The administrative console is reserved strictly for designated ZeroVault protocol administrators. On-chain governance transactions require contract ADMIN_ROLE privileges.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/listings"
                className="inline-block px-4 py-2 rounded bg-[#2563EB] text-white text-xs hover:bg-[#1D4ED8] transition-colors"
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232732] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] font-mono text-[11px] text-[#848B98] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>Institutional Protocol Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              Administrative Console
            </h1>
            <p className="text-xs text-[#9AA2B2] font-sans mt-1">
              Authorize institutional buyer KYC on-chain, operate emergency circuit breakers, and supervise protocol escrows.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              onClick={refreshAll}
              disabled={loadingBuyers || loadingListings}
              className="px-3.5 py-2 rounded border border-[#232732] bg-[#14171E] text-[#848B98] hover:text-[#F0F2F5] hover:border-[#3B4252] transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingBuyers || loadingListings ? "animate-spin text-[#2563EB]" : ""
                }`}
              />
              <span>Sync Protocol</span>
            </button>
            <Link
              href="/listings"
              className="px-4 py-2 rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors font-medium inline-flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Telemetry Strip */}
        <AdminTelemetry connectedWallet={connectedWallet} />

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Buyers & KYC */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#848B98] uppercase">Registered Buyers</span>
              <Users className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#F0F2F5]">{buyers.length}</span>
              <span className="text-xs font-mono text-[#848B98]">entities</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono pt-1 border-t border-[#232732]">
              <span className="text-[#16A34A]">{verifiedCount} KYC Approved</span>
              <span className="text-[#848B98]">•</span>
              <span className="text-[#D97706]">{buyers.length - verifiedCount} Pending</span>
            </div>
          </div>

          {/* Card 2: Circuit Breaker Status */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#848B98] uppercase">Circuit Breaker</span>
              {contractPaused ? (
                <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  contractPaused ? "bg-[#DC2626] animate-pulse" : "bg-[#16A34A]"
                }`}
              />
              <span
                className={`text-lg font-bold font-mono ${
                  contractPaused ? "text-[#DC2626]" : "text-[#16A34A]"
                }`}
              >
                {contractPaused ? "HALTED (PAUSED)" : "OPERATIONAL"}
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#848B98] pt-1 border-t border-[#232732]">
              {contractPaused
                ? "All escrow operations frozen on-chain"
                : "Escrows settle atomically on Sepolia"}
            </div>
          </div>

          {/* Card 3: Protocol Escrows */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#848B98] uppercase">Disclosures & Escrows</span>
              <Layers className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#F0F2F5]">{listings.length}</span>
              <span className="text-xs font-mono text-[#848B98]">disclosures</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono pt-1 border-t border-[#232732]">
              <span className="text-[#2563EB]">
                {listings.filter((l) => l.status === "COMMITTED" || l.status === "BOUNTY_LOCKED").length} Active
              </span>
              <span className="text-[#848B98]">•</span>
              <span className="text-[#16A34A]">
                {listings.filter((l) => l.status === "SETTLED").length} Settled
              </span>
            </div>
          </div>
        </div>

        {/* Circuit Breaker Emergency Control Banner */}
        <CircuitBreakerBanner
          contractPaused={contractPaused}
          pauseLoading={pauseLoading}
          pauseError={pauseError}
          onTogglePause={handleTogglePause}
        />

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-[#232732] pb-3 font-mono text-xs">
          <button
            onClick={() => setActiveTab("buyers")}
            className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
              activeTab === "buyers"
                ? "bg-[#2563EB] text-white font-medium"
                : "text-[#848B98] hover:text-[#F0F2F5] hover:bg-[#14171E]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Buyer KYC Management</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                activeTab === "buyers" ? "bg-white/20 text-white" : "bg-[#232732] text-[#848B98]"
              }`}
            >
              {buyers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("escrows")}
            className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
              activeTab === "escrows"
                ? "bg-[#2563EB] text-white font-medium"
                : "text-[#848B98] hover:text-[#F0F2F5] hover:bg-[#14171E]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Escrow Disclosures</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                activeTab === "escrows" ? "bg-white/20 text-white" : "bg-[#232732] text-[#848B98]"
              }`}
            >
              {listings.length}
            </span>
          </button>
        </div>

        {/* Active Tab Panel */}
        {activeTab === "buyers" && (
          <BuyerKYCTable
            buyers={buyers}
            loadingBuyers={loadingBuyers}
            buyerActionStates={buyerActionStates}
            onVerifyBuyer={handleVerifyBuyer}
          />
        )}

        {activeTab === "escrows" && (
          <EscrowOversightTable
            listings={listings}
            loadingListings={loadingListings}
          />
        )}
      </main>
    </div>
  );
}
