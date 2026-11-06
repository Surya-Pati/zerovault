"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrowserProvider } from "ethers";
import { SiweMessage } from "siwe";
import { API_URL, fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState("");
  const [isWeb3Loading, setIsWeb3Loading] = useState(false);

  const handleWeb3Login = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError("Web3 wallet not detected. Please install MetaMask.");
      return;
    }
    
    setIsWeb3Loading(true);
    setError("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const chainId = Number((await provider.getNetwork()).chainId);

      // 1. Get Nonce via fetchApi
      const nonceRes = await fetchApi('/auth/nonce');
      if (!nonceRes.ok) throw new Error("Failed to fetch secure nonce");
      const nonce = await nonceRes.text();

      // 2. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address: walletAddress,
        statement: `Sign in to ZeroVault`,
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const preparedMessage = message.prepareMessage();
      
      // 3. Sign message
      const signature = await signer.signMessage(preparedMessage);

      // 4. Verify & Login
      const verifyRes = await fetchApi('/auth/verify-siwe', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: preparedMessage, signature }),
      });

      let data;
      try {
        data = await verifyRes.json();
      } catch (parseErr) {
        throw new Error("Server returned an invalid response (not JSON)");
      }
      
      if (!verifyRes.ok) throw new Error(data.error || "Web3 login failed");
      
      await refreshUser();
      if (data?.user?.role === 'ADMIN') {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Web3 login failed");
      }
    } finally {
      setIsWeb3Loading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring" as const, stiffness: 100, damping: 20, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible"
        className="w-full max-w-md"
      >
        <Card className="bg-black/60 backdrop-blur-2xl border-white/10 shadow-[0_0_60px_rgba(0,255,255,0.1)] rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          <CardHeader className="space-y-4 pb-6 pt-10 flex flex-col items-center text-center">
            <motion.div variants={itemVariants} className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-white/5 mb-2 shadow-inner">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </motion.div>
            <motion.div variants={itemVariants}>
              <CardTitle className="text-3xl font-heading font-medium tracking-tight text-white mb-2">Authenticate Protocol</CardTitle>
              <CardDescription className="text-slate-400 text-sm max-w-[250px] mx-auto leading-relaxed">
                Access your secure network identity and verify clearance.
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6 px-8">
            <motion.div variants={itemVariants} className="pt-2">
              <Button 
                type="button" 
                onClick={handleWeb3Login}
                disabled={isWeb3Loading}
                className="w-full h-12 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/50 font-heading text-sm tracking-widest uppercase transition-all duration-300 rounded-xl flex items-center justify-center gap-2"
              >
                {isWeb3Loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 12V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V12ZM21 12H15C13.8954 12 13 11.1046 13 10C13 8.89543 13.8954 8 15 8H21V12ZM17 10H15V11H17V10Z" fill="currentColor"/>
                  </svg>
                )}
                {isWeb3Loading ? "Authenticating..." : "Connect Web3 Wallet"}
              </Button>
            </motion.div>
            
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-xs font-medium text-red-400 font-mono flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      {error}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-6 pt-2 pb-10 px-8">
            <motion.p variants={itemVariants} className="text-[11px] text-slate-500 font-mono tracking-wide text-center">
              No session?{" "}
              <a href="/register" className="text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-4 transition-colors">
                Initialize &rarr;
              </a>
            </motion.p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
