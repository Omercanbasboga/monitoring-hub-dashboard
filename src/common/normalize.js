import { DateTime } from "luxon";
import { lttbIndices, decimateIndicesPreservingHoles } from "./decimate";

export const norm = (v) => (v == null ? "" : String(v)).normalize("NFKC").trim();
export const normU = (v) => norm(v).toUpperCase();
export const normL = (v) => norm(v).toLowerCase();
export const uniqNormalized = (arr) => {
  const set = new Set();
  for (const it of arr || []) {
    const n = norm(it);
    if (n) set.add(n);
  }
  return Array.from(set);
};

export const toMs = (t) => {
  if (t == null) return null;
  if (typeof t === "number") {
    return t < 1e12 ? Math.trunc(t * 1000) : t;
  }
  const s = String(t).trim();
  const dt = DateTime.fromISO(s, { zone: "utc" });
  if (dt.isValid) return dt.toMillis();
  const dtSql = DateTime.fromSQL(s, { zone: "utc" });
  if (dtSql.isValid) return dtSql.toMillis();
  const ms = Date.parse(s.endsWith("Z") ? s : s + "Z");
  return Number.isFinite(ms) ? ms : null;
};

export const toNumberStrict = (v) => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "string" && v.trim() === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// --- FILL TIME GAPS ---
// Kept for reference/documentation — UnifiedChart now folds this logic into its own
// gap-aware point-mapping in a single pass (two separate full-array copies were causing
// real GC pressure on multi-thousand-point series). New code should use the version in
// UnifiedChart directly.
// If two consecutive points are more than `thresholdMinutes` apart, insert a `null` point
// between them so the chart draws a dashed "no data" segment there instead of a straight
// line across the gap.
export const fillTimeGaps = (points, thresholdMinutes = 15) => {
  if (!points || points.length < 2) return points;
  const filledPoints = [];
  const thresholdMs = thresholdMinutes * 60 * 1000;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    filledPoints.push(current);
    if (i < points.length - 1) {
      const next = points[i + 1];
      const diff = next.x - current.x;
      if (diff > thresholdMs) {
        filledPoints.push({ x: current.x + 1, y: null });
      }
    }
  }
  // Extend with a null point if the last reading is older than the threshold, so a
  // currently-stalled feed also shows a dashed trailing gap instead of just stopping.
  const lastPoint = filledPoints[filledPoints.length - 1];
  const now = Date.now();
  if (lastPoint && now - lastPoint.x > thresholdMs) {
    filledPoints.push({ x: lastPoint.x + 1, y: null });
    filledPoints.push({ x: now, y: null });
  }
  return filledPoints;
};

// --- INCREMENTAL MERGE ---
// On every auto-refresh tick we fetch only a small window since the last fetch instead of
// re-pulling the whole selected range (24h/7d) from scratch, then merge it into what we
// already have. Same timestamp = the newer value wins (idempotent — refetching the same
// window twice never corrupts anything). If `retentionStartMs` is given, points older
// than it are dropped so the buffer doesn't grow past the selected date range.
// NOTE: this must run on RAW (gap-unfilled) points — if a gap-fill pass runs, it must run
// AFTER merging on the full merged series (otherwise stale synthetic gap points pile up
// and are never cleaned out).

// Binary search: first index with x >= targetX, in an ascending-sorted point array.
const lowerBound = (points, targetX) => {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < targetX) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

// Collapse duplicate x's (last write wins) and sort ascending.
const sortDedupAsc = (points) => {
  const map = new Map();
  for (const p of points) map.set(p.x, p);
  return Array.from(map.values()).sort((a, b) => a.x - b.x);
};

// PERFORMANCE: this function's output is always ascending, so `existingPoints` is always
// ascending too — that invariant lets an incremental refresh binary-search the overlap
// point instead of re-mapping and re-sorting the whole series every tick.
// Before: N stations x tens of thousands of points = full Map-insert + full sort, every
// refresh interval. After: the overlap point is found with a binary search, everything
// before it passes through untouched; only the few hundred points inside the overlap
// window are actually processed.
export const mergePointsByTimestamp = (existingPoints, incomingPoints, retentionStartMs) => {
  const existing = Array.isArray(existingPoints) ? existingPoints : [];
  const incoming = Array.isArray(incomingPoints) ? incomingPoints : [];

  if (existing.length === 0) {
    const sorted = sortDedupAsc(incoming);
    return retentionStartMs == null ? sorted : sorted.slice(lowerBound(sorted, retentionStartMs));
  }
  if (incoming.length === 0) {
    return retentionStartMs == null
      ? existing.slice()
      : existing.slice(lowerBound(existing, retentionStartMs));
  }

  const sortedIncoming = sortDedupAsc(incoming);
  // Overlap point: existing's tail from the first timestamp in the incoming window.
  const cut = lowerBound(existing, sortedIncoming[0].x);
  const from = retentionStartMs == null ? 0 : lowerBound(existing, retentionStartMs);

  // Untouched head (all older than the incoming window, all still inside retention).
  const head = existing.slice(Math.min(from, cut), cut);
  // Only the overlapping tail actually gets merged.
  const tail = sortDedupAsc(existing.slice(cut).concat(sortedIncoming));
  const tailFrom = retentionStartMs == null ? 0 : lowerBound(tail, retentionStartMs);

  return head.concat(tail.slice(tailFrom));
};

