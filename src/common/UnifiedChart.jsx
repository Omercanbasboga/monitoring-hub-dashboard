/**
 * UnifiedChart — the one charting component every source type renders through.
 *
 * Three real techniques worth reading, not boilerplate:
 *  1. Render-time downsampling: raw series can be tens of thousands of points; a chart
 *     is a few hundred pixels wide. lttbIndices() picks the subset that keeps visual
 *     extremes (spikes) intact, computed fresh from the target pixel width rather than
 *     stored pre-downsampled — so zooming in reveals real points, not an averaged blur.
 *  2. Gap-aware rendering: a `null` y-value breaks the line (Highcharts' own
 *     `connectNulls: false`), but naive gap insertion needs a full second array pass.
 *     `toGapAwarePoints` below folds "detect gap" and "downsample" into one pass.
 *  3. Everything here is genuinely generic — no source-specific branching. A source only
 *     ever hands this component `{ name, points }[]`.
 */
import React, { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Highcharts from "highcharts";
import HighchartsExporting from "highcharts/modules/exporting";
import HighchartsReact from "highcharts-react-official";
import { Box, IconButton, Tooltip, CircularProgress, Dialog, DialogContent } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";

if (typeof HighchartsExporting === "function") HighchartsExporting(Highcharts);

const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#8a5cf5"];
const GAP_THRESHOLD_MS = 15 * 60 * 1000; // matches normalize.js's default fillTimeGaps window

/** Downsample a single {x,y} series to `targetPoints`, inserting a null at real gaps. */
function toGapAwarePoints(points, targetPoints) {
  if (!Array.isArray(points) || points.length === 0) return [];
  // A run boundary is either a hole (y == null) or a time jump past the gap threshold.
  const isBreakBefore = (i) => i > 0 && points[i].x - points[i - 1].x > GAP_THRESHOLD_MS;

  const out = [];
  let runStart = 0;
  const flushRun = (end) => {
    const run = points.slice(runStart, end);
    if (run.length === 0) return;
    const share = Math.max(3, Math.round((targetPoints * run.length) / points.length));
    if (run.length <= share) {
      out.push(...run.map((p) => [p.x, p.y]));
    } else {
      // Local LTTB over just this run, using array index as x for the triangle-area math
      // and falling back to real x only for the emitted point.
      const idx = [];
      const n = run.length;
      const every = (n - 2) / (share - 2);
      idx.push(0);
      let a = 0;
      for (let i = 0; i < share - 2; i += 1) {
        let avgStart = Math.floor((i + 1) * every) + 1;
        let avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
        if (avgStart >= avgEnd) avgStart = avgEnd - 1;
        let avgX = 0;
        let avgY = 0;
        for (let j = avgStart; j < avgEnd; j += 1) {
          avgX += run[j].x;
          avgY += run[j].y ?? 0;
        }
        const len = avgEnd - avgStart;
        avgX /= len;
        avgY /= len;
        const to = Math.min(Math.floor((i + 1) * every) + 1, n - 1);
        let off = Math.floor(i * every) + 1;
        const ax = run[a].x;
        const ay = run[a].y ?? 0;
        let maxArea = -1;
        let maxIdx = Math.min(off, n - 1);
        for (; off < to; off += 1) {
          const area = Math.abs((ax - avgX) * ((run[off].y ?? 0) - ay) - (ax - run[off].x) * (avgY - ay)) * 0.5;
          if (area > maxArea) {
            maxArea = area;
            maxIdx = off;
          }
        }
        idx.push(maxIdx);
        a = maxIdx;
      }
      idx.push(n - 1);
      out.push(...idx.map((i) => [run[i].x, run[i].y]));
    }
    if (end < points.length) out.push([points[end].x, null]); // draw the gap itself
  };

  for (let i = 1; i <= points.length; i += 1) {
    if (i === points.length || isBreakBefore(i)) {
      flushRun(i);
      runStart = i;
    }
  }
  return out;
}

export default function UnifiedChart({ title, series, isLoading, height, onRefresh, targetPointsPerSeries }) {
  const chartRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  const options = useMemo(() => {
    const highchartsSeries = (series || []).map((s, i) => ({
      name: s.name,
      data: toGapAwarePoints(s.points, targetPointsPerSeries),
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      connectNulls: false,
      marker: { enabled: false },
      lineWidth: 1.5,
    }));
    return {
      chart: { type: "line", height, zoomType: "x", animation: false },
      title: { text: null },
      xAxis: { type: "datetime" },
      yAxis: { title: { text: null } },
      legend: { enabled: highchartsSeries.length > 1 },
      credits: { enabled: false },
      exporting: { enabled: false }, // driven by the button below instead of Highcharts' own menu
      series: highchartsSeries,
    };
  }, [series, height, targetPointsPerSeries]);

  const chartBody = (
    <Box position="relative" width="100%" height={fullscreen ? "80vh" : height}>
      {isLoading ? (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <CircularProgress size={28} />
        </Box>
      ) : (
        <HighchartsReact
          highcharts={Highcharts}
          options={{ ...options, chart: { ...options.chart, height: fullscreen ? undefined : height } }}
          ref={chartRef}
        />
      )}
      <Box position="absolute" top={4} right={4} display="flex" gap={0.5}>
        {onRefresh && (
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={fullscreen ? "Close" : "Fullscreen"}>
          <IconButton size="small" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <CloseIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  if (fullscreen) {
    return (
      <Dialog open fullWidth maxWidth="lg" onClose={() => setFullscreen(false)}>
        <DialogContent>{chartBody}</DialogContent>
      </Dialog>
    );
  }
  return chartBody;
}

UnifiedChart.propTypes = {
  title: PropTypes.string,
  series: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, points: PropTypes.array })
  ).isRequired,
  isLoading: PropTypes.bool,
  height: PropTypes.number,
  onRefresh: PropTypes.func,
  targetPointsPerSeries: PropTypes.number,
};

UnifiedChart.defaultProps = {
  title: null,
  isLoading: false,
  height: 240,
  onRefresh: null,
  targetPointsPerSeries: 500,
};
