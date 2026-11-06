"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  XCircle,
  Users,
  Check,
  X,
  Power,
  ShieldOff,
  Layers,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setKYCStatusOnChain, pauseContractOnChain, unpauseContractOnChain, getContractPausedState } from "@/lib/contracts";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface Buyer {
  id: string;
  profile_name: string;
  wallet_address: string;
  verified_buyer: boolean;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Buyers state
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [buyerActionStates, setBuyerActionStates] = useState<Record<string, { loading: boolean; error?: string; success?: string }>>({});

  // Contract pause state
  const [contractPaused, setContractPaused] = useState<boolean>(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const fetchBuyersList = async () => {
    setLoadingBuyers(true);
    try {
      const res = await fetchApi('/auth/buyers');
      if (res.ok) {
        const data = await res.json();
        setBuyers(data.buyers || []);
      }
    } catch (err) {
      console.error('Failed to fetch buyers:', err);
    } finally {
      setLoadingBuyers(false);
    }
  };

  useEffect(() => {
    fetchBuyersList();
    getContractPausedState().then(setContractPaused).catch(() => {});
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setConnectedWallet(accounts[0]);
        }
      }).catch(() => {});
      (window as any).ethereum.on?.('accountsChanged', (accounts: string[]) => {
        setConnectedWallet(accounts?.[0] || null);
      });
    }
  }, []);

  const handleVerifyBuyer = async (buyerId: string, verify: boolean) => {
    setBuyerActionStates(prev => ({ ...prev, [buyerId]: { loading: true, error: undefined, success: undefined } }));
    try {
      const buyer = buyers.find(b => b.id === buyerId);
      if (!buyer?.wallet_address) {
        throw new Error("Buyer wallet address not found");
      }
      
      // 1. Execute On-chain KYC update
      await setKYCStatusOnChain(buyer.wallet_address, verify);
      
      // 2. Direct DB sync API call
      try {
        await fetchApi(`/admin/buyers/${buyerId}/kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: verify })
        });
      } catch (syncErr) {
        console.warn('Direct DB sync warning (bridge will still sync):', syncErr);
      }

      // 3. Optimistic local state update so the UI flips instantly
      setBuyers(prev => prev.map(b => b.id === buyerId ? { ...b, verified_buyer: verify } : b));

      setBuyerActionStates(prev => ({
        ...prev,
        [buyerId]: { 
          loading: false, 
          success: verify ? 'KYC approved & synchronized successfully!' : 'KYC revoked & synchronized successfully!' 
        }
      }));
      
      // Refresh the list after a short delay
      setTimeout(() => {
        fetchBuyersList();
      }, 2000);
      
    } catch (err: any) {
      let errorMsg = err.message || 'On-chain transaction failed or rejected';
      if (
        errorMsg.includes("e2517d3f") ||
        errorMsg.includes("AccessControlUnauthorizedAccount") ||
        JSON.stringify(err).includes("e2517d3f")
      ) {
        errorMsg = "Unauthorized: Your connected MetaMask wallet does not have the on-chain ADMIN_ROLE on this contract.";
      }
      setBuyerActionStates(prev => ({
        ...prev,
        [buyerId]: { loading: false, error: errorMsg }
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
      let errorMsg = err.message || 'Failed to toggle pause state';
      if (
        errorMsg.includes("e2517d3f") ||
        errorMsg.includes("AccessControlUnauthorizedAccount") ||
        JSON.stringify(err).includes("e2517d3f")
      ) {
        errorMsg = "Unauthorized: Your connected MetaMask wallet does not have the on-chain ADMIN_ROLE on this contract.";
      }
      setPauseError(errorMsg);
    } finally {
      setPauseLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0E1A] text-white relative z-10">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/30 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h1 className="font-heading font-bold text-lg tracking-wide">ZeroVault Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/listings">
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 gap-1.5 font-heading text-xs uppercase tracking-wider rounded-lg"
              >
                <Layers className="w-3.5 h-3.5" />
                Listings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBuyersList}
              disabled={loadingBuyers}
              className="border-white/10 text-slate-300 hover:text-white gap-1.5 font-mono text-xs rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBuyers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="border-red-500/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 gap-1.5 font-heading text-xs uppercase tracking-wider rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Role & Wallet Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">SESSION:</span>
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
              {user?.profile_name || 'Admin'} ({user?.role})
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">METAMASK WALLET:</span>
            {connectedWallet ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                {connectedWallet}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10">
                Not Connected (Connect in MetaMask)
              </Badge>
            )}
          </div>
        </div>

        {/* Role Check */}
        {(user?.role as string) !== 'ADMIN' && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>You must be logged in as an ADMIN. Your current role: <strong>{user?.role || 'Not logged in'}</strong></span>
          </div>
        )}

        {/* Circuit Breaker */}
        <Card className={`backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden transition-all ${
          contractPaused 
            ? 'bg-slate-950/90 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
            : 'bg-slate-950/80 border-cyan-500/20 shadow-xl hover:border-cyan-500/40'
        }`}>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                contractPaused 
                  ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              }`}>
                {contractPaused ? <ShieldOff className="w-6 h-6 text-red-400" /> : <Shield className="w-6 h-6 text-cyan-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading font-semibold text-white text-base">Emergency Circuit Breaker</h3>
                  <Badge variant="outline" className={`font-mono text-[10px] ${
                    contractPaused 
                      ? 'bg-red-950/60 text-red-400 border-red-500/40' 
                      : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                  }`}>
                    {contractPaused ? 'HALTED' : 'OPERATIONAL'}
                  </Badge>
                </div>
                <p className={`text-xs font-mono ${contractPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                  {contractPaused ? '⛔ PAUSED — All contract escrow operations are currently frozen.' : '✅ ACTIVE — Smart contract consensus & settlement fully operational.'}
                </p>
                {pauseError && <p className="text-[10px] text-red-400 mt-1 font-mono">{pauseError}</p>}
              </div>
            </div>
            <Button
              onClick={handleTogglePause}
              disabled={pauseLoading}
              className={`h-11 font-heading font-semibold text-xs tracking-widest uppercase rounded-xl px-6 flex items-center gap-2 transition-all ${
                contractPaused
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
              }`}
            >
              {pauseLoading ? (
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              {contractPaused ? 'Resume Operations' : 'Emergency Pause'}
            </Button>
          </CardContent>
        </Card>

        {/* Buyers Tab */}
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <h2 className="font-heading font-semibold text-white text-base">Manage Buyers</h2>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-mono ml-1">KYC</Badge>
        </div>

        {loadingBuyers ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading registered buyers...</p>
          </div>
        ) : buyers.length === 0 ? (
          <Card className="bg-slate-900/40 border-white/5">
            <CardContent className="py-16 text-center">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="font-heading font-semibold text-lg text-white mb-1">No Buyers Found</h3>
              <p className="text-sm text-slate-400">There are no registered buyers on the platform yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {buyers.map((buyer) => {
              const state = buyerActionStates[buyer.id];
              return (
                <motion.div
                  key={buyer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-slate-950/80 backdrop-blur-xl border-cyan-500/20 shadow-xl rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all">
                    <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading font-semibold text-white text-base">{buyer.profile_name}</h3>
                            {buyer.verified_buyer ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-mono">VERIFIED</Badge>
                            ) : (
                              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/40 text-[10px] font-mono">UNVERIFIED</Badge>
                            )}
                          </div>
                          <div className="p-2 px-3 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-slate-400">
                            {buyer.wallet_address}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                        <div className="flex gap-2 w-full md:w-auto">
                          {!buyer.verified_buyer ? (
                            <Button
                              onClick={() => handleVerifyBuyer(buyer.id, true)}
                              disabled={state?.loading}
                              className="flex-1 md:flex-none h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-heading font-semibold text-xs tracking-widest uppercase rounded-xl px-5 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
                            >
                              {state?.loading ? (
                                <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Approve KYC
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleVerifyBuyer(buyer.id, false)}
                              disabled={state?.loading}
                              variant="outline"
                              className="flex-1 md:flex-none h-11 border-red-500/40 text-red-400 hover:bg-red-950/40 font-mono text-xs tracking-wider rounded-xl px-5 flex items-center justify-center gap-2 transition-all"
                            >
                              {state?.loading ? (
                                <span className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                              Revoke
                            </Button>
                          )}
                        </div>

                        {state?.error && (
                          <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> {state.error}
                          </p>
                        )}
                        {state?.success && (
                          <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {state.success}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
