"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md">
      {/* Click backdrop to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-6xl my-auto z-10 bg-[#0B1120] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] p-4 sm:p-6 overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-heading font-semibold text-sm text-white uppercase tracking-wider">
              Cryptographic Proof Workbench Popup
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-white/10 text-slate-400 hover:text-white transition-colors font-mono text-xs flex items-center gap-1.5"
            title="Close modal (Esc)"
          >
            <span>Close (Esc)</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Exact Authentic MerkleProofViewer Component matching student report screenshots */}
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