// --- MEMORY CAP -----------------------------------------------------------------------
// Maximum points a single series is allowed to keep in the store. At a 15-second sample
// interval this is roughly 3.5 days of data — 24h and 2-day views never come close to the
// cap; only a 7-day view gets downsampled. When exceeded, LTTB is applied (so extremes
// survive) and points are never regenerated — a subset of the existing objects is chosen.
//
// Why this matters: dozens of charts x a week x a 15s sample interval adds up to roughly a
// million point objects in memory if nothing caps it. The cap keeps that bounded. Even at
// full screen width, tens of thousands of points collapse to a handful per pixel anyway —
// visually indistinguishable from the uncapped series.
//
// CAUTION: the cap must stay high enough that the post-downsampling point spacing stays
// BELOW the chart's own gap-detection threshold (10–15 min) — otherwise the memory cap
// itself starts drawing fake gaps in the chart. At 20,000 points over a 7-day window the
// resulting spacing is roughly 30s, comfortably under that threshold.
export const MAX_POINTS_PER_SERIES = 20000;

const isHolePoint = (p) => !(typeof p?.y === "number" && Number.isFinite(p.y));
const pointX = (p) => p.x;
const pointY = (p) => p.y;

export const capSeriesPoints = (points, maxPoints = MAX_POINTS_PER_SERIES) => {
  if (!Array.isArray(points) || !maxPoints || points.length <= maxPoints) return points;
  const keep = decimateIndicesPreservingHoles(
    points.length,
    (i) => isHolePoint(points[i]),
    maxPoints,
    (from, to, target) => lttbIndices(points, target, pointX, pointY, from, to)
  );
  if (keep.length >= points.length) return points;
  const out = new Array(keep.length);
  for (let i = 0; i < keep.length; i += 1) out[i] = points[keep[i]];
  return out;
};

// Merges every series of one station (matched by name) — every source's data shape is
// `dataByStation[station] = [{name, points}, ...]`, so this is shared across all of them.
export const mergeStationSeries = (existingSeriesArr, incomingSeriesArr, retentionStartMs) => {
  if (!Array.isArray(incomingSeriesArr)) return existingSeriesArr || [];
  if (!Array.isArray(existingSeriesArr) || existingSeriesArr.length === 0) {
    return incomingSeriesArr.map((s) => {
      const pts = s.points || [];
      const kept = retentionStartMs == null ? pts : pts.filter((p) => p.x >= retentionStartMs);
      return { ...s, points: capSeriesPoints(kept) };
    });
  }
  const existingByName = new Map(existingSeriesArr.map((s) => [s.name, s]));
  return incomingSeriesArr.map((s) => {
    const existing = existingByName.get(s.name);
    const points = mergePointsByTimestamp(existing?.points, s.points, retentionStartMs);
    return { ...s, points: capSeriesPoints(points) };
  });
};

// --- Failover series normalization ---
// Backend `/api/source-match/{id}/data` points look like: { time, value, role, source }.
// Returns TWO series: the primary source (role=PRIMARY) and — if `secondaryLabel` is
// given — the backup source (role=SECONDARY, may be empty). Gaps in the primary series
// get the usual dashed-line treatment; the backup series is drawn in a distinct color.
// `secondaryLabel` must stay the SAME across refreshes (mergeStationSeries matches by
// name) — so the series is returned even when empty.
const _dedupSort = (arr) => {
  const m = new Map();
  for (const { x, y } of arr) m.set(x, y);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
};
export const normalizeFailoverSeries = (points, primaryName = "Primary reading", secondaryLabel = null) => {
  const prim = [];
  const sec = [];
  for (const p of Array.isArray(points) ? points : []) {
    const x = toMs(p?.time);
    if (x == null) continue;
    const y = typeof p?.value === "number" && Number.isFinite(p.value) ? p.value : null;
    if (String(p?.role || "").toUpperCase() === "SECONDARY") sec.push({ x, y });
    else prim.push({ x, y });
  }
  const series = [{ name: primaryName, points: _dedupSort(prim) }];
  if (secondaryLabel) series.push({ name: secondaryLabel, points: _dedupSort(sec) });
  return series;
};

