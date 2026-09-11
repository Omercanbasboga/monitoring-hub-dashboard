import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getSourceMatches, createSourceMatch, deleteSourceMatch } from "../../api/sourceApi";

// Cross-source failover: pair a station from one source with a backup station from a
// different source, so if the primary feed goes quiet the chart keeps showing readings
// from the backup instead of a blank chart. See normalize.js's findPrimaryMatch /
// isStationAbsorbedAsSecondary / normalizeFailoverSeries for how a match actually changes
// what a chart renders.
const initialState = { matches: [], status: "idle", error: null };

export const fetchSourceMatches = createAsyncThunk("sourceMatch/fetch", async (_, { rejectWithValue }) => {
  try {
    return await getSourceMatches();
  } catch (e) {
    return rejectWithValue(e?.message || "Failed to load failover matches");
  }
});

export const addSourceMatch = createAsyncThunk("sourceMatch/add", async (payload, { rejectWithValue }) => {
  try {
    return await createSourceMatch(payload);
  } catch (e) {
    return rejectWithValue(e?.message || "Failed to create failover match");
  }
});

export const removeSourceMatch = createAsyncThunk("sourceMatch/remove", async (id, { rejectWithValue }) => {
  try {
    await deleteSourceMatch(id);
    return id;
  } catch (e) {
    return rejectWithValue(e?.message || "Failed to delete failover match");
  }
});

const sourceMatchSlice = createSlice({
  name: "sourceMatch",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSourceMatches.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchSourceMatches.fulfilled, (state, { payload }) => {
        state.status = "succeeded";
        state.matches = payload;
      })
      .addCase(fetchSourceMatches.rejected, (state, { payload }) => {
        state.status = "failed";
        state.error = payload;
      })
      .addCase(addSourceMatch.fulfilled, (state, { payload }) => {
        state.matches.push(payload);
      })
      .addCase(removeSourceMatch.fulfilled, (state, { payload: id }) => {
        state.matches = state.matches.filter((m) => m.id !== id);
      });
  },
});

export default sourceMatchSlice.reducer;
export const selectSourceMatches = (state) => state.sourceMatch.matches;
export const selectSourceMatchStatus = (state) => state.sourceMatch.status;
