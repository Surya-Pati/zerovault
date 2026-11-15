export type TimeoutMode = 'DEAD_MANS_SWITCH' | 'BUYER_RECLAIM';
export type TimeoutStatus = 'ACTIVE' | 'PAUSED' | 'TIMEOUT_REACHED';

export interface TimeoutCalculationInput {
  baseTimeoutSeconds: number;       // COMMIT_TIMEOUT or RECLAIM_TIMEOUT (in seconds)
  startTimestamp: number;           // commitTimestamp or bountyLockedAt (unix seconds)
  pauseOffset: number;              // escrow.pauseOffset (unix seconds)
  totalPausedTime: number;          // contract.totalPausedTime() (unix seconds)
  isPaused: boolean;                // contract.paused()
  pausedAt?: number;                // contract.pausedAt() (unix seconds)
  currentTimestamp?: number;        // unix seconds (defaults to Math.floor(Date.now() / 1000))
}

export interface EscrowTimeoutCalculation {
  status: TimeoutStatus;
  activeElapsedSeconds: number;
  timeRemainingSeconds: number;
  progressPercent: number;
  effectiveDeadline: number;        // unix seconds
  effectivePauseDuration: number;   // total dilated pause seconds
  isTimeoutReached: boolean;
  canExecuteAction: boolean;        // isTimeoutReached && !isPaused
  formattedRemaining: string;       // "DD:HH:MM:SS" or "MM:SS"
}

/**
 * Calculates the exact real-time cryptographic timeout state for ZeroVault escrows.
 * Preserves the smart contract's clock dilation and pause-freezing invariants.
 */
export function calculateEscrowTimeoutState(
  input: TimeoutCalculationInput
): EscrowTimeoutCalculation {
  const {
    baseTimeoutSeconds,
    startTimestamp,
    pauseOffset,
    totalPausedTime,
    isPaused,
    pausedAt,
    currentTimestamp,
  } = input;

  const now = currentTimestamp !== undefined 
    ? currentTimestamp 
    : Math.floor(Date.now() / 1000);

  // 0. Explicitly handle unstarted or uncommitted timestamps
  if (!startTimestamp || startTimestamp <= 0) {
    return {
      status: 'ACTIVE',
      activeElapsedSeconds: 0,
      timeRemainingSeconds: baseTimeoutSeconds,
      progressPercent: 0,
      effectiveDeadline: 0,
      effectivePauseDuration: 0,
      isTimeoutReached: false,
      canExecuteAction: false,
      formattedRemaining: formatTimeoutCountdown(baseTimeoutSeconds),
    };
  }

  // 1. Calculate historical accumulated pause duration since this escrow phase started
  const accumulatedPause = Math.max(0, totalPausedTime - pauseOffset);

  // 2. If the contract is actively paused right now, calculate live pause elapsed since pausedAt
  const activePause = (isPaused && pausedAt && pausedAt > 0 && now >= pausedAt)
    ? (now - pausedAt)
    : 0;

  // 3. Total pause dilation added to this escrow's timeline
  const effectivePauseDuration = accumulatedPause + activePause;

  // 4. Wall-clock elapsed seconds since phase start
  const wallClockElapsed = Math.max(0, now - startTimestamp);

  // 5. Active non-paused elapsed seconds
  const activeElapsedSeconds = Math.max(0, wallClockElapsed - effectivePauseDuration);

  // 6. Time remaining in active seconds before timeout reaches 0
  const timeRemainingSeconds = Math.max(0, baseTimeoutSeconds - activeElapsedSeconds);

  // 7. Linear progress percentage (0 - 100)
  const progressPercent = baseTimeoutSeconds > 0
    ? Math.min(100, Math.max(0, (activeElapsedSeconds / baseTimeoutSeconds) * 100))
    : 100;

  // 8. Effective wall-clock timestamp when timeout lapses
  const effectiveDeadline = startTimestamp + baseTimeoutSeconds + effectivePauseDuration;

  // 9. Status and authorization flags
  const isTimeoutReached = activeElapsedSeconds >= baseTimeoutSeconds;
  // Smart contracts require block.timestamp > deadline (strict inequality).
  // At block.timestamp == deadline, ZeroVault.sol reverts with TimeoutNotReached().
  const canExecuteAction = activeElapsedSeconds > baseTimeoutSeconds && !isPaused;

  let status: TimeoutStatus = 'ACTIVE';
  if (isPaused) {
    status = 'PAUSED';
  } else if (isTimeoutReached) {
    status = 'TIMEOUT_REACHED';
  }

  // 10. Human-readable formatted string
  const formattedRemaining = formatTimeoutCountdown(timeRemainingSeconds);

  return {
    status,
    activeElapsedSeconds,
    timeRemainingSeconds,
    progressPercent,
    effectiveDeadline,
    effectivePauseDuration,
    isTimeoutReached,
    canExecuteAction,
    formattedRemaining,
  };
}

/**
 * Formats a duration in seconds into an institutional-grade digital countdown string.
 * Formats as "MM:SS", "HH:MM:SS", or "DDd HH:MM:SS".
 */
export function formatTimeoutCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const secondsInt = Math.floor(totalSeconds);

  const days = Math.floor(secondsInt / 86400);
  const hours = Math.floor((secondsInt % 86400) / 3600);
  const minutes = Math.floor((secondsInt % 3600) / 60);
  const seconds = secondsInt % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) {
    return `${pad(days)}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}
