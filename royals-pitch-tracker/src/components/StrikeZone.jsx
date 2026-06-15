import { useState, useEffect } from 'react';
import styles from './StrikeZone.module.css';

const PITCH_COLORS = {
  FB: '#dc2626',
  OS: '#f59e0b',
  CB: '#2563eb',
  SL: '#ea580c',
  CH: '#9333ea',
  CT: '#ca8a04',
  SK: '#0891b2',
  SV: '#7c3aed',
  SW: '#db2777',
  SP: '#059669',
  OT: '#64748b',
  UN: '#94a3b8',
};

const SZ_X = 165;
const SZ_Y = 120;
const SZ_W = 150;
const SZ_H = 180;
const SVG_W = 480;
const SVG_H = 420;

function svgToNormalized(svgX, svgY) {
  const x = ((svgX - SZ_X) / SZ_W) * 2 - 1;
  const y = -(((svgY - SZ_Y) / SZ_H) * 2 - 1);
  return { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) };
}

function normalizedToSvg(nx, ny) {
  const svgX = ((nx + 1) / 2) * SZ_W + SZ_X;
  const svgY = ((-ny + 1) / 2) * SZ_H + SZ_Y;
  return { svgX, svgY };
}

// Display coordinates: x in [-1,1] across zone, y in [0,1] bottom-to-top of zone
function svgToDisplayCoords(svgX, svgY) {
  const x = ((svgX - SZ_X) / SZ_W) * 2 - 1;
  const y = 1 - (svgY - SZ_Y) / SZ_H;
  return { x: parseFloat(x.toFixed(4)), y: parseFloat(y.toFixed(4)) };
}

function getSvgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}


export default function StrikeZone({ onLocationSet, onDotClick, pitchType, locationX, locationY, batterSide }) {
  const [dot, setDot] = useState(
    locationX != null && locationY != null
      ? normalizedToSvg(locationX, locationY)
      : null
  );
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (locationX == null || locationY == null) {
      setDot(null);
    } else {
      setDot(normalizedToSvg(locationX, locationY));
    }
  }, [locationX, locationY]);

  function handleClick(e) {
    const svgPt = getSvgPoint(e.currentTarget, e);
    setDot({ svgX: svgPt.x, svgY: svgPt.y });
    const norm = svgToNormalized(svgPt.x, svgPt.y);
    onLocationSet(norm.x, norm.y);
  }

  function handleMouseMove(e) {
    const svgPt = getSvgPoint(e.currentTarget, e);
    setHover({ svgX: svgPt.x, svgY: svgPt.y });
  }

  function handleMouseLeave() {
    setHover(null);
  }

  const color = PITCH_COLORS[pitchType] || PITCH_COLORS.OT;

  const COORD_W = 112;
  const COORD_H = 22;
  const COORD_X = SVG_W - COORD_W - 4;
  const COORD_Y = SVG_H - COORD_H - 4;
  const hoverCoords = hover ? svgToDisplayCoords(hover.svgX, hover.svgY) : null;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      className={styles.svg}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background */}
      <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#f8fafc" />

      {/* Outer frame */}
      <rect x="120" y="60" width="240" height="320" stroke="#e2e8f0" fill="none" strokeWidth="1" />

      {/* Strike zone */}
      <rect
        x={SZ_X} y={SZ_Y}
        width={SZ_W} height={SZ_H}
        stroke="#2563eb" strokeWidth="1.5" fill="rgba(37,99,235,0.04)"
      />

      {/* 3x3 grid lines inside zone */}
      <line x1={SZ_X + SZ_W / 3}       y1={SZ_Y} x2={SZ_X + SZ_W / 3}       y2={SZ_Y + SZ_H} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={SZ_X + (SZ_W / 3) * 2} y1={SZ_Y} x2={SZ_X + (SZ_W / 3) * 2} y2={SZ_Y + SZ_H} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={SZ_X} y1={SZ_Y + SZ_H / 3}       x2={SZ_X + SZ_W} y2={SZ_Y + SZ_H / 3}       stroke="#e2e8f0" strokeWidth="1" />
      <line x1={SZ_X} y1={SZ_Y + (SZ_H / 3) * 2} x2={SZ_X + SZ_W} y2={SZ_Y + (SZ_H / 3) * 2} stroke="#e2e8f0" strokeWidth="1" />

      {/* Labels */}
      <text x={SVG_W / 2} y="50"          textAnchor="middle" fontSize="14" fill="#475569" fontFamily="IBM Plex Sans, sans-serif" fontWeight="800" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>HIGH</text>
      <text x={SVG_W / 2} y="396"         textAnchor="middle" fontSize="14" fill="#475569" fontFamily="IBM Plex Sans, sans-serif" fontWeight="800" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>LOW</text>
      <text x="60"        y={SVG_H / 2 + 4} textAnchor="middle" fontSize="14" fill="#475569" fontFamily="IBM Plex Sans, sans-serif" fontWeight="800" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>IN</text>
      <text x={SVG_W - 60} y={SVG_H / 2 + 4} textAnchor="middle" fontSize="14" fill="#475569" fontFamily="IBM Plex Sans, sans-serif" fontWeight="800" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>OUT</text>

      {/* Coordinate display — fixed bottom-right corner */}
      {hoverCoords && (
        <>
          <rect x={COORD_X} y={COORD_Y} width={COORD_W} height={COORD_H} rx="3" fill="rgba(15,23,42,0.82)" />
          <text
            x={COORD_X + COORD_W / 2}
            y={COORD_Y + 14}
            textAnchor="middle"
            fontSize="11"
            fill="white"
            fontFamily="'IBM Plex Mono', monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {hoverCoords.x.toFixed(4)}, {hoverCoords.y.toFixed(4)}
          </text>
        </>
      )}

      {/* Baseball dot — click to open outcome panel */}
      {dot && (() => {
        const cx = dot.svgX;
        const cy = dot.svgY;
        const r = 10;
        return (
          <g onClick={(e) => { e.stopPropagation(); onDotClick?.(); }} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={r} fill="white" stroke="#94a3b8" strokeWidth="1" />
            <path
              d={`M ${cx - r*0.22},${cy - r*0.78} C ${cx - r*0.82},${cy - r*0.3} ${cx - r*0.82},${cy + r*0.3} ${cx - r*0.22},${cy + r*0.78}`}
              fill="none" stroke="#dc2626" strokeWidth="0.9" strokeLinecap="round"
              strokeDasharray="1.8 1.4"
            />
            <path
              d={`M ${cx + r*0.22},${cy - r*0.78} C ${cx + r*0.82},${cy - r*0.3} ${cx + r*0.82},${cy + r*0.3} ${cx + r*0.22},${cy + r*0.78}`}
              fill="none" stroke="#dc2626" strokeWidth="0.9" strokeLinecap="round"
              strokeDasharray="1.8 1.4"
            />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize="4.5" fontWeight="700" fill="#475569"
              fontFamily="IBM Plex Sans, sans-serif"
              style={{ letterSpacing: '0.04em', pointerEvents: 'none', userSelect: 'none' }}>
              pitch
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
