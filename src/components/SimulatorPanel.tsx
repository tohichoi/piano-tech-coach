import React, { useState } from 'react';
import { Play, Square, Volume2, Sliders } from 'lucide-react';

interface SimulatorPanelProps {
  onSimulate: (accuracy: number) => void;
  onPlayAudio: () => void;
  onStopAudio: () => void;
  isPlayingAudio: boolean;
  hasData: boolean;
  disabled: boolean;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  onSimulate,
  onPlayAudio,
  onStopAudio,
  isPlayingAudio,
  hasData,
  disabled
}) => {
  const [accuracy, setAccuracy] = useState<number>(85);

  const handleSimulate = () => {
    onSimulate(accuracy);
  };

  return (
    <div className="glass-card simulator-card">
      <div className="card-header">
        <div className="header-title">
          <Sliders className="icon-purple" size={20} />
          <h3>타이밍 시뮬레이터 (테스트용)</h3>
        </div>
      </div>
      <div className="simulator-body">
        <div className="slider-group">
          <div className="slider-info">
            <span className="slider-label">연주 정확도 (Accuracy)</span>
            <span className="slider-value">{accuracy}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={accuracy}
            onChange={(e) => setAccuracy(parseInt(e.target.value, 10))}
            className="range-input"
            disabled={disabled || isPlayingAudio}
          />
          <div className="presets-row">
            <button onClick={() => setAccuracy(95)} disabled={disabled || isPlayingAudio}>우수 (95%)</button>
            <button onClick={() => setAccuracy(80)} disabled={disabled || isPlayingAudio}>보통 (80%)</button>
            <button onClick={() => setAccuracy(50)} disabled={disabled || isPlayingAudio}>미흡 (50%)</button>
            <button onClick={() => setAccuracy(20)} disabled={disabled || isPlayingAudio}>엉망 (20%)</button>
          </div>
        </div>

        <div className="simulator-controls-row">
          <button
            className="btn-primary simulate-btn"
            onClick={handleSimulate}
            disabled={disabled || isPlayingAudio}
          >
            <Play size={16} />
            <span>시뮬레이션 연주 데이터 생성</span>
          </button>

          {hasData && (
            <button
              className={`btn-secondary play-audio-btn ${isPlayingAudio ? 'muted' : ''}`}
              onClick={isPlayingAudio ? onStopAudio : onPlayAudio}
              disabled={disabled}
            >
              {isPlayingAudio ? <Square size={16} /> : <Volume2 size={16} />}
              <span>{isPlayingAudio ? '듣기 중지' : '시뮬레이션 연주 듣기'}</span>
            </button>
          )}
        </div>
        <p className="simulator-tip">
          💡 연주 데이터를 생성한 후, <strong>'연주 듣기'</strong> 버튼을 클릭하면 메트로놈 소리와 함께 정확도별 시간 편차가 반영된 연주 음을 감상할 수 있습니다.
        </p>
      </div>
    </div>
  );
};
export default SimulatorPanel;
