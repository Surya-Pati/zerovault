"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { EXPECTED_NETWORK_NAME } from "@/lib/contracts";
import { Shield, Copy, Check, LogOut, Terminal, ExternalLink } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!user?.wallet_address) return;
    navigator.clipboard.writeText(user.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { href: "/listings", label: "Marketplace" },
  ];

  if (user?.role !== "BUYER") {
    navLinks.push({ href: "/submit", label: "Submit Disclosure" });
  }

  if (user?.role === "ADMIN") {
    navLinks.push({ href: "/admin", label: "Admin Console" });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#232732] bg-[#0C0E12]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Left: Brand + Nav Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded border border-[#232732] bg-[#14171E] flex items-center justify-center text-[#F0F2F5] group-hover:border-[#3B4252] transition-colors">
              <Shield className="w-3.5 h-3.5 text-[#2563EB]" />
            </div>
            <span className="font-mono font-semibold text-sm tracking-tight text-[#F0F2F5]">
              ZEROVAULT
            </span>
            <span className="text-[10px] font-mono text-[#848B98] border border-[#232732] px-1.5 py-0.5 rounded bg-[#14171E]">
              v1.0
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 font-mono text-xs">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    isActive
                      ? "text-[#F0F2F5] bg-[#14171E] border border-[#232732]"
                      : "text-[#848B98] hover:text-[#F0F2F5] hover:bg-[#14171E]/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Network status + Wallet session */}
        <div className="flex items-center gap-3 font-mono text-xs">
          
          {/* Network indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] text-[#848B98] text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span>{EXPECTED_NETWORK_NAME}</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              {/* Wallet address chip with copy */}
              <button
                onClick={copyAddress}
                title="Click to copy full wallet address"
                className="flex items-center gap-2 px-2.5 py-1 rounded border border-[#232732] bg-[#14171E] hover:border-[#3B4252] transition-colors text-[#F0F2F5]"
              >
                <span className="text-[#848B98] text-[11px] uppercase">{user.role}</span>
                <span className="text-[11px] text-[#9AA2B2]">|</span>
                <span className="text-[11px]">
                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 text-[#16A34A]" />
                ) : (
                  <Copy className="w-3 h-3 text-[#848B98]" />
                )}
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                title="Disconnect session"
                className="p-1.5 rounded border border-[#232732] bg-[#14171E] text-[#848B98] hover:text-[#F0F2F5] hover:border-[#3B4252] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded border border-[#232732] bg-[#14171E] text-[#F0F2F5] hover:border-[#2563EB] transition-colors text-xs"
            >
              Connect Wallet
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}
