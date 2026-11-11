"use client";

import React, { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { DEFAULT_ZEROVAULT_ADDRESS, EXPECTED_NETWORK_NAME } from "@/lib/contracts";

interface AdminTelemetryProps {
  connectedWallet: string | null;
}

export default function AdminTelemetry({ connectedWallet }: AdminTelemetryProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard write failed or denied
    }
  };

  const explorerUrl = `https://sepolia.etherscan.io/address/${DEFAULT_ZEROVAULT_ADDRESS}`;

  return (
    <div className="rounded border border-[#232732] bg-[#14171E] p-4 font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target Smart Contract */}
        <div className="space-y-1">
          <span className="text-[10px] text-[#848B98] uppercase">Target Smart Contract</span>
          <div className="flex items-center gap-2">
            <span className="text-[#F0F2F5] text-[11px] truncate">
              {DEFAULT_ZEROVAULT_ADDRESS}
            </span>
            <button
              onClick={() => copyToClipboard(DEFAULT_ZEROVAULT_ADDRESS, "contract")}
              title="Copy contract address"
              className="text-[#848B98] hover:text-[#F0F2F5] transition-colors shrink-0"
            >
              {copiedKey === "contract" ? (
                <Check className="w-3 h-3 text-[#16A34A]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Sepolia Etherscan"
              className="text-[#848B98] hover:text-[#2563EB] transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Network & Cluster */}
        <div className="space-y-1">
          <span className="text-[10px] text-[#848B98] uppercase">Network & Cluster</span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span className="text-[#F0F2F5]">{EXPECTED_NETWORK_NAME}</span>
            <span className="text-[#848B98]">|</span>
            <span className="text-[#848B98]">Bridge Synced</span>
          </div>
        </div>

        {/* Connected MetaMask Wallet */}
        <div className="space-y-1">
          <span className="text-[10px] text-[#848B98] uppercase">Connected MetaMask Wallet</span>
          <div className="flex items-center gap-2">
            {connectedWallet ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span className="text-[#F0F2F5] text-[11px] truncate">{connectedWallet}</span>
                <button
                  onClick={() => copyToClipboard(connectedWallet, "wallet")}
                  title="Copy wallet address"
                  className="text-[#848B98] hover:text-[#F0F2F5] transition-colors shrink-0"
                >
                  {copiedKey === "wallet" ? (
                    <Check className="w-3 h-3 text-[#16A34A]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </>
            ) : (
              <span className="text-[#D97706] text-[11px]">
                Not detected (Unlock MetaMask to transact)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