// Is a station currently absorbed as the BACKUP (secondary) source of some failover match?
// If so, it isn't shown as its own independent chart — it keeps collecting data, but only
// gets used when the primary source goes quiet. A station's identifying fields differ by
// source type, so all plausible ones (code / sensorId / id / name) are compared against
// both secondaryDataKey and secondaryStationId. Case-insensitive.
export const isStationAbsorbedAsSecondary = (matches, source, station) => {
  if (!station) return false;
  const src = String(source || "").toUpperCase();
  const refs = [station.code, station.sensorId, station.id, station.name, station.stationCode]
    .filter((r) => r != null && r !== "")
    .map((r) => String(r).toLowerCase());
  if (refs.length === 0) return false;
  return (matches || []).some((m) => {
    if (String(m.secondarySource || "").toUpperCase() !== src) return false;
    const keys = [m.secondaryDataKey, m.secondaryStationId]
      .filter(Boolean)
      .map((k) => String(k).toLowerCase());
    return keys.some((k) => refs.includes(k));
  });
};

// Is a station tied to any failover match at all (as primary OR secondary)? Returns the
// match object (name + id + everything) if so, else null. Config pages use this to show a
// "matched as" column: obj.name is displayed, obj.id is what gets PUT back. All identity
// fields (code/sensorId/id/name/stationCode) are compared against both
// primaryDataKey/primaryStationId and the secondary equivalents. Case-insensitive.
export const matchForStation = (matches, source, station) => {
  if (!station) return null;
  const src = String(source || "").toUpperCase();
  const refs = [station.code, station.sensorId, station.id, station.name, station.stationCode]
    .filter((r) => r != null && r !== "")
    .map((r) => String(r).toLowerCase());
  if (refs.length === 0) return null;
  return (
    (matches || []).find((m) => {
      const pOk =
        String(m.primarySource || "").toUpperCase() === src &&
        [m.primaryDataKey, m.primaryStationId]
          .filter(Boolean)
          .map((k) => String(k).toLowerCase())
          .some((k) => refs.includes(k));
      const sOk =
        String(m.secondarySource || "").toUpperCase() === src &&
        [m.secondaryDataKey, m.secondaryStationId]
          .filter(Boolean)
          .map((k) => String(k).toLowerCase())
          .some((k) => refs.includes(k));
      return pOk || sOk;
    }) || null
  );
};

// Is a station the PRIMARY of some failover match? → the match object, or null.
// `matches` comes from `state.sourceMatch.matches`; `stationRef` is whatever identifier
// that source stores. Different sources fetch data keyed by different fields (name, code,
// sensorId, ...), so we match against the backend-resolved `primaryDataKey` first and fall
// back to the raw `primaryStationId`. Case-insensitive.
export const findPrimaryMatch = (state, source, stationRef) => {
  const matches = state?.sourceMatch?.matches || [];
  const src = String(source || "").toUpperCase();
  const ref = String(stationRef ?? "").toLowerCase();
  return (
    matches.find((m) => {
      if (String(m.primarySource || "").toUpperCase() !== src) return false;
      const key = String(m.primaryDataKey ?? m.primaryStationId ?? "").toLowerCase();
      const idKey = String(m.primaryStationId ?? "").toLowerCase();
      return key === ref || idKey === ref;
    }) || null
  );
};

// --- Per-source-type response normalization ---
// Every connector's raw rows have a slightly different shape (which field holds the
// timestamp, which field holds the reading, whether the reading needs a sanity-range
// filter). Rather than one hand-written normalizer per source (the original had one per
// network — a lot of near-identical copy-paste), this takes a small per-source config and
// does the shared work once: parse timestamp, coerce the value, drop physically impossible
// outliers, dedupe by timestamp, sort ascending.
//
// timeField / valueField: dot-path or function to pull the raw value off a row.
// sanityRange: optional [min, max] — readings outside it become a gap (`null`), not a
// discarded point, so the chart still draws a "no reliable data" break there instead of
// silently losing the sample.
const pick = (row, fieldOrFn) =>
  typeof fieldOrFn === "function" ? fieldOrFn(row) : row?.[fieldOrFn];

export const normalizeSourceSeries = (rows, { timeField, valueField, sanityRange, seriesName = "Reading" }) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const points = [];
  for (const r of rows) {
    const x = toMs(pick(r, timeField));
    if (x == null) continue;
    const raw = pick(r, valueField);
    let y = typeof raw === "number" && Number.isFinite(raw) ? raw : toNumberStrict(raw);
    if (!Number.isFinite(y)) y = null;
    if (y != null && sanityRange && (y < sanityRange[0] || y > sanityRange[1])) y = null;
    points.push({ x, y });
  }
  const map = new Map();
  for (const { x, y } of points) map.set(x, y);
  const sortedPoints = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  // NOTE: gap-filling happens at render time in UnifiedChart, not here — state only ever
  // holds real points, so incremental fetch/merge stays clean (synthetic gap points never
  // pile up in the store).
  return [{ name: seriesName, points: sortedPoints }];
};
