import type { Cue, PhaseId, Session } from './types.js';

export type RunnerState = 'idle' | 'running' | 'paused' | 'finished';

/**
 * Plays a Session's cues against a clock it advances itself.
 * No timers, no DOM: call `tick(dt)` from a frame loop (or a test).
 */
export class SessionRunner {
  state: RunnerState = 'idle';
  elapsed = 0;
  private next = 0;

  constructor(
    readonly session: Session,
    private readonly onCue: (cue: Cue) => void,
  ) {}

  start() {
    this.state = 'running';
    this.elapsed = 0;
    this.next = 0;
    this.flush();
  }

  pause() {
    if (this.state === 'running') this.state = 'paused';
  }

  resume() {
    if (this.state === 'paused') this.state = 'running';
  }

  /** Stop early. The end cue is still delivered so listeners can clean up. */
  stop() {
    if (this.state === 'finished' || this.state === 'idle') return;
    this.state = 'finished';
    this.onCue({ at: this.elapsed, kind: 'end' });
  }

  tick(dt: number) {
    if (this.state !== 'running') return;
    // Clamp huge frame gaps (tab in background, headset off) so cues aren't skipped en masse.
    this.elapsed += Math.min(Math.max(dt, 0), 0.5);
    this.flush();
  }

  get remaining() {
    return Math.max(0, this.session.duration - this.elapsed);
  }

  get phase(): PhaseId {
    const p = this.session.phases.find((x) => this.elapsed < x.end);
    return p?.id ?? 'close';
  }

  private flush() {
    const cues = this.session.cues;
    while (this.next < cues.length && cues[this.next].at <= this.elapsed) {
      const cue = cues[this.next++];
      if (cue.kind === 'end') {
        this.state = 'finished';
        this.onCue(cue);
        return;
      }
      this.onCue(cue);
    }
  }
}
