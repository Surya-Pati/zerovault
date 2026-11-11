"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import {
  UserCheck,
  Wallet,
  AlertCircle,
  ArrowLeft,
  Lock,
  FileCode
} from "lucide-react";
import { BrowserProvider, Signer } from "ethers";
import { SiweMessage } from "siwe";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { EXPECTED_NETWORK_NAME } from "@/lib/contracts";

type RoleOption = "RESEARCHER" | "BUYER";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleOption>("RESEARCHER");
  const [error, setError] = useState<string>("");
  const [isWeb3Loading, setIsWeb3Loading] = useState<boolean>(false);

  const executeSiweRegistration = async (
    signer: Signer,
    walletAddress: string,
    chainId: number
  ) => {
    // 1. Fetch secure nonce
    const nonceRes = await fetchApi("/auth/nonce");
    if (!nonceRes.ok) throw new Error("Failed to obtain secure authentication nonce.");
    const nonce = await nonceRes.text();

    // 2. Prepare SIWE message with role claim
    const message = new SiweMessage({
      domain: window.location.host,
      address: walletAddress,
      statement: `Register for ZeroVault Protocol as ${selectedRole}`,
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce
    });
    const preparedMessage = message.prepareMessage();

    // 3. Sign message in wallet
    const signature = await signer.signMessage(preparedMessage);

    // 4. Verify & Register on backend
    const verifyRes = await fetchApi("/auth/verify-siwe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: preparedMessage, signature, role: selectedRole })
    });

    const data = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(data.error || "Web3 registration failed.");

    await refreshUser();
    if (selectedRole === "RESEARCHER") {
      router.push("/submit");
    } else {
      router.push("/listings");
    }
  };

  const handleWeb3Register = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Web3 wallet not detected. Please install MetaMask to register.");
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

      await executeSiweRegistration(signer, walletAddress, chainId);
    } catch (err: unknown) {
      const errorObj = err as { code?: string | number; message?: string };
      if (errorObj?.code === "ACTION_REJECTED" || errorObj?.code === 4001) {
        setError("Signature request rejected in wallet.");
      } else {
        setError(errorObj?.message || "Web3 registration failed.");
      }
    } finally {
      setIsWeb3Loading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 sm:py-16 flex flex-col justify-center">
        {/* Breadcrumb */}
        <div className="mb-6 font-mono text-xs">
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 text-[#848B98] hover:text-[#F0F2F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Marketplace</span>
          </Link>
        </div>

        {/* Registration Card */}
        <div className="rounded border border-[#232732] bg-[#14171E] p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded border border-[#232732] bg-[#0C0E12] mx-auto flex items-center justify-center text-[#2563EB] mb-3">
              <UserCheck className="w-6 h-6" />
            </div>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#0C0E12] font-mono text-[11px] text-[#848B98]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>{EXPECTED_NETWORK_NAME}</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[#F0F2F5] font-sans">
              Provision Protocol Identity
            </h1>
            <p className="text-xs text-[#848B98] font-sans leading-relaxed max-w-sm mx-auto">
              Select your operational clearance and sign with Ethereum to establish a verifiable cryptographic identity.
            </p>
          </div>

          {/* Role Clearance Cards */}
          <div className="space-y-3">
            <span className="block text-xs font-mono uppercase tracking-wider text-[#848B98]">
              Select Operational Role & Clearance:
            </span>

            <div className="grid grid-cols-1 gap-3 font-mono">
              {/* RESEARCHER */}
              <button
                type="button"
                onClick={() => setSelectedRole("RESEARCHER")}
                className={`p-4 rounded border text-left transition-all ${
                  selectedRole === "RESEARCHER"
                    ? "border-[#2563EB] bg-[#0E1526]"
                    : "border-[#232732] bg-[#0C0E12] hover:border-[#3B4252]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#2563EB]" />
                    <span className="font-semibold text-sm text-[#F0F2F5] font-sans">
                      Security Researcher
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-[#2563EB]/40 bg-[#101726] text-[#2563EB]">
                    L1_SUBMITTER
                  </span>
                </div>
                <p className="text-xs text-[#848B98] font-sans leading-relaxed">
                  Structure zero-day vulnerability disclosures into Merkle trees, generate inclusion proofs, commit roots on-chain, and reveal AES-256 keys to claim escrows.
                </p>
              </button>

              {/* BUYER */}
              <button
                type="button"
                onClick={() => setSelectedRole("BUYER")}
                className={`p-4 rounded border text-left transition-all ${
                  selectedRole === "BUYER"
                    ? "border-[#2563EB] bg-[#0E1526]"
                    : "border-[#232732] bg-[#0C0E12] hover:border-[#3B4252]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#2563EB]" />
                    <span className="font-semibold text-sm text-[#F0F2F5] font-sans">
                      Institutional Buyer / Vendor
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]">
                    L2_FUNDER
                  </span>
                </div>
                <p className="text-xs text-[#848B98] font-sans leading-relaxed">
                  Verify cryptographic inclusion proofs off-chain, lock ETH bounties in smart contract escrow, and obtain encrypted zero-day payloads upon settlement.
                </p>
              </button>
            </div>
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

          {/* Submit Action */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleWeb3Register}
              disabled={isWeb3Loading}
              className="w-full h-11 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-semibold inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
              {isWeb3Loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Signing Registration Handshake...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Register Identity with MetaMask</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Link */}
          <div className="border-t border-[#232732] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#848B98]">
            <span>Already registered your wallet?</span>
            <Link
              href="/login"
              className="text-[#2563EB] hover:text-[#3B82F6] hover:underline transition-colors font-medium"
            >
              Authenticate Session &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
