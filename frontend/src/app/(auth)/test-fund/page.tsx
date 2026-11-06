"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserData {
  user: {
    id: string;
    role: string;
    wallet_address?: string;
    email?: string;
    verified_buyer?: boolean;
  };
}

export default function TestFundPage() {
  const router = useRouter();
  const [userDetails, setUserDetails] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError] = useState("");

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("http://localhost:3001/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUserDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-cyan-500">
          <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Initializing Interface...</p>
        </div>
      </div>
    );
  }

  const isBuyer = userDetails?.user?.role === "buyer";
  const isVerified = userDetails?.user?.verified_buyer === true;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 relative z-10 flex flex-col items-center justify-center">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/10 gap-4">
          <div>
            <h1 className="text-3xl font-heading font-medium tracking-tight text-white flex items-center gap-3">
              Escrow Network Test
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.8)]"></span>
              </span>
            </h1>
            <p className="text-sm font-mono mt-2 text-slate-400">Verify your cryptographic role and funding authorization.</p>
          </div>
          <div className="flex items-center gap-3 bg-black/40 p-2 pr-4 rounded-full border border-white/5 backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest hidden sm:block">Session</span>
            <span className="font-mono text-cyan-400 text-xs tracking-wider">
              {userDetails?.user?.wallet_address ? `${userDetails.user.wallet_address.slice(0, 6)}...${userDetails.user.wallet_address.slice(-4)}` : userDetails?.user?.email}
            </span>
          </div>
        </motion.div>
        
        {/* Diagnostic Panel */}
        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(8,112,184,0.1)] relative overflow-hidden rounded-2xl">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            <CardHeader className="bg-white/[0.02] border-b border-white/5">
              <CardTitle className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <div className="w-2 h-2 bg-indigo-400 rounded-sm" />
                Session Identity Block
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <motion.div whileHover={{ scale: 1.05 }} className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">USER_ID</p>
                  <p className="font-mono text-xs text-slate-200 truncate">{userDetails?.user?.id.split('-')[0]}...</p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">ROLE</p>
                  <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono font-medium text-slate-200 uppercase tracking-wider">
                    {userDetails?.user?.role}
                  </span>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">KYC_STATUS</p>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-medium text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      VERIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-mono font-medium text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      UNVERIFIED
                    </span>
                  )}
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">CLEARANCE</p>
                  <span className={`font-mono text-xs uppercase tracking-wider block mt-2 ${(!isBuyer || isVerified) ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-red-400'}`}>
                    {(!isBuyer || isVerified) ? 'L2_GRANTED' : 'L0_DENIED'}
                  </span>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Block */}
        <AnimatePresence>
          {isBuyer && !isVerified && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="hidden">
              <Card className="bg-red-950/20 backdrop-blur-2xl border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.1)] relative overflow-hidden rounded-2xl">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                <CardHeader className="bg-red-500/5 border-b border-red-500/10">
                  <CardTitle className="text-red-400 text-sm flex items-center gap-3 font-mono uppercase tracking-[0.15em]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    AUTHORIZATION DENIED
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-slate-300 text-sm font-mono leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">
                    <span className="text-red-400 font-bold">ERR_UNAUTHORIZED:</span> Your account requires administrator verification before interacting with the Escrow Smart Contract. Wait for L2 clearance.
                  </p>
                </CardContent>
                <CardFooter className="pb-6">
                  <Button disabled className="w-full sm:w-auto h-12 px-8 font-mono text-xs tracking-widest bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl">
                    INITIALIZE FUNDING CALL (LOCKED)
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {(!isBuyer || isVerified) && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="hidden">
              <Card className="bg-emerald-950/20 backdrop-blur-2xl border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)] relative overflow-hidden rounded-2xl">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                <div className="absolute top-0 right-0 p-8 opacity-20 transform rotate-12 scale-150 pointer-events-none">
                  <svg className="w-32 h-32 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/10 relative z-10">
                  <CardTitle className="text-emerald-400 text-sm flex items-center gap-3 font-mono uppercase tracking-[0.15em]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    SYSTEM CLEARANCE GRANTED
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 relative z-10">
                  <p className="text-emerald-50 text-sm font-mono leading-relaxed bg-black/40 p-4 rounded-xl border border-emerald-500/20 shadow-inner">
                    {isBuyer ? '> Buyer identity verified.' : '> Non-buyer role detected.'} Escrow integration unlocked. Ready to initialize funding call.
                  </p>
                  {actionError && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-xs font-medium text-red-400 font-mono flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        {actionError}
                      </p>
                    </motion.div>
                  )}
                </CardContent>
                <CardFooter className="pb-6 relative z-10">
                  <Button className="w-full sm:w-auto h-12 px-8 font-mono text-xs tracking-widest bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300 rounded-xl" onClick={() => router.push("/listings")}>
                    PROCEED TO MARKETPLACE
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
