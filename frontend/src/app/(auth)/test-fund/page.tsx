"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  Terminal,
  Droplet,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { BrowserProvider, formatEther } from "ethers";
import { useAuth } from "@/providers/AuthProvider";
import {
  DEFAULT_ZEROVAULT_ADDRESS,
  DEFAULT_RPC_URL,
  EXPECTED_NETWORK_NAME,
  EXPECTED_CHAIN_ID
} from "@/lib/contracts";

export default function TestFundPage() {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [switchingNetwork, setSwitchingNetwork] = useState<boolean>(false);
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Non-blocking clipboard fallback
    }
  };

  const queryWalletDetails = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts && accounts.length > 0) {
          const account = accounts[0];
          setConnectedAccount(account);
          const balance = await provider.getBalance(account);
          setWalletBalance(parseFloat(formatEther(balance)).toFixed(4));
        }
      } catch {
        // Fallback gracefully if wallet is locked
      }
    }
  }, []);

  useEffect(() => {
    queryWalletDetails();
  }, [queryWalletDetails]);

  const handleSwitchToSepolia = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    setSwitchingNetwork(true);
    setNetworkNotice(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }] // Sepolia 11155111
      });
      setNetworkNotice("Successfully switched to Ethereum Sepolia cluster.");
      await queryWalletDetails();
    } catch (err: unknown) {
      const errorObj = err as { code?: string | number; message?: string };
      if (errorObj?.code === 4902) {
        setNetworkNotice(
          "Sepolia network is not added to your MetaMask. Please enable testnets in MetaMask settings or add chain ID 11155111."
        );
      } else {
        setNetworkNotice(errorObj?.message || "Failed to switch network in wallet.");
      }
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const getClearanceTier = (role?: string, verified?: boolean) => {
    if (role === "ADMIN") return { label: "L3_PROTOCOL_ADMIN", color: "text-[#2563EB]" };
    if (role === "RESEARCHER") return { label: "L1_RESEARCHER_CLEARED", color: "text-[#3B82F6]" };
    if (role === "BUYER" && verified) return { label: "L2_BUYER_KYC_VERIFIED", color: "text-[#16A34A]" };
    if (role === "BUYER") return { label: "L0_BUYER_UNVERIFIED", color: "text-[#D97706]" };
    return { label: "L0_UNAUTHENTICATED", color: "text-[#848B98]" };
  };

  const clearance = getClearanceTier(user?.role, user?.verified_buyer);
  const explorerUrl = `https://sepolia.etherscan.io/address/${DEFAULT_ZEROVAULT_ADDRESS}`;

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232732] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] font-mono text-[11px] text-[#848B98] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Testnet Infrastructure & Diagnostics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              Protocol Faucet & Diagnostic Console
            </h1>
            <p className="text-xs text-[#9AA2B2] font-sans mt-1">
              Verify authenticated identity clearance, inspect connected wallet balances, and obtain Sepolia testnet ETH for bounty escrows.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              onClick={() => {
                refreshUser();
                queryWalletDetails();
              }}
              className="px-3.5 py-2 rounded border border-[#232732] bg-[#14171E] text-[#848B98] hover:text-[#F0F2F5] hover:border-[#3B4252] transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${authLoading ? "animate-spin text-[#2563EB]" : ""}`} />
              <span>Refresh State</span>
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

        {/* 4-Panel Diagnostic Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel 1: Session Clearance */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232732] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-[#F0F2F5] font-sans">
                  Identity & Session Clearance
                </h2>
              </div>
              <span className={`text-[10px] font-mono font-semibold ${clearance.color}`}>
                [{clearance.label}]
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                <span className="text-[10px] text-[#848B98] uppercase">Session Role</span>
                <div className="text-[#F0F2F5] font-semibold text-sm">
                  {user?.role || "GUEST"}
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                <span className="text-[10px] text-[#848B98] uppercase">KYC Verification</span>
                <div className="flex items-center gap-2 pt-0.5">
                  {user?.verified_buyer ? (
                    <span className="inline-flex items-center gap-1.5 text-[#16A34A] text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>KYC APPROVED</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#D97706] text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>PENDING VERIFICATION</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1 sm:col-span-2">
                <span className="text-[10px] text-[#848B98] uppercase">Connected MetaMask Account</span>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[#F0F2F5] truncate text-[11px]">
                    {connectedAccount || user?.wallet_address || "Wallet not detected"}
                  </span>
                  {(connectedAccount || user?.wallet_address) && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          connectedAccount || user?.wallet_address || "",
                          "session-wallet"
                        )
                      }
                      title="Copy wallet address"
                      aria-label="Copy wallet address"
                      className="text-[#848B98] hover:text-[#F0F2F5] transition-colors shrink-0"
                    >
                      {copiedKey === "session-wallet" ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1 sm:col-span-2">
                <span className="text-[10px] text-[#848B98] uppercase">Testnet Sepolia Balance</span>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-xl font-bold text-[#F0F2F5]">
                    {walletBalance !== null ? `${walletBalance} ETH` : "Querying..."}
                  </span>
                  <span className="text-[11px] text-[#848B98]">available for bounties/gas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Cluster & Contract Telemetry */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232732] pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-[#F0F2F5] font-sans">
                  Cluster & Contract Telemetry
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#16A34A]">
                CHAIN_ID: {EXPECTED_CHAIN_ID.toString()}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                <span className="text-[10px] text-[#848B98] uppercase">ZeroVault Contract v2</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#F0F2F5] truncate text-[11px]">
                    {DEFAULT_ZEROVAULT_ADDRESS}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(DEFAULT_ZEROVAULT_ADDRESS, "contract-diag")}
                      title="Copy contract address"
                      aria-label="Copy contract address"
                      className="text-[#848B98] hover:text-[#F0F2F5] transition-colors"
                    >
                      {copiedKey === "contract-diag" ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Sepolia Etherscan"
                      className="text-[#848B98] hover:text-[#2563EB] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                <span className="text-[10px] text-[#848B98] uppercase">Primary Network Target</span>
                <div className="text-[#F0F2F5] text-[11px] flex items-center justify-between">
                  <span>{EXPECTED_NETWORK_NAME}</span>
                  <span className="text-[#16A34A] text-[10px]">● RPC Online</span>
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                <span className="text-[10px] text-[#848B98] uppercase">Configured Gateway RPC</span>
                <div className="text-[#9AA2B2] text-[11px] truncate">
                  {DEFAULT_RPC_URL}
                </div>
              </div>

              {networkNotice && (
                <div className="p-2.5 rounded border border-[#2563EB]/40 bg-[#101726] text-[#60A5FA] text-[11px]">
                  {networkNotice}
                </div>
              )}

              <button
                type="button"
                onClick={handleSwitchToSepolia}
                disabled={switchingNetwork}
                className="w-full py-2.5 px-3 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] hover:text-white text-[#F0F2F5] text-xs transition-colors flex items-center justify-center gap-2"
              >
                {switchingNetwork ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Wallet className="w-3.5 h-3.5 text-[#2563EB]" />
                )}
                <span>Switch MetaMask Network to Sepolia</span>
              </button>
            </div>
          </div>

          {/* Panel 3: Curated Sepolia Faucet Directory */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#232732] pb-3">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-[#F0F2F5] font-sans">
                  Verified Sepolia Faucet Directory
                </h2>
              </div>
              <span className="text-xs font-mono text-[#848B98]">Free Testnet ETH</span>
            </div>

            <p className="text-xs text-[#848B98] font-sans">
              To lock bounties or commit vulnerability Merkle roots, your connected address requires Sepolia testnet ETH. Use any of the trusted faucets below:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
              {/* Google Cloud Faucet */}
              <a
                href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] transition-colors space-y-2 group block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F0F2F5] group-hover:text-[#2563EB] transition-colors">
                    Google Cloud Web3
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#848B98]" />
                </div>
                <div className="text-[11px] text-[#16A34A]">0.05 ETH / 24 hrs</div>
                <p className="text-[11px] text-[#848B98] font-sans">
                  Reliable official faucet. No social login required.
                </p>
              </a>

              {/* Alchemy Faucet */}
              <a
                href="https://www.alchemy.com/faucets/ethereum-sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] transition-colors space-y-2 group block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F0F2F5] group-hover:text-[#2563EB] transition-colors">
                    Alchemy Faucet
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#848B98]" />
                </div>
                <div className="text-[11px] text-[#16A34A]">0.1 ETH / day</div>
                <p className="text-[11px] text-[#848B98] font-sans">
                  Fast drip with free Alchemy developer account.
                </p>
              </a>

              {/* Infura Faucet */}
              <a
                href="https://www.infura.io/faucet/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] transition-colors space-y-2 group block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F0F2F5] group-hover:text-[#2563EB] transition-colors">
                    Infura Faucet
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#848B98]" />
                </div>
                <div className="text-[11px] text-[#16A34A]">0.5 ETH / day</div>
                <p className="text-[11px] text-[#848B98] font-sans">
                  High capacity testnet faucet powered by Consensys.
                </p>
              </a>

              {/* Sepolia PoW Mining Faucet */}
              <a
                href="https://sepolia-faucet.pk910.de/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#2563EB] transition-colors space-y-2 group block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F0F2F5] group-hover:text-[#2563EB] transition-colors">
                    Sepolia PoW Faucet
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#848B98]" />
                </div>
                <div className="text-[11px] text-[#16A34A]">Up to 2.5 ETH</div>
                <p className="text-[11px] text-[#848B98] font-sans">
                  Zero login or accounts required. Solves PoW in browser.
                </p>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
