'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { PlayerShot } from '@/lib/db/player-shots';

interface ShotChartProps {
  shots: PlayerShot[];
  width?: number;
  height?: number;
}

// NBA Court dimensions (in feet, scaled to 10x)
// Court is 50ft wide, half-court is ~47ft long
// Data coordinates: X: -250 to 250, Y: -50 to ~420 (focused on offensive half)
// Color constants
const MADE_SHOT_COLOR = '#ff9800'; // Orange for made shots
const MISSED_SHOT_COLOR = '#2196f3'; // Blue for missed shots
const COURT_LINE_COLOR = 'rgba(110, 226, 245, 0.4)'; // Teal court lines
const COURT_LINE_COLOR_DIM = 'rgba(110, 226, 245, 0.2)';

/**
 * Professional NBA Shot Chart with Heat Map + Scatter Plot
 * 
 * Features:
 * - Background density heat map (Blue/Purple = low, Red/Orange = high frequency)
 * - Scatter plot overlay (Orange = Made, Blue = Missed)
 * - NBA half-court line drawing
 */
export function ShotChart({ shots, width = 380, height = 400 }: ShotChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate shooting percentages
  const stats = useMemo(() => {
    if (shots.length === 0) return { total: 0, made: 0, missed: 0, fgPct: 0 };
    const made = shots.filter(s => s.shot_made_flag).length;
    const missed = shots.length - made;
    const fgPct = (made / shots.length) * 100;
    return { total: shots.length, made, missed, fgPct };
  }, [shots]);

  useEffect(() => {
    if (!svgRef.current || shots.length === 0) return;

    const svg = d3.select(svgRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Margins for the court
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    // X: -250 to 250 -> 0 to innerWidth
    const xScale = d3.scaleLinear()
      .domain([-250, 250])
      .range([0, innerWidth]);

    // Y: -50 to 420 -> innerHeight to 0 (inverted for SVG)
    // We cap at 420 to focus on the offensive half-court area
    const yScale = d3.scaleLinear()
      .domain([-50, 420])
      .range([innerHeight, 0]);

    // Create main group with margins
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add definitions for gradients and filters
    const defs = svg.append('defs');

    // Glow filter for heat map
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Heat blur filter
    const heatFilter = defs.append('filter')
      .attr('id', 'heatBlur')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    heatFilter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '8');

    // Color scale for heat map (Blue -> Purple -> Red -> Orange)
    const colorScale = d3.scaleSequential()
      .domain([0, 0.1]) // Density range (will be adjusted)
      .interpolator(d3.interpolateRgbBasis([
        '#1a1a4e', // Dark blue
        '#2d1b69', // Purple
        '#6b2d5b', // Magenta
        '#a93226', // Dark red
        '#e74c3c', // Red
        '#f39c12', // Orange
        '#f1c40f', // Yellow-orange
      ]));

    // ========== LAYER 1: HEAT MAP ==========
    // Prepare shot coordinates for density calculation
    const shotPoints: [number, number][] = shots.map(shot => [
      xScale(shot.loc_x),
      yScale(Math.min(shot.loc_y, 420)) // Cap Y at 420
    ]);

    // Compute density contours
    const contourGenerator = d3.contourDensity<[number, number]>()
      .x(d => d[0])
      .y(d => d[1])
      .size([innerWidth, innerHeight])
      .bandwidth(20) // Smoothing bandwidth
      .thresholds(15); // Number of contour levels

    const contours = contourGenerator(shotPoints);

    // Update color scale domain based on actual density values
    const maxDensity = d3.max(contours, d => d.value) || 0.01;
    colorScale.domain([0, maxDensity]);

    // Create heat map group with blur
    const heatMapGroup = g.append('g')
      .attr('class', 'heatmap')
      .style('filter', 'url(#heatBlur)');

    // Draw contours
    heatMapGroup.selectAll('path.contour')
      .data(contours)
      .join('path')
      .attr('class', 'contour')
      .attr('d', d3.geoPath())
      .attr('fill', d => colorScale(d.value))
      .attr('opacity', 0.7);

    // ========== LAYER 2: COURT LINES ==========
    const courtGroup = g.append('g').attr('class', 'court');

    // Court background (subtle)
    courtGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent');

    // Basket (hoop)
    const hoopX = xScale(0);
    const hoopY = yScale(0);

    // Backboard
    courtGroup.append('line')
      .attr('x1', xScale(-30))
      .attr('x2', xScale(30))
      .attr('y1', yScale(-7))
      .attr('y2', yScale(-7))
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 2);

    // Hoop
    courtGroup.append('circle')
      .attr('cx', hoopX)
      .attr('cy', hoopY)
      .attr('r', xScale(7.5) - xScale(0))
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 1.5);

    // Restricted area arc
    courtGroup.append('path')
      .attr('d', d3.arc()({
        innerRadius: 0,
        outerRadius: xScale(40) - xScale(0),
        startAngle: -Math.PI / 2,
        endAngle: Math.PI / 2,
      }))
      .attr('transform', `translate(${hoopX}, ${hoopY})`)
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR_DIM)
      .attr('stroke-width', 1);

    // Paint (key) - rectangle
    const paintWidth = xScale(80) - xScale(-80);
    const paintHeight = yScale(-50) - yScale(190);
    courtGroup.append('rect')
      .attr('x', xScale(-80))
      .attr('y', yScale(190))
      .attr('width', paintWidth)
      .attr('height', paintHeight)
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 1);

    // Free throw circle
    courtGroup.append('circle')
      .attr('cx', hoopX)
      .attr('cy', yScale(190))
      .attr('r', xScale(60) - xScale(0))
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR_DIM)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    // Three-point line
    // Side lines
    courtGroup.append('line')
      .attr('x1', xScale(-220))
      .attr('x2', xScale(-220))
      .attr('y1', yScale(-50))
      .attr('y2', yScale(90))
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 1);

    courtGroup.append('line')
      .attr('x1', xScale(220))
      .attr('x2', xScale(220))
      .attr('y1', yScale(-50))
      .attr('y2', yScale(90))
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 1);

    // Three-point arc
    const threePointRadius = xScale(237.5) - xScale(0);
    courtGroup.append('path')
      .attr('d', d3.arc()({
        innerRadius: threePointRadius,
        outerRadius: threePointRadius,
        startAngle: -Math.PI / 2 + 0.38, // Adjusted to connect with side lines
        endAngle: Math.PI / 2 - 0.38,
      }))
      .attr('transform', `translate(${hoopX}, ${hoopY})`)
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR)
      .attr('stroke-width', 1);

    // Half-court line (at top of visible area)
    courtGroup.append('line')
      .attr('x1', xScale(-250))
      .attr('x2', xScale(250))
      .attr('y1', yScale(420))
      .attr('y2', yScale(420))
      .attr('stroke', COURT_LINE_COLOR_DIM)
      .attr('stroke-width', 1);

    // Center circle (semi-circle at half court)
    // Use ellipse arc to account for different X/Y scales
    const centerCircleRadiusX = xScale(60) - xScale(0);
    const centerCircleRadiusY = yScale(0) - yScale(60); // Note: Y is inverted
    const centerY = yScale(420);

    // Draw semi-circle using SVG path arc command
    // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    courtGroup.append('path')
      .attr('d', `M ${hoopX - centerCircleRadiusX} ${centerY} A ${centerCircleRadiusX} ${centerCircleRadiusY} 0 0 0 ${hoopX + centerCircleRadiusX} ${centerY}`)
      .attr('fill', 'none')
      .attr('stroke', COURT_LINE_COLOR_DIM)
      .attr('stroke-width', 1);

    // ========== LAYER 3: SCATTER PLOT (SHOTS) ==========
    const shotsGroup = g.append('g').attr('class', 'shots');

    shotsGroup.selectAll('circle.shot')
      .data(shots)
      .join('circle')
      .attr('class', 'shot')
      .attr('cx', d => xScale(d.loc_x))
      .attr('cy', d => yScale(Math.min(d.loc_y, 420)))
      .attr('r', 3)
      .attr('fill', d => d.shot_made_flag ? MADE_SHOT_COLOR : MISSED_SHOT_COLOR)
      .attr('opacity', 0.75)
      .attr('stroke', 'rgba(255,255,255,0.3)')
      .attr('stroke-width', 0.5);

  }, [shots, width, height]);

  // Empty state
  if (shots.length === 0) {
    return (
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
        <h4 className="text-sm font-bold text-white uppercase mb-4">Shot Chart</h4>
        <div className="flex items-center justify-center h-[300px] text-brand-text-dim">
          <p>No shot data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
      <h4 className="text-sm font-bold text-white uppercase mb-4">Shot Chart</h4>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="relative w-full flex justify-center"
        style={{ backgroundColor: '#0D121D', borderRadius: '8px' }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="max-w-full h-auto"
        />
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MADE_SHOT_COLOR }} />
          <span className="text-brand-text-dim">Made ({stats.made})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MISSED_SHOT_COLOR }} />
          <span className="text-brand-text-dim">Missed ({stats.missed})</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-brand-card-border">
        <div className="text-center">
          <p className="text-xs text-brand-text-dim mb-1">Total Shots</p>
          <p className="text-lg font-bold text-white">{stats.total}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-brand-text-dim mb-1">FG%</p>
          <p className="text-lg font-bold text-white">{stats.fgPct.toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-brand-text-dim mb-1">Made</p>
          <p className="text-lg font-bold text-green-400">{stats.made}</p>
        </div>
      </div>
    </div>
  );
}
