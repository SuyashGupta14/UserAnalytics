import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Flame, Sliders, Target, Info, RefreshCw } from 'lucide-react';
import type { HeatmapPageItem, HeatmapData, HeatmapPoint } from '../api';

interface HeatmapViewerProps {
  pages: HeatmapPageItem[];
  selectedPageUrl: string;
  onSelectPage: (url: string) => void;
  heatmapData: HeatmapData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
  pages,
  selectedPageUrl,
  onSelectPage,
  heatmapData,
  loading,
  onRefresh,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<'density' | 'dots'>('density');
  const [radius, setRadius] = useState<number>(30);
  const [intensity, setIntensity] = useState<number>(0.7);
  const [hoveredPoint, setHoveredPoint] = useState<HeatmapPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Determine canvas width and height
  const points = useMemo(() => heatmapData?.points || [], [heatmapData]);

  const canvasWidth = useMemo(() => {
    if (heatmapData?.page_w && heatmapData.page_w > 0) {
      return Math.min(Math.max(heatmapData.page_w, 1200), 1920);
    }
    const maxX = points.reduce((m, p) => Math.max(m, p.x || 0), 1200);
    return Math.max(maxX + 100, 1200);
  }, [heatmapData, points]);

  const canvasHeight = useMemo(() => {
    if (heatmapData?.page_h && heatmapData.page_h > 0) {
      return Math.min(Math.max(heatmapData.page_h, 800), 3000);
    }
    const maxY = points.reduce((m, p) => Math.max(m, p.y || 0), 800);
    return Math.max(maxY + 150, 900);
  }, [heatmapData, points]);

  // Draw heatmap onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (points.length === 0) return;

