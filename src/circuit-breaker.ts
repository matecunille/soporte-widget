/**
 * circuit-breaker.ts
 *
 * Circuit Breaker pattern for connection management.
 * Prevents infinite reconnection loops and requires manual intervention
 * after threshold failures.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
    /** Number of consecutive failures before opening circuit */
    failureThreshold: number;
    /** Reset callback when transitioning states */
    onStateChange?: (state: CircuitState, failureCount: number) => void;
}

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private readonly config: CircuitBreakerConfig;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    /**
     * Record a successful operation.
     * In HALF_OPEN state, this closes the circuit.
     * In CLOSED state, this resets the failure counter.
     */
    recordSuccess(): void {
        if (this.state === 'HALF_OPEN') {
            this.transitionTo('CLOSED');
        }
        this.failureCount = 0;
    }

    /**
     * Record a failure.
     * In CLOSED state, increments counter. If threshold reached, opens circuit.
     * In HALF_OPEN state, re-opens circuit immediately.
     */
    recordFailure(): void {
        this.failureCount++;

        if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
            this.transitionTo('OPEN');
        } else if (this.state === 'HALF_OPEN') {
            // Failed recovery attempt
            this.transitionTo('OPEN');
        }
    }

    /**
     * Manual reset attempt (user clicked retry button).
     * Only allowed when circuit is OPEN.
     */
    attemptReset(): boolean {
        if (this.state === 'OPEN') {
            this.transitionTo('HALF_OPEN');
            return true;
        }
        return false;
    }

    /**
     * Force reset - for manual reconnect or full reset.
     */
    forceReset(): void {
        this.failureCount = 0;
        this.transitionTo('CLOSED');
    }

    getState(): CircuitState {
        return this.state;
    }

    getFailureCount(): number {
        return this.failureCount;
    }

    isOpen(): boolean {
        return this.state === 'OPEN';
    }

    isHalfOpen(): boolean {
        return this.state === 'HALF_OPEN';
    }

    isClosed(): boolean {
        return this.state === 'CLOSED';
    }

    canAttemptReconnect(): boolean {
        // Can reconnect if CLOSED (normal operation) or HALF_OPEN (manual retry)
        return this.state !== 'OPEN';
    }

    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;
        
        if (newState === 'CLOSED') {
            this.failureCount = 0;
        }

        this.config.onStateChange?.(newState, this.failureCount);
        
        console.log(`[CircuitBreaker] ${oldState} → ${newState} (failures: ${this.failureCount})`);
    }
}
