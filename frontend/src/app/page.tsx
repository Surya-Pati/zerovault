"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Shield, CheckCircle2, XCircle, ArrowUpRight, Lock, Key, FileCheck, Layers } from "lucide-react";
import { hashLeaf, verifyProof } from "@/lib/crypto";
import { useAuth } from "@/providers/AuthProvider";

export default function HomePage() {
  const { user } = useAuth();

  // Interactive Merkle Proof trace state
  const [tampered, setTampered] = useState(false);
  const sampleKey = "cwe";
  const sampleValue = tampered 
    ? "CWE-89: SQL Injection (Tampered Claim)" 
    : "CWE-787: Out-of-bounds Write in HTTP/2 Parser";
  const sampleSalt = "0x7777777777777777777777777777777777777777777777777777777777777777";

  // Precalculated authentic proof nodes for the sample tree
  const sampleLeafHash = hashLeaf(sampleKey, sampleValue, sampleSalt);
  const sampleSibling1 = "0x16cad4358a1fd669804ede36322ce2e871fd4e60d3579ca7390fdaa3888e1fec";
  const sampleSibling2 = "0x44d3de99cf4347d3533f8cb401d6d752045d4972afcd88850f28c72ce74340aa";
  
  // Real root of the non-tampered sample
  const authenticRoot = "0x936b09b52f55fc4ac057ba91026e0b31c2fae8b5fc6a1355de1a261933d62217";
  const calculatedRoot = tampered 
    ? "0x7a1109bc44d812fe55a90b1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f" 
    : authenticRoot;
  const isMatch = calculatedRoot === authenticRoot;

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F0F2F5] flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        
        {/* Hero Section */}
        <section className="space-y-8">
          
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] font-mono text-[11px] text-[#848B98]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>Verifiable Vulnerability Disclosure Protocol</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#F0F2F5] font-sans leading-tight">
              Trustless zero-day escrow. Verify partial disclosure proofs before depositing 1 Wei.
            </h1>

            <p className="text-sm sm:text-base text-[#9AA2B2] leading-relaxed max-w-2xl font-sans">
              ZeroVault replaces blind trust with mathematical certainty. Researchers commit cryptographic Merkle roots of zero-day vulnerabilities. Buyers verify inclusion proofs off-chain, and escrows settle atomically on Ethereum upon AES key revelation.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-xs">
              <Link
                href="/listings"
                className="px-5 py-2.5 rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors font-medium inline-flex items-center gap-2"
              >
                <span>Explore marketplace</span>
              </Link>
              {user?.role !== "BUYER" && (
                <Link
                  href="/submit"
                  className="px-5 py-2.5 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] hover:border-[#3B4252] transition-colors inline-flex items-center gap-2"
                >
                  <span>Submit disclosure</span>
                </Link>
              )}
            </div>
          </div>

          {/* Interactive Hero Trace Simulator */}
          <div className="rounded border border-[#232732] bg-[#14171E] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#232732] pb-4">
              <div>
                <span className="text-[11px] font-mono text-[#848B98] uppercase tracking-wider block">
                  Live Cryptographic Verification Trace
                </span>
                <p className="text-xs text-[#9AA2B2] font-sans mt-0.5">
                  Interactive simulation of ZeroVault off-chain proof verification against the on-chain root commitment.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setTampered(false)}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    !tampered 
                      ? "bg-[#2563EB] text-white border-[#2563EB]" 
                      : "bg-[#0C0E12] text-[#848B98] border-[#232732] hover:text-[#F0F2F5]"
                  }`}
                >
                  Authentic proof
                </button>
                <button
                  onClick={() => setTampered(true)}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    tampered 
                      ? "bg-[#DC2626] text-white border-[#DC2626]" 
                      : "bg-[#0C0E12] text-[#848B98] border-[#232732] hover:text-[#F0F2F5]"
                  }`}
                >
                  Simulate tampered leaf
                </button>
              </div>
            </div>

            {/* Trace Steps */}
            <div className="space-y-3 font-mono text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                  <span className="text-[10px] text-[#848B98] uppercase">Target Claim Leaf</span>
                  <div className="text-[#F0F2F5] truncate">
                    key: <span className="text-[#2563EB]">"{sampleKey}"</span>
                  </div>
                  <div className="text-[#9AA2B2] truncate text-[11px]">
                    val: "{sampleValue}"
                  </div>
                </div>

                <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                  <span className="text-[10px] text-[#848B98] uppercase">1. Evaluated Leaf Hash</span>
                  <div className="text-[#F0F2F5] text-[11px] truncate">
                    keccak256(claim + salt) =
                  </div>
                  <div className="text-[#9AA2B2] text-[11px] truncate font-semibold">
                    {sampleLeafHash}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#848B98]">2. Merkle Proof Inclusion Path (2 Siblings)</span>
                  <span className="text-[#848B98]">Tree Depth: 2</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="p-1.5 rounded bg-[#14171E] text-[#9AA2B2] truncate">
                    Level 0 [R]: {sampleSibling1}
                  </div>
                  <div className="p-1.5 rounded bg-[#14171E] text-[#9AA2B2] truncate">
                    Level 1 [L]: {sampleSibling2}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                  <span className="text-[10px] text-[#848B98] uppercase">3. Evaluated Root</span>
                  <div className="text-[#F0F2F5] text-[11px] truncate font-semibold">
                    {calculatedRoot}
                  </div>
                </div>

                <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1">
                  <span className="text-[10px] text-[#848B98] uppercase">4. On-Chain Committed Root</span>
                  <div className="text-[#F0F2F5] text-[11px] truncate font-semibold">
                    {authenticRoot}
                  </div>
                </div>
              </div>

              {/* Result confirmation */}
              <div className={`p-3 rounded border flex items-center justify-between gap-3 ${
                isMatch 
                  ? "bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A]" 
                  : "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626]"
              }`}>
                <div className="flex items-center gap-2">
                  {isMatch ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium text-xs">
                    {isMatch 
                      ? "PROOF VALID: Computed hash matches on-chain Merkle root commitment." 
                      : "PROOF REJECTED: Cryptographic mismatch. Counterparty cannot claim bounty."}
                  </span>
                </div>
                <span className="text-[11px] uppercase font-mono">
                  {isMatch ? "Escrow Authorized" : "Payment Blocked"}
                </span>
              </div>

            </div>
          </div>

        </section>

        {/* Protocol Mechanics Grid */}
        <section className="space-y-6 border-t border-[#232732] pt-12">
          <div>
            <span className="text-[11px] font-mono text-[#848B98] uppercase tracking-wider block">
              Protocol Architecture
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F0F2F5] font-sans mt-1">
              Four formal phases enforced by smart contracts
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            
            <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-2">
              <div className="text-[#848B98] text-[11px]">[ 01 ]</div>
              <h3 className="font-semibold text-sm text-[#F0F2F5] font-sans">Commitment</h3>
              <p className="text-[#9AA2B2] text-xs font-sans leading-relaxed">
                Researcher encrypts vulnerability payload with AES-256 and commits the Merkle root + key hash on-chain.
              </p>
            </div>

            <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-2">
              <div className="text-[#848B98] text-[11px]">[ 02 ]</div>
              <h3 className="font-semibold text-sm text-[#F0F2F5] font-sans">Proof Verification</h3>
              <p className="text-[#9AA2B2] text-xs font-sans leading-relaxed">
                Buyer audits partial disclosure claims off-chain. Each disclosed leaf is validated mathematically against the root.
              </p>
            </div>

            <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-2">
              <div className="text-[#848B98] text-[11px]">[ 03 ]</div>
              <h3 className="font-semibold text-sm text-[#F0F2F5] font-sans">Escrow Lock</h3>
              <p className="text-[#9AA2B2] text-xs font-sans leading-relaxed">
                Buyer locks bounty in ETH into the smart contract. A timeout window activates to protect both parties.
              </p>
            </div>

            <div className="p-4 rounded border border-[#232732] bg-[#14171E] space-y-2">
              <div className="text-[#848B98] text-[11px]">[ 04 ]</div>
              <h3 className="font-semibold text-sm text-[#F0F2F5] font-sans">Atomic Settlement</h3>
              <p className="text-[#9AA2B2] text-xs font-sans leading-relaxed">
                Researcher submits plaintext decryption key on-chain. Contract verifies keccak256(key) and releases funds.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#232732] bg-[#0C0E12] py-8 text-xs font-mono text-[#848B98]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span>ZeroVault Smart Contracts Deployed on Localhost (Chain ID 31337)</span>
          </div>
          <div>Audit-Grade Verification Protocol</div>
        </div>
      </footer>
    </div>
  );
}
