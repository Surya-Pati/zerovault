"use client";

import React from "react";
import { Power } from "lucide-react";

interface CircuitBreakerBannerProps {
  contractPaused: boolean;
  pauseLoading: boolean;
  pauseError: string | null;
  onTogglePause: () => void;
}

export default function CircuitBreakerBanner({
  contractPaused,
  pauseLoading,
  pauseError,
  onTogglePause
}: CircuitBreakerBannerProps) {
  return (
    <div
      className={`rounded border p-6 space-y-4 transition-colors ${
        contractPaused ? "border-[#DC2626]/50 bg-[#170E10]" : "border-[#232732] bg-[#14171E]"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded border flex items-center justify-center shrink-0 ${
              contractPaused
                ? "border-[#DC2626]/40 bg-[#0C0E12] text-[#DC2626]"
                : "border-[#16A34A]/40 bg-[#0C0E12] text-[#16A34A]"
            }`}
          >
            <Power className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#F0F2F5] font-sans">
                Emergency Circuit Breaker Switch
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  contractPaused
                    ? "border-[#DC2626]/40 bg-[#170E10] text-[#DC2626]"
                    : "border-[#16A34A]/40 bg-[#0F1A14] text-[#16A34A]"
                }`}
              >
                {contractPaused ? "CONTRACT FROZEN" : "STATE NORMAL"}
              </span>
            </div>
            <p className="text-xs text-[#848B98] font-sans">
              {contractPaused
                ? "Emergency pause is active on Sepolia contract. All commitVulnerability, lockBounty, and revealAndClaim transactions are rejected."
                : "When activated, the pause() function immediately halts all smart contract deposit and release mechanisms in the event of an exploit."}
            </p>
            {pauseError && (
              <p className="text-[11px] text-[#DC2626] font-mono pt-1">{pauseError}</p>
            )}
          </div>
        </div>

        <button
          onClick={onTogglePause}
          disabled={pauseLoading}
          className={`px-5 py-2.5 rounded font-mono text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0 disabled:opacity-50 ${
            contractPaused
              ? "bg-[#16A34A] hover:bg-[#15803D] text-white"
              : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
          }`}
        >
          {pauseLoading ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
          <span>{contractPaused ? "Resume Contract Operations" : "Trigger Emergency Pause"}</span>
        </button>
      </div>
    </div>
  );
}
