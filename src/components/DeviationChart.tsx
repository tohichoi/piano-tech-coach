import React from 'react';
import { Activity } from 'lucide-react';
import type { NoteDeviation } from '../utils/timeAnalyzer';

interface DeviationChartProps {
  deviations: NoteDeviation[];
}

export const DeviationChart: React.FC<DeviationChartProps> = ({ deviations }) => {
  if (deviations.length === 0) {
    return (
      <div className="glass-card deviation-chart-panel empty">
        <div className="card-header">
          <div className="header-title">
            <Activity className="icon-purple" size={20} />
            <h3>실시간 타이밍 편차 그래프</h3>
          </div>
        </div>
        <div className="chart-empty-body">
          <p>연주 연습을 마치면 노트별 타이밍 오차(밀리초)가 여기에 그래프로 표시됩니다.</p>
        </div>
      </div>
    );
  }

  // Chart configuration
  const width = 800;
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const centerY = paddingY + chartHeight / 2;
  
  // Maximum deviation to display (cap at 150ms)
  const maxDevMs = 150;

  // Filter out overlapping notes or just map them in order of occurrence
  const notesCount = deviations.length;

  return (
    <div className="glass-card deviation-chart-panel">
      <div className="card-header">
        <div className="header-title">
          <Activity className="icon-purple" size={20} />
          <h3>타이밍 오차 편차 그래프 (Timing Deviation Chart)</h3>
        </div>
      </div>

      <div className="chart-body">
        <div className="svg-container">
          <svg viewBox={`0 0 ${width} ${height}`} className="deviation-svg" width="100%">
            {/* Definitions for Glow Filters */}
            <defs>
              <filter id="glow-perfect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-good" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Y Axis Grid Lines */}
            {/* +100ms Late */}
            <line
              x1={paddingX}
              y1={centerY - (100 / maxDevMs) * (chartHeight / 2)}
              x2={width - paddingX}
              y2={centerY - (100 / maxDevMs) * (chartHeight / 2)}
              className="grid-line dashed"
            />
            <text x={paddingX - 10} y={centerY - (100 / maxDevMs) * (chartHeight / 2) + 4} className="grid-label text-right">
              +100ms
            </text>

            {/* +35ms Boundary */}
            <line
              x1={paddingX}
              y1={centerY - (35 / maxDevMs) * (chartHeight / 2)}
              x2={width - paddingX}
              y2={centerY - (35 / maxDevMs) * (chartHeight / 2)}
              className="grid-line boundary"
            />

            {/* 0ms Center Line (Perfect Grid) */}
            <line
              x1={paddingX}
              y1={centerY}
              x2={width - paddingX}
              y2={centerY}
              className="grid-line center-axis"
            />
            <text x={paddingX - 10} y={centerY + 4} className="grid-label text-right center-label">
              0ms
            </text>

            {/* -35ms Boundary */}
            <line
              x1={paddingX}
              y1={centerY + (35 / maxDevMs) * (chartHeight / 2)}
              x2={width - paddingX}
              y2={centerY + (35 / maxDevMs) * (chartHeight / 2)}
              className="grid-line boundary"
            />

            {/* -100ms Early */}
            <line
              x1={paddingX}
              y1={centerY + (100 / maxDevMs) * (chartHeight / 2)}
              x2={width - paddingX}
              y2={centerY + (100 / maxDevMs) * (chartHeight / 2)}
              className="grid-line dashed"
            />
            <text x={paddingX - 10} y={centerY + (100 / maxDevMs) * (chartHeight / 2) + 4} className="grid-label text-right">
              -100ms
            </text>

            {/* Axis Label (Late/Early direction indicator) */}
            <text x={width - paddingX + 15} y={centerY - 40} className="axis-direction-label late-label" transform={`rotate(90, ${width - paddingX + 15}, ${centerY - 40})`}>
              LATE (느림) ➜
            </text>
            <text x={width - paddingX + 15} y={centerY + 40} className="axis-direction-label early-label" transform={`rotate(90, ${width - paddingX + 15}, ${centerY + 40})`}>
              💡 EARLY (빠름) ➜
            </text>

            {/* Plot Note Deviations */}
            {deviations.map((dev, idx) => {
              // Calculate horizontal spacing
              // If there's only 1 note, draw in center
              const x = notesCount > 1 
                ? paddingX + (idx / (notesCount - 1)) * chartWidth 
                : paddingX + chartWidth / 2;

              if (dev.deviationMs === null) {
                // Missed note - draw at the very bottom
                const yMissed = centerY + (chartHeight / 2);
                return (
                  <g key={idx}>
                    {/* Vertical connector line */}
                    <line x1={x} y1={centerY} x2={x} y2={yMissed} className="connector-line missed" />
                    {/* Missed Note X symbol */}
                    <path
                      d={`M ${x - 4} ${yMissed - 4} L ${x + 4} ${yMissed + 4} M ${x + 4} ${yMissed - 4} L ${x - 4} ${yMissed + 4}`}
                      className="dot-symbol missed"
                    />
                  </g>
                );
              }

              // Clamp deviation to maxDevMs
              const clampedDev = Math.max(-maxDevMs, Math.min(maxDevMs, dev.deviationMs));
              
              // Calculate Y position: positive is late (draw above center, i.e., subtract from centerY)
              // negative is early (draw below center, i.e., add to centerY)
              const y = centerY - (clampedDev / maxDevMs) * (chartHeight / 2);
              
              const ratingClass = dev.rating; // 'perfect' | 'good' | 'poor'
              const filterVal = ratingClass === 'perfect' ? 'url(#glow-perfect)' : ratingClass === 'good' ? 'url(#glow-good)' : undefined;

              return (
                <g key={idx}>
                  {/* Vertical connector line (Lollipop stick) */}
                  <line
                    x1={x}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    className={`connector-line ${ratingClass}`}
                  />
                  {/* Keystroke Dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={ratingClass === 'perfect' ? 5.5 : 4.5}
                    className={`dot-symbol ${ratingClass}`}
                    filter={filterVal}
                  >
                    <title>
                      Pitch: {dev.pitch}, Error: {dev.deviationMs}ms ({dev.rating.toUpperCase()})
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="chart-legend">
          <span className="legend-item"><span className="line perfect" />Perfect (±35ms)</span>
          <span className="legend-item"><span className="line good" />Good (±80ms)</span>
          <span className="legend-item"><span className="line poor" />Poor (±150ms)</span>
          <span className="legend-item"><span className="line missed" />Missed (놓침)</span>
        </div>
      </div>
    </div>
  );
};
