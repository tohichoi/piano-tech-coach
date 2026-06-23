import { Midi } from '@tonejs/midi';
import { parseMidiFile } from './midiParser';
import type { ParseResult } from './midiParser';

export type ExerciseType = 'scale' | 'hanon';

export function generateExercise(type: ExerciseType): ParseResult {
  const midi = new Midi();
  midi.header.name = type === 'scale' ? 'C Major Scale Exercise' : 'Hanon No. 1 Exercise';
  
  // Set BPM and Time Signature
  midi.header.setTempo(type === 'scale' ? 80 : 90);

  const trackRH = midi.addTrack();
  trackRH.name = 'Right Hand';
  
  const trackLH = midi.addTrack();
  trackLH.name = 'Left Hand';

  const ppq = midi.header.ppq; // default is 480 ticks/quarter note
  const stepTicks = ppq / 4; // 16th note is 120 ticks

  if (type === 'scale') {
    // C Major Scale up and down (16th notes)
    // RH: C4 (60) to C5 (72) and down, LH: plays chords on beat 1 of each measure
    const rhPitches = [
      60, 62, 64, 65, 67, 69, 71, 72, 74, 72, 71, 69, 67, 65, 64, 62, // Bar 1
      60, 62, 64, 65, 67, 69, 71, 72, 74, 72, 71, 69, 67, 65, 64, 62, // Bar 2
      60, 64, 67, 72, 76, 72, 67, 64, 60, 64, 67, 72, 76, 72, 67, 64, // Bar 3 (arpeggio)
      60 // Bar 4 end note
    ];

    let currentTick = 0;
    rhPitches.forEach((pitch, idx) => {
      const isLast = idx === rhPitches.length - 1;
      trackRH.addNote({
        midi: pitch,
        ticks: currentTick,
        durationTicks: isLast ? ppq * 4 : stepTicks,
        velocity: 0.7
      });
      currentTick += stepTicks;
    });

    // LH chords
    // Bar 1: C major, Bar 2: G major, Bar 3: C major, Bar 4: C major whole note
    // C Major chord (C3=48, E3=52, G3=55)
    // G Major chord (G2=43, B2=47, D3=50)
    const lhChords = [
      { ticks: 0, pitches: [48, 52, 55], dur: ppq * 4 },
      { ticks: ppq * 4, pitches: [43, 47, 50], dur: ppq * 4 },
      { ticks: ppq * 8, pitches: [48, 52, 55], dur: ppq * 4 },
      { ticks: ppq * 12, pitches: [36, 48, 52, 55], dur: ppq * 4 }
    ];

    lhChords.forEach(chord => {
      chord.pitches.forEach(pitch => {
        trackLH.addNote({
          midi: pitch,
          ticks: chord.ticks,
          durationTicks: chord.dur,
          velocity: 0.6
        });
      });
    });

  } else {
    // Hanon No. 1 Pattern
    // RH Pattern starting at P: P, P+4, P+5, P+6, P+7, P+6, P+5, P+4 (each 16th note)
    // LH Pattern starting at P-12 (octave lower): same structure
    const rhStarts = [60, 62, 64, 65, 67, 69]; // progression C, D, E, F, G, A
    let currentTick = 0;

    rhStarts.forEach((startPitch) => {
      // 8 notes pattern
      const pattern = [0, 4, 5, 6, 7, 6, 5, 4];
      pattern.forEach(offset => {
        // RH Note
        trackRH.addNote({
          midi: startPitch + offset,
          ticks: currentTick,
          durationTicks: stepTicks,
          velocity: 0.7
        });

        // LH Note (Octave lower)
        trackLH.addNote({
          midi: startPitch - 12 + offset,
          ticks: currentTick,
          durationTicks: stepTicks,
          velocity: 0.7
        });

        currentTick += stepTicks;
      });
    });

    // End Chord on Bar 4, beat 1
    const endTick = currentTick;
    const rhEndPitches = [60, 64, 67, 72];
    const lhEndPitches = [36, 48, 52, 55];

    rhEndPitches.forEach(pitch => {
      trackRH.addNote({
        midi: pitch,
        ticks: endTick,
        durationTicks: ppq * 4,
        velocity: 0.8
      });
    });

    lhEndPitches.forEach(pitch => {
      trackLH.addNote({
        midi: pitch,
        ticks: endTick,
        durationTicks: ppq * 4,
        velocity: 0.8
      });
    });
  }

  // Convert Midi object to binary ArrayBuffer
  const binary = midi.toArray();
  const title = type === 'scale' ? 'scale_practice.mid' : 'hanon_practice.mid';
  
  // Parse binary data using our midiParser to get the ParseResult
  return parseMidiFile(binary.buffer as ArrayBuffer, title);
}
