import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { mergeStationSeries, findPrimaryMatch, normalizeFailoverSeries } from "../../common/normalize";
import { getLast24h, getRange, getSourceMatchData, getSourceMatchDataRange } from "../../api/sourceApi";
import { toISOZ } from "../../api/http";

// One data slice, keyed by `${sourceType}:${stationId}`, instead of one near-identical
// slice per source type. Every fetch first checks whether this station is the PRIMARY of a
// failover match (see features/failover) — if so, the failover-resolved series (with a
// backup source drawn alongside it) is used instead of the raw source reading.
const initialState = {
  dataByKey: {}, // { [`${sourceType}:${id}`]: [{name, points}] }
  loadingByKey: {}, // idle | loading | succeeded | failed
};

const dataKey = (sourceType, id) => `${sourceType}:${id}`;

const now = () => new Date();
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const resolveSeries = async (getState, sourceType, id, fetchRaw) => {
  const match = findPrimaryMatch(getState(), sourceType, id);
  if (match) {
    return normalizeFailoverSeries(
      await getSourceMatchData(match.id),
      "Primary reading",
      match.secondarySource ? `Backup: ${match.secondarySource}` : null
    );
  }
  return fetchRaw();
};

export const fetchLast24hChart = createAsyncThunk(
  "sourceData/fetchLast24hChart",
  async ({ sourceType, id, retentionDays = 1 }, { getState, rejectWithValue }) => {
    try {
      const data = await resolveSeries(getState, sourceType, id, () => getLast24h(sourceType, id));
      return { sourceType, id, data, retentionStartMs: Date.now() - retentionDays * 86400000 };
    } catch (e) {
      return rejectWithValue({ sourceType, id, message: e?.message || "last-24h fetch failed" });
    }
  }
);

export const fetchRangeChart = createAsyncThunk(
  "sourceData/fetchRangeChart",
  async ({ sourceType, id, start, end, retentionDays = 1 }, { getState, rejectWithValue }) => {
    try {
      let s = new Date(start);
      let e = new Date(end);
      if (isNaN(s) || isNaN(e)) {
        e = now();
        s = daysAgo(7);
      }
      if (s > e) [s, e] = [e, s];
      const data = await resolveSeries(getState, sourceType, id, () =>
        getRange(sourceType, id, toISOZ(s), toISOZ(e))
      );
      return { sourceType, id, data, retentionStartMs: Date.now() - retentionDays * 86400000 };
    } catch (e) {
      return rejectWithValue({ sourceType, id, message: e?.message || "range fetch failed" });
    }
  }
);

const sourceDataSlice = createSlice({
  name: "sourceData",
  initialState,
  reducers: {
    clearSourceSeries: (state, { payload: sourceType }) => {
      Object.keys(state.dataByKey)
        .filter((k) => k.startsWith(`${sourceType}:`))
        .forEach((k) => delete state.dataByKey[k]);
    },
  },
  extraReducers: (builder) => {
    const onPending = (state, { meta }) => {
      state.loadingByKey[dataKey(meta.arg.sourceType, meta.arg.id)] = "loading";
    };
    const onFulfilled = (state, { payload }) => {
      const key = dataKey(payload.sourceType, payload.id);
      state.dataByKey[key] = mergeStationSeries(state.dataByKey[key], payload.data, payload.retentionStartMs);
      state.loadingByKey[key] = "succeeded";
    };
    const onRejected = (state, { payload }) => {
      if (payload) state.loadingByKey[dataKey(payload.sourceType, payload.id)] = "failed";
    };
    builder
      .addCase(fetchLast24hChart.pending, onPending)
      .addCase(fetchLast24hChart.fulfilled, onFulfilled)
      .addCase(fetchLast24hChart.rejected, onRejected)
      .addCase(fetchRangeChart.pending, onPending)
      .addCase(fetchRangeChart.fulfilled, onFulfilled)
      .addCase(fetchRangeChart.rejected, onRejected);
  },
});

export const { clearSourceSeries } = sourceDataSlice.actions;
export default sourceDataSlice.reducer;

export const selectSeries = (sourceType, id) => (state) => state.sourceData.dataByKey[dataKey(sourceType, id)];
export const selectLoading = (sourceType, id) => (state) =>
  state.sourceData.loadingByKey[dataKey(sourceType, id)];
