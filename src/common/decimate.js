// LTTB (Largest-Triangle-Three-Buckets) downsampling — used both when rendering a chart
// and when capping how many points a series is allowed to keep in memory.
//
// Why LTTB: average-based downsampling flattens local extremes. LTTB picks, from each
// bucket, the point that forms the LARGEST TRIANGLE AREA with its neighbors, so sudden
// spikes survive. That's exactly what matters when the signal you're watching is
// dominated by rare, sharp events (a wave, a spike, an outlier reading) rather than a
// smooth trend.
//
// This module returns INDEXES, not copied data — the caller produces its own output
// shape (raw {x,y} or a charting library's [x,y] tuples) in a single pass.

/**
 * Apply LTTB to points[start..end).
 * @returns {number[]} indexes to keep (ascending, first and last always included)
 */
export const lttbIndices = (points, threshold, getX, getY, start = 0, end = points.length) => {
  const n = end - start;
  if (n <= 0) return [];
  if (threshold >= n || threshold < 3) {
    const all = new Array(n);
    for (let i = 0; i < n; i += 1) all[i] = start + i;
    return all;
  }

  const out = [start];
  const every = (n - 2) / (threshold - 2);
  let a = start;

  for (let i = 0; i < threshold - 2; i += 1) {
    // Centroid of the next bucket — the third corner of the triangle.
    let avgStart = start + Math.floor((i + 1) * every) + 1;
    let avgEnd = start + Math.floor((i + 2) * every) + 1;
    if (avgEnd > end) avgEnd = end;
    if (avgStart >= avgEnd) avgStart = avgEnd - 1;

    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j += 1) {
      avgX += getX(points[j]);
      avgY += getY(points[j]);
    }
    const avgLen = avgEnd - avgStart;
    avgX /= avgLen;
    avgY /= avgLen;

    // Pick the point in the current bucket that gives the largest triangle.
    let off = start + Math.floor(i * every) + 1;
    const to = Math.min(start + Math.floor((i + 1) * every) + 1, end - 1);
    const ax = getX(points[a]);
    const ay = getY(points[a]);
    let maxArea = -1;
    let maxIdx = Math.min(off, end - 1);

    for (; off < to; off += 1) {
      const area =
        Math.abs((ax - avgX) * (getY(points[off]) - ay) - (ax - getX(points[off])) * (avgY - ay)) *
        0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIdx = off;
      }
    }

    out.push(maxIdx);
    a = maxIdx;
  }

  out.push(end - 1);
  return out;
};

/**
 * Downsample while keeping every "hole" (missing-value / gap marker) position exactly
 * where it was. Holes must already be identified before downsampling — otherwise a
 * downsampled run of points can look like a fake gap that was never really there.
 *
 * @param {number} count      total point count
 * @param {(i:number)=>boolean} isHole  is point i a hole
 * @param {number} maxPoints  upper bound on REAL (non-hole) points to keep
 * @param {(from:number,to:number,target:number)=>number[]} runIndices
 *        generates the indexes that reduce [from,to) to `target` points (usually lttbIndices)
 * @returns {number[]} indexes to keep (holes included, ascending)
 */
export const decimateIndicesPreservingHoles = (count, isHole, maxPoints, runIndices) => {
  let realCount = 0;
  for (let i = 0; i < count; i += 1) if (!isHole(i)) realCount += 1;

  const keepAll = !maxPoints || realCount <= maxPoints;
  const ratio = keepAll ? 1 : maxPoints / realCount;

  const out = [];
  let runStart = -1;
  const flushRun = (endExclusive) => {
    if (runStart < 0) return;
    const len = endExclusive - runStart;
    if (keepAll || len <= 3) {
      for (let i = runStart; i < endExclusive; i += 1) out.push(i);
    } else {
      const target = Math.max(3, Math.round(len * ratio));
      const kept = runIndices(runStart, endExclusive, target);
      for (let i = 0; i < kept.length; i += 1) out.push(kept[i]);
    }
    runStart = -1;
  };

  for (let i = 0; i < count; i += 1) {
    if (isHole(i)) {
      flushRun(i);
      out.push(i);
    } else if (runStart < 0) {
      runStart = i;
    }
  }
  flushRun(count);
  return out;
};
