import type { ExpectedNote } from './midiParser';

export interface PlayedNote {
  pitch: number;
  time: number; // in seconds relative to test start
  velocity: number;
  duration?: number; // duration in seconds for playback simulation
}

export interface NoteDeviation {
  pitch: number;
  expectedTime: number; // in seconds from selection start
  playedTime: number | null; // in seconds from selection start, null if missed
  deviationMs: number | null; // playedTime - expectedTime in ms, null if missed
  rating: 'perfect' | 'good' | 'poor' | 'missed';
  measure: number;
  step: number;
}

export interface AnalysisReport {
  score: number;        // Overall score (0-100)
  evennessScore: number; // Rhythmic consistency score (0-100)
  accuracyScore: number; // Metronome sync score (0-100)
  perfectCount: number;
  goodCount: number;
  poorCount: number;
  missedCount: number;
  deviations: NoteDeviation[];
}

// Timing rating thresholds (in milliseconds)
const PERFECT_WINDOW = 35; // ms
const GOOD_WINDOW = 80;    // ms
const POOR_WINDOW = 180;   // ms

export function analyzeTiming(
  expectedNotes: ExpectedNote[],
  playedNotes: PlayedNote[],
  bpm: number,
  startMeasure: number,
  endMeasure: number,
  stepsPerMeasure: number = 16,
  elapsedTime?: number // optional elapsed time in seconds for real-time incremental scoring
): AnalysisReport {
  const stepsPerBeat = 4; // 16th notes per beat in 4/4 (L:1/16)
  const secondsPerBeat = 60 / bpm;
  const secondsPerStep = secondsPerBeat / stepsPerBeat; // 16th note length in seconds

  const startStep = startMeasure * stepsPerMeasure;
  const endStep = (endMeasure + 1) * stepsPerMeasure;

  // Filter expected notes for the selected range and normalize their expected times
  const selectedExpected = expectedNotes
    .filter(n => n.step >= startStep && n.step < endStep)
    .map(n => ({
      ...n,
      // expected time relative to selection start
      relTime: (n.step - startStep) * secondsPerStep
    }))
    .sort((a, b) => a.relTime - b.relTime);

  if (selectedExpected.length === 0) {
    return {
      score: 0,
      evennessScore: 0,
      accuracyScore: 0,
      perfectCount: 0,
      goodCount: 0,
      poorCount: 0,
      missedCount: 0,
      deviations: []
    };
  }

  // Greedy match played notes to expected notes
  const deviations: NoteDeviation[] = [];
  const matchedPlayedIndices = new Set<number>();

  let perfectCount = 0;
  let goodCount = 0;
  let poorCount = 0;
  let missedCount = 0;

  selectedExpected.forEach(exp => {
    // If real-time analysis is active, ignore notes in the future
    if (elapsedTime !== undefined && exp.relTime > elapsedTime + POOR_WINDOW / 1000) {
      return; // continue (skip future notes)
    }

    // Find closest played note of same pitch that hasn't been matched yet
    let bestMatchIdx = -1;
    let minDiff = Infinity;

    playedNotes.forEach((played, idx) => {
      if (matchedPlayedIndices.has(idx)) return;
      if (played.pitch !== exp.pitch) return;

      const diff = Math.abs(played.time - exp.relTime);
      if (diff < minDiff && diff < POOR_WINDOW / 1000) {
        minDiff = diff;
        bestMatchIdx = idx;
      }
    });

    if (bestMatchIdx !== -1) {
      matchedPlayedIndices.add(bestMatchIdx);
      const played = playedNotes[bestMatchIdx];
      const deviationSec = played.time - exp.relTime;
      const deviationMs = Math.round(deviationSec * 1000);
      const absDevMs = Math.abs(deviationMs);

      let rating: NoteDeviation['rating'] = 'poor';
      if (absDevMs <= PERFECT_WINDOW) {
        rating = 'perfect';
        perfectCount++;
      } else if (absDevMs <= GOOD_WINDOW) {
        rating = 'good';
        goodCount++;
      } else {
        rating = 'poor';
        poorCount++;
      }

      deviations.push({
        pitch: exp.pitch,
        expectedTime: exp.relTime,
        playedTime: played.time,
        deviationMs,
        rating,
        measure: exp.measure,
        step: exp.step
      });
    } else {
      // Missed note
      // If real-time analysis is active, check if the timing window is closed
      if (elapsedTime !== undefined && exp.relTime >= elapsedTime - POOR_WINDOW / 1000) {
        return; // continue (wait for potential input)
      }

      missedCount++;
      deviations.push({
        pitch: exp.pitch,
        expectedTime: exp.relTime,
        playedTime: null,
        deviationMs: null,
        rating: 'missed',
        measure: exp.measure,
        step: exp.step
      });
    }
  });

  // Calculate Grid Accuracy Score
  // Every note receives a score from 0-100 depending on deviation. Missed is 0.
  const accuracyScores = deviations.map(d => {
    if (d.deviationMs === null) return 0;
    const absDev = Math.abs(d.deviationMs);
    if (absDev <= PERFECT_WINDOW) return 100;
    if (absDev >= POOR_WINDOW) return 20;
    // Linear scale between PERFECT and POOR
    const ratio = (absDev - PERFECT_WINDOW) / (POOR_WINDOW - PERFECT_WINDOW);
    return Math.max(20, Math.round(100 - ratio * 80));
  });
  const accuracyScore = accuracyScores.length > 0 
    ? Math.round(accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length)
    : 0;

  // Calculate Even-Time Consistency Score (Rhythmic Evenness)
  // Look at time intervals between consecutive played notes
  // Filter deviations that were actually played and sort by playedTime
  const playedNotesSorted = deviations
    .filter(d => d.playedTime !== null)
    .sort((a, b) => (a.playedTime as number) - (b.playedTime as number));

  let evennessScore = 0;
  if (playedNotesSorted.length >= 2) {
    const intervals: number[] = [];
    const expectedIntervals: number[] = [];

    for (let i = 1; i < playedNotesSorted.length; i++) {
      const actualDelta = (playedNotesSorted[i].playedTime as number) - (playedNotesSorted[i - 1].playedTime as number);
      const expectedDelta = playedNotesSorted[i].expectedTime - playedNotesSorted[i - 1].expectedTime;
      
      // Avoid division by zero if two expected notes start at the same tick (e.g. chord notes)
      if (expectedDelta > 0.001) {
        intervals.push(actualDelta);
        expectedIntervals.push(expectedDelta);
      }
    }

    if (intervals.length > 0) {
      // Calculate ratios actual_interval / expected_interval
      const ratios = intervals.map((val, idx) => val / expectedIntervals[idx]);
      const meanRatio = ratios.reduce((sum, val) => sum + val, 0) / ratios.length;
      
      // Standard deviation of ratios
      const variance = ratios.reduce((sum, val) => sum + Math.pow(val - meanRatio, 2), 0) / ratios.length;
      const stdDev = Math.sqrt(variance);

      // Score formula: perfect evenness is stdDev = 0 -> 100 points
      // stdDev = 0.25 (average 25% spacing error) -> 0 points
      evennessScore = Math.max(0, Math.round(100 * (1 - 4 * stdDev)));
    } else {
      evennessScore = 0;
    }
  } else if (playedNotesSorted.length === 1 && selectedExpected.length === 1) {
    // If only one note is expected and they played it, evenness is perfect
    evennessScore = 100;
  } else {
    evennessScore = 0;
  }

  // Weight final score: 60% evenness, 40% absolute grid accuracy
  // Evenness is prioritized for piano technique coach, as playing evenly is the main focus.
  const score = Math.round(0.6 * evennessScore + 0.4 * accuracyScore);

  return {
    score,
    evennessScore,
    accuracyScore,
    perfectCount,
    goodCount,
    poorCount,
    missedCount,
    deviations
  };
}
