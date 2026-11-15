import {
  calculateEscrowTimeoutState,
  formatTimeoutCountdown,
  TimeoutCalculationInput
} from './escrowTimeout';

describe('Escrow Timeout & Pause-Dilation Calculation Engine', () => {
  describe('calculateEscrowTimeoutState', () => {
    it('accurately computes active elapsed, remaining time, and progress for an active countdown', () => {
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 60,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: false,
        currentTimestamp: 1025
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.status).toBe('ACTIVE');
      expect(result.activeElapsedSeconds).toBe(25);
      expect(result.timeRemainingSeconds).toBe(35);
      expect(result.progressPercent).toBeCloseTo(41.67, 1);
      expect(result.effectivePauseDuration).toBe(0);
      expect(result.isTimeoutReached).toBe(false);
      expect(result.canExecuteAction).toBe(false);
      expect(result.formattedRemaining).toBe('00:35');
    });

    it('marks TIMEOUT_REACHED at exact deadline but enforces strict inequality for action execution to prevent on-chain revert', () => {
      // At exact deadline (1060 == 1000 + 60), ZeroVault.sol reverts if block.timestamp <= deadline.
      // Therefore, isTimeoutReached is true, but canExecuteAction waits for activeElapsed > baseTimeout.
      const atExactDeadline: TimeoutCalculationInput = {
        baseTimeoutSeconds: 60,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: false,
        currentTimestamp: 1060
      };

      const resultExact = calculateEscrowTimeoutState(atExactDeadline);
      expect(resultExact.status).toBe('TIMEOUT_REACHED');
      expect(resultExact.timeRemainingSeconds).toBe(0);
      expect(resultExact.isTimeoutReached).toBe(true);
      expect(resultExact.canExecuteAction).toBe(false); // Protects user against TimeoutNotReached() revert

      // 1 second past deadline (1061 > 1060): action is safely authorized
      const pastDeadline = { ...atExactDeadline, currentTimestamp: 1061 };
      const resultPast = calculateEscrowTimeoutState(pastDeadline);
      expect(resultPast.canExecuteAction).toBe(true);
      expect(resultPast.formattedRemaining).toBe('00:00');
    });

    it('clamps progress to 100% and time remaining to 0s when elapsed exceeds base timeout', () => {
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 15,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: false,
        currentTimestamp: 1200
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.status).toBe('TIMEOUT_REACHED');
      expect(result.activeElapsedSeconds).toBe(200);
      expect(result.timeRemainingSeconds).toBe(0);
      expect(result.progressPercent).toBe(100);
      expect(result.isTimeoutReached).toBe(true);
      expect(result.canExecuteAction).toBe(true);
    });

    it('dilates deadline by accumulated historical pause duration (totalPausedTime - pauseOffset)', () => {
      // Base timeout is 60s. Wall-clock elapsed is 70s.
      // But contract was paused for 20s (totalPausedTime 50 - pauseOffset 30 = 20s).
      // Active elapsed should be 70 - 20 = 50s. Time remaining should be 60 - 50 = 10s.
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 60,
        startTimestamp: 1000,
        pauseOffset: 30,
        totalPausedTime: 50,
        isPaused: false,
        currentTimestamp: 1070
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.status).toBe('ACTIVE');
      expect(result.effectivePauseDuration).toBe(20);
      expect(result.activeElapsedSeconds).toBe(50);
      expect(result.timeRemainingSeconds).toBe(10);
      expect(result.isTimeoutReached).toBe(false);
      expect(result.canExecuteAction).toBe(false);
      expect(result.effectiveDeadline).toBe(1080); // 1000 start + 60 timeout + 20 pause = 1080
    });

    it('freezes the clock while contract is actively paused', () => {
      // Contract paused at 1020.
      // At currentTimestamp 1025: activePause is 5s. Wall clock elapsed = 25s. Active elapsed = 20s.
      const t1 = calculateEscrowTimeoutState({
        baseTimeoutSeconds: 60,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: true,
        pausedAt: 1020,
        currentTimestamp: 1025
      });

      // Advance wall-clock 15s to 1040 while still paused.
      const t2 = calculateEscrowTimeoutState({
        baseTimeoutSeconds: 60,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: true,
        pausedAt: 1020,
        currentTimestamp: 1040
      });

      // Both should have identical activeElapsed and timeRemaining because the clock is frozen!
      expect(t1.status).toBe('PAUSED');
      expect(t2.status).toBe('PAUSED');
      expect(t1.activeElapsedSeconds).toBe(20);
      expect(t2.activeElapsedSeconds).toBe(20);
      expect(t1.timeRemainingSeconds).toBe(40);
      expect(t2.timeRemainingSeconds).toBe(40);
      expect(t1.canExecuteAction).toBe(false);
      expect(t2.canExecuteAction).toBe(false);
    });

    it('blocks action execution (canExecuteAction = false) when paused even if timeout was reached', () => {
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 30,
        startTimestamp: 1000,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: true,
        pausedAt: 1100,
        currentTimestamp: 1110
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.status).toBe('PAUSED');
      expect(result.isTimeoutReached).toBe(true);
      expect(result.canExecuteAction).toBe(false); // Circuit breaker halts on-chain calls
    });

    it('handles clock skew gracefully when start timestamp is slightly in the future', () => {
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 60,
        startTimestamp: 1050,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: false,
        currentTimestamp: 1045 // 5s before start
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.activeElapsedSeconds).toBe(0);
      expect(result.timeRemainingSeconds).toBe(60);
      expect(result.progressPercent).toBe(0);
      expect(result.isTimeoutReached).toBe(false);
    });

    it('returns unstarted pending state when startTimestamp <= 0', () => {
      const input: TimeoutCalculationInput = {
        baseTimeoutSeconds: 60,
        startTimestamp: 0,
        pauseOffset: 0,
        totalPausedTime: 0,
        isPaused: false,
        currentTimestamp: 1045
      };

      const result = calculateEscrowTimeoutState(input);

      expect(result.status).toBe('ACTIVE');
      expect(result.activeElapsedSeconds).toBe(0);
      expect(result.timeRemainingSeconds).toBe(60);
      expect(result.progressPercent).toBe(0);
      expect(result.isTimeoutReached).toBe(false);
      expect(result.canExecuteAction).toBe(false);
      expect(result.formattedRemaining).toBe('01:00');
    });
  });

  describe('formatTimeoutCountdown', () => {
    it('formats seconds only for short intervals under 60 seconds', () => {
      expect(formatTimeoutCountdown(15)).toBe('00:15');
      expect(formatTimeoutCountdown(0)).toBe('00:00');
      expect(formatTimeoutCountdown(-5)).toBe('00:00');
      expect(formatTimeoutCountdown(NaN)).toBe('00:00');
      expect(formatTimeoutCountdown(Infinity)).toBe('00:00');
    });

    it('formats MM:SS for intervals under 1 hour', () => {
      expect(formatTimeoutCountdown(65)).toBe('01:05');
      expect(formatTimeoutCountdown(599)).toBe('09:59');
      expect(formatTimeoutCountdown(3599)).toBe('59:59');
    });

    it('formats HH:MM:SS for intervals between 1 hour and 24 hours', () => {
      expect(formatTimeoutCountdown(3600)).toBe('01:00:00');
      expect(formatTimeoutCountdown(7325)).toBe('02:02:05');
    });

    it('formats DD:HH:MM:SS for multi-day windows', () => {
      expect(formatTimeoutCountdown(86400)).toBe('01d 00:00:00');
      expect(formatTimeoutCountdown(604800)).toBe('07d 00:00:00'); // 7-day commit window
      expect(formatTimeoutCountdown(1209600)).toBe('14d 00:00:00'); // 14-day reclaim window
      expect(formatTimeoutCountdown(604800 + 3600 + 120 + 5)).toBe('07d 01:02:05');
    });
  });
});
