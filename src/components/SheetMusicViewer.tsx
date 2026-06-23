import React, { useEffect, useRef } from 'react';
import abcjs from 'abcjs';
import { FileMusic } from 'lucide-react';
import type { ExpectedNote } from '../utils/midiParser';
import type { NoteDeviation } from '../utils/timeAnalyzer';

interface SheetMusicViewerProps {
  abcString: string;
  totalMeasures: number;
  startMeasure: number;
  setStartMeasure: (m: number) => void;
  endMeasure: number;
  setEndMeasure: (m: number) => void;
  deviations: NoteDeviation[];
  expectedNotes: ExpectedNote[];
}

export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({
  abcString,
  totalMeasures,
  startMeasure,
  setStartMeasure,
  endMeasure,
  setEndMeasure,
  deviations,
  expectedNotes,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const startMeasureRef = useRef(startMeasure);
  const endMeasureRef = useRef(endMeasure);

  // Sync refs to avoid stale closures in clickListener
  useEffect(() => { startMeasureRef.current = startMeasure; }, [startMeasure]);
  useEffect(() => { endMeasureRef.current = endMeasure; }, [endMeasure]);

  // Render sheet music whenever abcString changes
  useEffect(() => {
    if (!paperRef.current || !abcString) return;

    abcjs.renderAbc(paperRef.current, abcString, {
      responsive: 'resize',
      add_classes: true,
      scale: 1.0,
      staffwidth: 900,
      clickListener: (_abcElem, _tuneNumber, classes, analysis, _drag, mouseEvent) => {
        let clickedM: number | null = null;

        // 1. Try parsing abcjs-mmX from classes parameter first (most accurate absolute index)
        if (classes) {
          const classStr = Array.isArray(classes) ? classes.join(' ') : String(classes);
          const match = classStr.match(/abcjs-mm(\d+)/);
          if (match) {
            clickedM = parseInt(match[1], 10);
          }
        }

        // 2. Try traversing up the DOM from mouseEvent.target to find the absolute measure group (e.g. .abcjs-mmX)
        if (clickedM === null && mouseEvent && mouseEvent.target) {
          let el = mouseEvent.target as HTMLElement;
          while (el && el !== paperRef.current) {
            if (el.classList) {
              for (let i = 0; i < el.classList.length; i++) {
                const cls = el.classList.item(i);
                if (cls && cls.startsWith('abcjs-mm')) {
                  const mNum = parseInt(cls.replace('abcjs-mm', ''), 10);
                  if (!isNaN(mNum)) {
                    clickedM = mNum;
                    break;
                  }
                }
              }
            }
            if (clickedM !== null) break;
            el = el.parentElement as HTMLElement;
          }
        }

        // 3. Fallback to analysis.measureIndex if defined
        if (clickedM === null && analysis && typeof analysis.measureIndex === 'number') {
          clickedM = analysis.measureIndex;
        }

        // 4. Fallback to analysis.measure (Note: this is relative to the line in abcjs v6 if line > 0)
        if (clickedM === null && analysis && typeof analysis.measure === 'number') {
          clickedM = analysis.measure;
        }

        // 5. Ultimate fallback to relative abcjs-mX class (relative to line)
        if (clickedM === null && classes) {
          const classStr = Array.isArray(classes) ? classes.join(' ') : String(classes);
          const match = classStr.match(/abcjs-m(\d+)/);
          if (match) {
            clickedM = parseInt(match[1], 10);
          }
        }

        if (clickedM !== null) {
          const currentStart = startMeasureRef.current;
          const currentEnd = endMeasureRef.current;

          const distToStart = Math.abs(clickedM - currentStart);
          const distToEnd = Math.abs(clickedM - currentEnd);

          if (clickedM < currentStart) {
            setStartMeasure(clickedM);
          } else if (clickedM > currentEnd) {
            setEndMeasure(clickedM);
          } else {
            // Clicked inside the selection: adjust closest boundary
            if (distToStart < distToEnd) {
              setStartMeasure(clickedM);
            } else {
              setEndMeasure(clickedM);
            }
          }
        }
      },
    });

    // Reset note highlights after rendering a new song
    clearNoteHighlights();
  }, [abcString]);

  // Apply visual highlights to the selected measure range and timing results
  useEffect(() => {
    highlightSelectedMeasures();
    applyTimingHighlights();
  }, [abcString, startMeasure, endMeasure, deviations, expectedNotes]);

  const clearNoteHighlights = () => {
    if (!paperRef.current) return;
    const notes = paperRef.current.querySelectorAll('.note-perfect, .note-good, .note-poor, .note-missed');
    notes.forEach(n => {
      n.classList.remove('note-perfect', 'note-good', 'note-poor', 'note-missed');
    });
  };

  const highlightSelectedMeasures = () => {
    if (!paperRef.current) return;
    // Clear previous measure highlights
    const highlightedMeasures = paperRef.current.querySelectorAll('.measure-selected');
    highlightedMeasures.forEach(m => m.classList.remove('measure-selected'));

    // Highlight selected measures in the SVG
    for (let m = startMeasure; m <= endMeasure; m++) {
      const measureGroups = paperRef.current.querySelectorAll(`.abcjs-mm${m}`);
      measureGroups.forEach(g => {
        g.classList.add('measure-selected');
      });
    }
  };

  const applyTimingHighlights = () => {
    if (!paperRef.current || deviations.length === 0) {
      clearNoteHighlights();
      return;
    }

    clearNoteHighlights();

    // Map expected notes inside each measure to their voice index
    // Group expected notes by measure and voice to find their sequential visual index
    const noteSequenceMap: { [key: string]: number } = {}; // key: "measure_voice_pitch_step", value: sequenceIndex

    // We process Treble (pitch >= 60 -> voice 0) and Bass (pitch < 60 -> voice 1)
    for (let m = 0; m < totalMeasures; m++) {
      // Voice 0 (Treble) notes in this measure, sorted by step and pitch
      const voice0Notes = expectedNotes
        .filter(n => n.measure === m && n.pitch >= 60)
        .sort((a, b) => a.step - b.step || a.pitch - b.pitch);
      
      voice0Notes.forEach((note, idx) => {
        noteSequenceMap[`${m}_0_${note.pitch}_${note.step}`] = idx;
      });

      // Voice 1 (Bass) notes in this measure, sorted by step and pitch
      const voice1Notes = expectedNotes
        .filter(n => n.measure === m && n.pitch < 60)
        .sort((a, b) => a.step - b.step || a.pitch - b.pitch);
      
      voice1Notes.forEach((note, idx) => {
        noteSequenceMap[`${m}_1_${note.pitch}_${note.step}`] = idx;
      });
    }

    // Now loop through deviations and apply CSS class to the corresponding SVG path
    deviations.forEach(dev => {
      const voice = dev.pitch >= 60 ? 0 : 1;
      const seqIdx = noteSequenceMap[`${dev.measure}_${voice}_${dev.pitch}_${dev.step}`];
      
      if (typeof seqIdx !== 'number') return;

      // Find all note or chord elements in that measure for that voice
      // abcjs renders chords inside `.abcjs-chord` and individual notes inside `.abcjs-note`
      // We look inside the measure group `.abcjs-mm[measure]` and voice class `.abcjs-v[voice]`
      const voiceContainer = paperRef.current?.querySelector(`.abcjs-mm${dev.measure} .abcjs-v${voice}`);
      if (!voiceContainer) return;

      // Select all note and chord elements
      const noteElements = voiceContainer.querySelectorAll('.abcjs-note, .abcjs-chord');
      const targetElement = noteElements[seqIdx];

      if (targetElement) {
        targetElement.classList.add(`note-${dev.rating}`);
      }
    });
  };

  const handleStartMeasureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(totalMeasures - 1, parseInt(e.target.value, 10) - 1));
    if (!isNaN(val)) {
      setStartMeasure(val);
      if (val > endMeasure) {
        setEndMeasure(val);
      }
    }
  };

  const handleEndMeasureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(startMeasure, Math.min(totalMeasures - 1, parseInt(e.target.value, 10) - 1));
    if (!isNaN(val)) {
      setEndMeasure(val);
    }
  };

  return (
    <div className="glass-card sheet-music-panel">
      <div className="card-header">
        <div className="header-title">
          <FileMusic className="icon-purple" size={20} />
          <h3>악보 뷰어 및 연습 영역 설정</h3>
        </div>
      </div>

      <div className="sheet-music-body">
        {abcString ? (
          <>
            {/* Range Selection Inputs */}
            <div className="range-controls-row">
              <div className="range-input-group">
                <label>연습 시작 마디</label>
                <div className="number-input-wrapper">
                  <input
                    type="number"
                    min="1"
                    max={totalMeasures}
                    value={startMeasure + 1}
                    onChange={handleStartMeasureChange}
                  />
                  <span className="unit">마디</span>
                </div>
              </div>

              <div className="range-input-group">
                <label>연습 종료 마디</label>
                <div className="number-input-wrapper">
                  <input
                    type="number"
                    min={startMeasure + 1}
                    max={totalMeasures}
                    value={endMeasure + 1}
                    onChange={handleEndMeasureChange}
                  />
                  <span className="unit">마디</span>
                </div>
              </div>

              <div className="range-tip-box">
                <p>💡 악보의 특정 마디를 직접 마우스로 <strong>클릭</strong>하여 영역을 설정할 수도 있습니다.</p>
              </div>
            </div>

            {/* abcjs paper container */}
            <div className="sheet-music-scroll-container">
              <div id="abcjs-paper" ref={paperRef} className="abcjs-dark-theme" />
            </div>
            
            {/* Legend for Note Highlights */}
            {deviations.length > 0 && (
              <div className="timing-legend">
                <span className="legend-title">타이밍 결과 범례:</span>
                <span className="legend-item"><span className="dot perfect" />Perfect (≤35ms)</span>
                <span className="legend-item"><span className="dot good" />Good (≤80ms)</span>
                <span className="legend-item"><span className="dot poor" />Poor (≤180ms)</span>
                <span className="legend-item"><span className="dot missed" />Missed</span>
              </div>
            )}
          </>
        ) : (
          <div className="empty-sheet-state">
            <FileMusic size={48} className="empty-icon animate-pulse" />
            <p>연습하고 싶은 MIDI 파일을 업로드하면 악보가 여기에 나타납니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default SheetMusicViewer;