    if (mode === 'density') {
      // ── Thermal Density Heatmap Renderer ────────────────────────────────
      // 1. Create offscreen alpha accumulator canvas
      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = canvasWidth;
      alphaCanvas.height = canvasHeight;
      const alphaCtx = alphaCanvas.getContext('2d');
      if (!alphaCtx) return;

      // 2. Draw radial gaussian gradients into alpha canvas
      points.forEach((pt) => {
        const rad = radius;
        const grad = alphaCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        grad.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
        grad.addColorStop(0.5, `rgba(0, 0, 0, ${intensity * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        alphaCtx.fillStyle = grad;
        alphaCtx.beginPath();
        alphaCtx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
        alphaCtx.fill();
      });

      // 3. Colorize alpha channel with thermal gradient palette
      // Pre-create 256-step thermal color lookup
      const paletteCanvas = document.createElement('canvas');
      paletteCanvas.width = 256;
      paletteCanvas.height = 1;
      const palCtx = paletteCanvas.getContext('2d');
      if (!palCtx) return;

      const palGrad = palCtx.createLinearGradient(0, 0, 256, 1);
      palGrad.addColorStop(0.0, 'rgba(0, 0, 255, 0)');
      palGrad.addColorStop(0.2, 'rgba(0, 220, 255, 0.5)');
      palGrad.addColorStop(0.4, 'rgba(0, 255, 128, 0.7)');
      palGrad.addColorStop(0.65, 'rgba(255, 255, 0, 0.85)');
      palGrad.addColorStop(0.85, 'rgba(255, 120, 0, 0.95)');
      palGrad.addColorStop(1.0, 'rgba(255, 0, 0, 1.0)');

      palCtx.fillStyle = palGrad;
      palCtx.fillRect(0, 0, 256, 1);
      const palData = palCtx.getImageData(0, 0, 256, 1).data;

      // 4. Transform alpha pixels to heat colors
      const imgData = alphaCtx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imgData.data;

      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];
        if (alpha > 0) {
          const palIdx = Math.min(alpha, 255) * 4;
          data[i - 3] = palData[palIdx];     // R
          data[i - 2] = palData[palIdx + 1]; // G
          data[i - 1] = palData[palIdx + 2]; // B
          data[i] = Math.round(data[i] * 0.9); // Target opacity
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } else {
      // ── Scatter Click Dots Mode ──────────────────────────────────────────
      points.forEach((pt) => {
        // Outer glow
        const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 14);
        glow.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
        glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
        glow.addColorStop(1, 'rgba(245, 158, 11, 0)');

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid point
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // White core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [points, mode, radius, intensity, canvasWidth, canvasHeight]);

  // Handle canvas mousemove for interactive inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || points.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Find closest point within threshold (25px)
    let closest: HeatmapPoint | null = null;
    let minDist = 30;

    for (const pt of points) {
      const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }

    if (closest) {
      setHoveredPoint(closest);
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setHoveredPoint(null);
      setTooltipPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setTooltipPos(null);
  };

  return (
    <div className="section-container glass">
      {/* Controls & Page Selector Bar */}
      <div className="heatmap-toolbar">
        <div className="heatmap-page-select-wrap">
          <label className="toolbar-label">Target Page:</label>
          <select
            className="heatmap-select"
            value={selectedPageUrl}
            onChange={(e) => onSelectPage(e.target.value)}
          >
            {pages.length === 0 ? (
              <option value="">No pages with recorded activity yet</option>
            ) : (
              pages.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {p.page_url} ({p.click_count} clicks, {p.view_count} views)
                </option>
              ))
            )}
          </select>
        </div>

        <div className="heatmap-mode-toggles">
          <button
            className={`btn-mode-toggle ${mode === 'density' ? 'active' : ''}`}
            onClick={() => setMode('density')}
            title="Thermal density gradient map"
          >
            <Flame size={15} />
            <span>Density Heatmap</span>
          </button>
          <button
            className={`btn-mode-toggle ${mode === 'dots' ? 'active' : ''}`}
            onClick={() => setMode('dots')}
            title="Exact coordinate scatter dots"
          >
            <Target size={15} />
            <span>Click Coordinates</span>
          </button>
        </div>

        <div className="heatmap-sliders">
          <div className="slider-group">
            <span className="slider-label">Radius: {radius}px</span>
            <input
              type="range"
              min="15"
              max="60"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="range-input"
            />
          </div>

          <div className="slider-group">
            <span className="slider-label">Intensity: {Math.round(intensity * 100)}%</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="range-input"
            />
          </div>
        </div>

        <button className="btn-icon" onClick={onRefresh} title="Reload heatmap points">
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Heatmap Metrics Ribbon */}
      <div className="heatmap-status-ribbon">
        <div className="ribbon-metric">
          <Target size={14} className="text-amber" />
          <span>Total Clicks: <strong>{heatmapData ? heatmapData.total_clicks : 0}</strong></span>
        </div>
        <div className="ribbon-metric">
          <Sliders size={14} className="text-cyan" />
          <span>Canvas Bounds: <strong>{canvasWidth} × {canvasHeight}px</strong></span>
        </div>
        <div className="ribbon-metric">
          <Info size={14} className="text-emerald" />
          <span>Rendering: <strong>{points.length} coordinates plotted</strong></span>
        </div>
      </div>

      {/* Canvas Heatmap Board */}
      <div
        ref={containerRef}
        className="heatmap-canvas-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {loading && (
          <div className="heatmap-overlay-loading">
            <div className="spinner" />
            <span>Extracting coordinate clusters...</span>
          </div>
        )}

        {/* Page wireframe mock background */}
        <div className="page-wireframe-bg" style={{ width: canvasWidth, height: canvasHeight }}>
          <div className="wireframe-header">
            <div className="wireframe-logo-mock" />
            <div className="wireframe-nav-mock" />
          </div>
          <div className="wireframe-hero">
            <div className="wireframe-title-mock" />
            <div className="wireframe-btn-mock" />
          </div>
          <div className="wireframe-grid">
            <div className="wireframe-card-mock" />
            <div className="wireframe-card-mock" />
            <div className="wireframe-card-mock" />
          </div>
        </div>

        {/* Heatmap Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className="heatmap-canvas"
          style={{ width: canvasWidth, height: canvasHeight }}
        />

        {/* Point Inspection Tooltip */}
        {hoveredPoint && tooltipPos && (
          <div
            className="heatmap-tooltip glass"
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y + 15}px`,
            }}
          >
            <div className="tooltip-title">
              <Target size={13} className="text-amber" />
              <span>Click Point Detail</span>
            </div>
            <div className="tooltip-row mono">
              Coordinates: <strong>X: {hoveredPoint.x}px, Y: {hoveredPoint.y}px</strong>
            </div>
            {hoveredPoint.target && (
              <div className="tooltip-target">
                <span className="mono">&lt;{hoveredPoint.target.tag || 'elem'}&gt;</span>
                {hoveredPoint.target.id && (
                  <span className="mono">#{hoveredPoint.target.id}</span>
                )}
                {hoveredPoint.target.text && (
                  <span className="tooltip-text">"{hoveredPoint.target.text}"</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
