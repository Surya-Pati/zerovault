"use client";

import React, { useEffect } from "react";
import { X, ShieldCheck, Copy, Check } from "lucide-react";
import MerkleProofViewer from "@/components/MerkleProofViewer";
import { DisclosureClaim } from "@/lib/crypto";

interface MerkleProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  merkleRoot: string;
  claims: DisclosureClaim[];
  selectedInitialIndex?: number;
  onProofVerified?: (isValid: boolean, leafIndex: number) => void;
}

export default function MerkleProofModal({
  isOpen,
  onClose,
  merkleRoot,
  claims,
  selectedInitialIndex = 0,
  onProofVerified,
}: MerkleProofModalProps) {
  const [copiedRoot, setCopiedRoot] = React.useState(false);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyRoot = () => {
    navigator.clipboard.writeText(merkleRoot);
    setCopiedRoot(true);
    setTimeout(() => setCopiedRoot(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click backdrop to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-6xl my-auto z-10 bg-[#0D0F14] border border-[#222634] rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] p-4 sm:p-6 overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Modal Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[#1E2330]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#131722] border border-[#222634] flex items-center justify-center text-[#10B981] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold tracking-wider text-[#F1F5F9] uppercase">
                  Merkle Proof Verification Engine
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              </div>
              <p className="text-[11px] text-[#94A3B8] font-sans">
                Interactive cryptographic verification against on-chain root
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Quick-copy on-chain root */}
            <button
              onClick={handleCopyRoot}
              className="px-2.5 py-1 rounded-lg border border-[#222634] bg-[#131722] hover:border-[#2E3547] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-mono text-[11px] flex items-center gap-1.5"
              title="Copy on-chain Merkle Root"
            >
              <span className="text-[#64748B]">Root:</span>
              <span className="text-[#CBD5E1] truncate max-w-[120px] sm:max-w-[160px]">
                {merkleRoot ? `${merkleRoot.slice(0, 10)}...${merkleRoot.slice(-6)}` : "0x0000..."}
              </span>
              {copiedRoot ? (
                <Check className="w-3 h-3 text-[#10B981]" />
              ) : (
                <Copy className="w-3 h-3 text-[#64748B]" />
              )}
            </button>

            {/* Esc close shortcut pill */}
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg border border-[#222634] bg-[#131722] hover:border-[#2E3547] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-mono text-xs flex items-center gap-1.5"
              title="Close modal (Esc)"
            >
              <span className="hidden sm:inline text-[#64748B] text-[10px] uppercase">Esc</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Core Cryptographic Proof Workbench Component */}
        <MerkleProofViewer
          merkleRoot={merkleRoot}
          initialClaims={claims}
          selectedInitialIndex={selectedInitialIndex}
          onProofVerified={(isValid, leafIndex) => {
            if (onProofVerified) {
              onProofVerified(isValid, leafIndex);
            }
          }}
        />
      </div>
    </div>
  );
}
