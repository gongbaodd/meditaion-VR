import { describe, expect, it } from 'vitest';
import { cycle, measure, newGate, newSample, palmFrame, stepGate, type V } from './palm.js';

const v = (x = 0, y = 0, z = 0): V => ({ x, y, z });

describe('palmFrame', () => {
  // Hand held flat in front, fingers pointing -Z. Left thumb is on +X, right thumb on -X.
  it('left palm down faces -Y, pinky side is -X', () => {
    const n = v();
    const s = v();
    palmFrame(v(0, 1, 0), v(0.03, 1, -0.08), v(-0.03, 1, -0.07), 'left', n, s);
    expect(n.y).toBeCloseTo(-1, 5);
    expect(s.x).toBeLessThan(-0.9);
  });
  it('right palm down faces -Y, pinky side is +X', () => {
    const n = v();
    const s = v();
    palmFrame(v(0, 1, 0), v(-0.03, 1, -0.08), v(0.03, 1, -0.07), 'right', n, s);
    expect(n.y).toBeCloseTo(-1, 5);
    expect(s.x).toBeGreaterThan(0.9);
  });
  it('flipping the hand over flips the normal', () => {
    const n = v();
    palmFrame(v(0, 1, 0), v(-0.03, 1, -0.08), v(0.03, 1, -0.07), 'left', n, v());
    expect(n.y).toBeCloseTo(1, 5);
  });
});

describe('stepGate', () => {
  const head = v(0, 1.2, 0);
  const fwd = v(0, 0, -1);
  const sampleAt = (palm: V, normal: V) => {
    const s = newSample();
    measure(palm, normal, head, fwd, s);
    return s;
  };
  // Palm 0.4 m ahead of the face, normal pointing back at the head.
  const facing = () => sampleAt(v(0, 1.2, -0.4), v(0, 0, 1));
  const away = () => sampleAt(v(0, 1.2, -0.4), v(0, 0, -1));
  const kneePalmUp = () => sampleAt(v(0.2, 0.5, -0.2), v(0, 1, 0));

  it('opens when the palm faces the head', () => {
    const g = newGate();
    expect(stepGate(g, facing(), 0.016, 0)).toBe(true);
  });
  it('stays closed when the palm faces away', () => {
    const g = newGate();
    expect(stepGate(g, away(), 0.016, 0)).toBe(false);
  });
  it('stays closed for a palm-up hand resting on the knee', () => {
    const g = newGate();
    for (let i = 0; i < 100; i++) expect(stepGate(g, kneePalmUp(), 0.016, 0.6)).toBe(false);
  });
  it('needs the dwell time before opening, and resets if interrupted', () => {
    const g = newGate();
    expect(stepGate(g, facing(), 0.3, 0.6)).toBe(false);
    expect(stepGate(g, away(), 0.1, 0.6)).toBe(false);
    expect(stepGate(g, facing(), 0.3, 0.6)).toBe(false);
    expect(stepGate(g, facing(), 0.4, 0.6)).toBe(true);
  });
  it('has hysteresis: stays open at 50° but would not open there', () => {
    const a = (50 * Math.PI) / 180;
    const tilted = () => sampleAt(v(0, 1.2, -0.4), v(Math.sin(a), 0, Math.cos(a)));
    const closed = newGate();
    expect(stepGate(closed, tilted(), 0.016, 0)).toBe(false);
    const open = newGate();
    stepGate(open, facing(), 0.016, 0);
    expect(stepGate(open, tilted(), 0.016, 0)).toBe(true);
  });
  it('closes when the palm is lowered past the hold limit', () => {
    const g = newGate();
    stepGate(g, facing(), 0.016, 0);
    expect(stepGate(g, away(), 0.016, 0)).toBe(false);
  });
  it('holds through a short tracking loss then closes', () => {
    const g = newGate();
    stepGate(g, facing(), 0.016, 0);
    const lost = newSample();
    expect(stepGate(g, lost, 0.3, 0)).toBe(true);
    expect(stepGate(g, lost, 0.3, 0)).toBe(false);
  });
  it('is closed when too close or too far', () => {
    const g = newGate();
    expect(stepGate(g, sampleAt(v(0, 1.2, -0.05), v(0, 0, 1)), 0.016, 0)).toBe(false);
    expect(stepGate(g, sampleAt(v(0, 1.2, -1.2), v(0, 0, 1)), 0.016, 0)).toBe(false);
  });
  it('controllers skip the palm test', () => {
    const s = newSample();
    measure(v(0, 1.2, -0.4), null, head, fwd, s);
    expect(s.palmAngle).toBe(0);
    expect(stepGate(newGate(), s, 0.016, 0)).toBe(true);
  });
});

describe('cycle', () => {
  it('wraps both ways', () => {
    expect(cycle([1, 2, 3], 3, 1)).toBe(1);
    expect(cycle([1, 2, 3], 1, -1)).toBe(3);
  });
});
