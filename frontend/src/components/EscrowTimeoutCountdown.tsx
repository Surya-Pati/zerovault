"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Clock, 
  PauseCircle, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert,
  Info 
} from "lucide-react";
import { 
  calculateEscrowTimeoutState, 
  EscrowTimeoutCalculation, 
  TimeoutMode 
} from "@zerovault/shared";
import { fetchContractTimeoutConfig, ContractTimeoutConfig } from "@/lib/contracts";

export interface EscrowTimeoutCountdownProps {
  merkleRoot: string;
  mode: TimeoutMode;
  commitTimestamp?: number;
  bountyLockedAt?: number;
  pauseOffset?: number;
  onTimeoutStateChange?: (state: EscrowTimeoutCalculation) => void;
  className?: string;
  compact?: boolean;
}

export default function EscrowTimeoutCountdown({
  merkleRoot,
  mode,
  commitTimestamp = 0,
  bountyLockedAt = 0,
  pauseOffset = 0,
  onTimeoutStateChange,
  className = "",
  compact = false,
}: EscrowTimeoutCountdownProps) {
  const [config, setConfig] = useState<ContractTimeoutConfig>({
    commitTimeout: Number(process.env.NEXT_PUBLIC_COMMIT_TIMEOUT || 15),
    reclaimTimeout: Number(process.env.NEXT_PUBLIC_RECLAIM_TIMEOUT || 15),
    totalPausedTime: 0,
    isPaused: false,
    pausedAt: 0,
  });

  const [tick, setTick] = useState(0);
  const onTimeoutStateChangeRef = useRef(onTimeoutStateChange);
  onTimeoutStateChangeRef.current = onTimeoutStateChange;

  // 1. Fetch on-chain timeout parameters (polled gently every 10 seconds)
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const remoteConfig = await fetchContractTimeoutConfig();
        if (isMounted) {
          setConfig(remoteConfig);
        }
      } catch (err) {
        console.warn("Could not query contract timeout configuration:", err);
      }
    }

    loadConfig();
    const interval = setInterval(loadConfig, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [merkleRoot]);

  // 2. Client-side 1-second active ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute exact cryptographic timeout state
  const isDeadMan = mode === "DEAD_MANS_SWITCH";
  const baseTimeout = isDeadMan ? config.commitTimeout : config.reclaimTimeout;
  const startTimestamp = isDeadMan ? commitTimestamp : bountyLockedAt;
  const effectiveStart = startTimestamp > 0 ? startTimestamp : 0;

  const timeoutState = calculateEscrowTimeoutState({
    baseTimeoutSeconds: baseTimeout,
    startTimestamp: effectiveStart,
    pauseOffset,
    totalPausedTime: config.totalPausedTime,
    isPaused: config.isPaused,
    pausedAt: config.pausedAt,
    currentTimestamp: Math.floor(Date.now() / 1000),
  });

  // Notify parent component of state change
  useEffect(() => {
    if (onTimeoutStateChangeRef.current) {
      onTimeoutStateChangeRef.current(timeoutState);
    }
  }, [
    timeoutState.status, 
    timeoutState.timeRemainingSeconds, 
    timeoutState.canExecuteAction, 
    timeoutState.isTimeoutReached
  ]);

  const title = isDeadMan 
    ? "Dead Man's Switch Window" 
    : "Seller Key Reveal Window";

  const description = isDeadMan
    ? "If no buyer locks the bounty within this period, the seller can expire the vault."
    : "Seller must reveal the decryption key within this window, or buyer can reclaim their ETH.";

  if (compact) {
    return (
      <div className={`flex items-center justify-between text-xs font-mono p-2 rounded bg-[#0A0C10] border border-[#1E2330] ${className}`}>
        <div className="flex items-center gap-1.5 text-[#848B98]">
          <Clock className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{isDeadMan ? "Dead Man:" : "Reclaim in:"}</span>
        </div>
        <div className="flex items-center gap-2">
          {timeoutState.status === "PAUSED" && (
            <span className="text-[10px] text-[#F59E0B] flex items-center gap-1">
              <PauseCircle className="w-3 h-3" /> Frozen
            </span>
          )}
          <span className={`font-semibold ${timeoutState.isTimeoutReached ? "text-[#EF4444]" : "text-[#F1F5F9]"}`}>
            {timeoutState.formattedRemaining}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border border-[#1E2330] bg-[#0A0C10] space-y-3 font-mono ${className}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs font-semibold text-[#F1F5F9] tracking-wide">
            {title}
          </span>
        </div>

        {/* Live Status Badge */}
        {timeoutState.status === "PAUSED" ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-[#F59E0B]">
            <PauseCircle className="w-3 h-3 animate-pulse" />
            <span>Clock Frozen (Paused)</span>
          </div>
        ) : timeoutState.isTimeoutReached ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444]">
            <AlertTriangle className="w-3 h-3" />
            <span>Timeout Elapsed</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>Active Window</span>
          </div>
        )}
      </div>

      {/* Main Countdown Display & Metrics */}
      <div className="p-3 rounded-lg bg-[#06080A] border border-[#1E2330]/80 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">
            Time Remaining
          </span>
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className={`text-2xl font-bold tracking-tight ${
              timeoutState.status === "PAUSED"
                ? "text-[#F59E0B]"
                : timeoutState.isTimeoutReached
                ? "text-[#EF4444]"
                : "text-[#10B981]"
            }`}>
              {timeoutState.formattedRemaining}
            </span>
            <span className="text-[10px] text-[#64748B]">
              / {baseTimeout}s window
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">
            Elapsed
          </span>
          <span className="text-xs font-semibold text-[#CBD5E1] pt-0.5 block">
            {timeoutState.activeElapsedSeconds}s ({timeoutState.progressPercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div 
          role="progressbar"
          aria-valuenow={Math.round(timeoutState.progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
          className="h-2 w-full bg-[#151922] rounded-full overflow-hidden p-0.5 border border-[#1E2330]"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              timeoutState.status === "PAUSED"
                ? "bg-[#F59E0B]"
                : timeoutState.isTimeoutReached
                ? "bg-[#EF4444]"
                : "bg-gradient-to-r from-[#10B981] to-[#3B82F6]"
            }`}
            style={{ width: `${timeoutState.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Pause Dilation & Guarantee Explainer Footer */}
      <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-[#64748B]">
        {timeoutState.effectivePauseDuration > 0 ? (
          <div className="flex items-center gap-1 text-[#F59E0B]">
            <Info className="w-3 h-3" />
            <span>+{timeoutState.effectivePauseDuration}s pause dilation protected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#10B981]" />
            <span>Pause-invariant clock active</span>
          </div>
        )}
        <span className="truncate max-w-[280px]" title={description}>
          {description}
        </span>
      </div>
    </div>
  );
}
