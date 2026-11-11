"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import {
  Lock,
  Wallet,
  AlertCircle,
  ArrowLeft,
  ShieldCheck
} from "lucide-react";
import { BrowserProvider, Signer } from "ethers";
import { SiweMessage } from "siwe";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { EXPECTED_NETWORK_NAME } from "@/lib/contracts";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string>("");
  const [isWeb3Loading, setIsWeb3Loading] = useState<boolean>(false);

  const executeSiweLogin = async (
    signer: Signer,
    walletAddress: string,
    chainId: number
  ) => {
    // 1. Fetch secure nonce
    const nonceRes = await fetchApi("/auth/nonce");
    if (!nonceRes.ok) throw new Error("Failed to obtain secure authentication nonce.");
    const nonce = await nonceRes.text();

    // 2. Prepare SIWE message
    const message = new SiweMessage({
      domain: window.location.host,
      address: walletAddress,
      statement: "Sign in to ZeroVault Protocol",
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce
    });
    const preparedMessage = message.prepareMessage();

    // 3. Sign message in wallet
    const signature = await signer.signMessage(preparedMessage);

    // 4. Verify signature on backend
    const verifyRes = await fetchApi("/auth/verify-siwe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: preparedMessage, signature })
    });

    const data = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(data.error || "Web3 authentication failed.");

    await refreshUser();
    if (data?.user?.role === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/listings");
    }
  };

  const handleWeb3Login = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Web3 wallet not detected. Please install MetaMask to authenticate.");
      return;
    }

    setIsWeb3Loading(true);
    setError("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      await executeSiweLogin(signer, walletAddress, chainId);
    } catch (err: unknown) {
      const errorObj = err as { code?: string | number; message?: string };
      if (errorObj?.code === "ACTION_REJECTED" || errorObj?.code === 4001) {
        setError("Signature request rejected in wallet.");
      } else {
        setError(errorObj?.message || "Web3 authentication failed.");
      }
    } finally {
      setIsWeb3Loading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-12 sm:py-20 flex flex-col justify-center">
        {/* Breadcrumb back to marketplace */}
        <div className="mb-6 font-mono text-xs">
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 text-[#848B98] hover:text-[#F0F2F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Marketplace</span>
          </Link>
        </div>

        {/* Authentication Card */}
        <div className="rounded border border-[#232732] bg-[#14171E] p-6 sm:p-8 space-y-6">
          {/* Card Header */}
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded border border-[#232732] bg-[#0C0E12] mx-auto flex items-center justify-center text-[#2563EB] mb-3">
              <Lock className="w-6 h-6" />
            </div>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#0C0E12] font-mono text-[11px] text-[#848B98]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>{EXPECTED_NETWORK_NAME}</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              Authenticate Protocol Session
            </h1>
            <p className="text-xs text-[#848B98] font-sans leading-relaxed max-w-sm mx-auto">
              Sign in with your Ethereum wallet using EIP-4361 (Sign-In with Ethereum). No passwords or private keys required.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#DC2626] font-mono text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleWeb3Login}
              disabled={isWeb3Loading}
              className="w-full h-11 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-semibold inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
              {isWeb3Loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Requesting Wallet Signature...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Connect & Sign in with Ethereum</span>
                </>
              )}
            </button>

            <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] text-[11px] font-mono text-[#848B98] space-y-1">
              <div className="flex items-center gap-1.5 text-[#F0F2F5]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="font-medium">Cryptographic Handshake</span>
              </div>
              <p className="leading-relaxed">
                ZeroVault verifies your signature off-chain and issues a strictly scoped, HTTP-only session cookie.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="border-t border-[#232732] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#848B98]">
            <span>Don&apos;t have an identity registered?</span>
            <Link
              href="/register"
              className="text-[#2563EB] hover:text-[#3B82F6] hover:underline transition-colors font-medium"
            >
              Register Clearance &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
