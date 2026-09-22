import React from 'react';
import { Play, Square, Volume2, VolumeX } from 'lucide-react';

interface MetronomeProps {
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  onStart: () => void;
  onStop: () => void;
  metronomeMuted: boolean;
  setMetronomeMuted: (muted: boolean) => void;
  countdown: number | null; // 4, 3, 2, 1 countdown beats
  isGuideEnabled: boolean;
  setIsGuideEnabled: (enabled: boolean) => void;
}

export const Metronome: React.FC<MetronomeProps> = ({
  bpm,
  setBpm,
  isPlaying,
  onStart,
  onStop,
  metronomeMuted,
  setMetronomeMuted,
  countdown,
  isGuideEnabled,
  setIsGuideEnabled,
}) => {
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setBpm(val);
    }
  };

  return (
    <div className="glass-card metronome-panel">
      <div className="card-header">
        <div className="header-title">
          <Play className="icon-purple" size={20} />
          <h3>컨트롤 및 메트로놈</h3>
        </div>
      </div>

      <div className="metronome-body">
        {/* Play / Stop buttons */}
        <div className="controls-row">
          {!isPlaying ? (
            <button className="btn-primary btn-play glow-purple" onClick={onStart}>
              <Play size={18} fill="currentColor" />
              <span>연주 연습 시작</span>
            </button>
          ) : (
            <button className="btn-danger btn-stop glow-red" onClick={onStop}>
              <Square size={18} fill="currentColor" />
              <span>연습 중지</span>
            </button>
          )}

          <button
            className={`btn-secondary btn-mute ${metronomeMuted ? 'muted' : ''}`}
            onClick={() => setMetronomeMuted(!metronomeMuted)}
            title={metronomeMuted ? '메트로놈 켜기' : '메트로놈 끄기'}
          >
            {metronomeMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* BPM Slider */}
        <div className="bpm-slider-group">
          <div className="bpm-info">
            <label className="label" htmlFor="metronome-bpm">템포 (BPM)</label>
            <span className="bpm-value">{bpm}</span>
          </div>
          <div className="slider-wrapper">
            <input
              id="metronome-bpm"
              type="range"
              min="40"
              max="240"
              value={bpm}
              onChange={handleBpmChange}
              className="range-input"
            />
            <div className="bpm-presets">
              <button onClick={() => setBpm(60)}>60</button>
              <button onClick={() => setBpm(90)}>90</button>
              <button onClick={() => setBpm(120)}>120</button>
              <button onClick={() => setBpm(150)}>150</button>
            </div>
          </div>
        </div>

        {/* Guide Melody Toggle */}
        <div className="toggle-group">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={isGuideEnabled}
              onChange={(e) => setIsGuideEnabled(e.target.checked)}
            />
            <span className="checkmark" />
            <span className="checkbox-label">가이드 멜로디 재생 (악보 소리 듣기)</span>
          </label>
        </div>

        {/* Visual Count-In Countdown Overlay */}
        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-circle animate-pulse glow-purple">
              <span className="countdown-number">{countdown}</span>
              <span className="countdown-subtext">준비하세요!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
