import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getStations } from "../../api/sourceApi";

// One slice, keyed by source type, instead of one near-identical slice per source
// (station list + search + pagination state, unified). `sourceType` is one of
// REST_API / CSV_FEED / FTP_DELIMITED / FTP_BINARY.
const initialSourceState = () => ({
  items: [],
  status: "idle", // idle | loading | succeeded | failed
  error: null,
  searchQuery: "",
  currentPage: 1,
  graphsPerPage: 10,
  rowsPerScreen: 4,
});

const initialState = {};

export const fetchStations = createAsyncThunk(
  "sourceStations/fetch",
  async (sourceType, { rejectWithValue }) => {
    try {
      const items = await getStations(sourceType);
      return { sourceType, items };
    } catch (e) {
      return rejectWithValue({ sourceType, message: e?.message || "Failed to load stations" });
    }
  }
);

const sourceStationSlice = createSlice({
  name: "sourceStations",
  initialState,
  reducers: {
    setSearchQuery: (state, { payload: { sourceType, value } }) => {
      (state[sourceType] ??= initialSourceState()).searchQuery = value;
      state[sourceType].currentPage = 1;
    },
    setCurrentPage: (state, { payload: { sourceType, page } }) => {
      (state[sourceType] ??= initialSourceState()).currentPage = page;
    },
    setGraphsPerPage: (state, { payload: { sourceType, value } }) => {
      (state[sourceType] ??= initialSourceState()).graphsPerPage = value;
      state[sourceType].currentPage = 1;
    },
    setRowsPerScreen: (state, { payload: { sourceType, value } }) => {
      (state[sourceType] ??= initialSourceState()).rowsPerScreen = value;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations.pending, (state, { meta }) => {
        (state[meta.arg] ??= initialSourceState()).status = "loading";
      })
      .addCase(fetchStations.fulfilled, (state, { payload }) => {
        const s = (state[payload.sourceType] ??= initialSourceState());
        s.status = "succeeded";
        s.items = payload.items;
      })
      .addCase(fetchStations.rejected, (state, { payload }) => {
        const s = (state[payload?.sourceType] ??= initialSourceState());
        s.status = "failed";
        s.error = payload?.message;
      });
  },
});

export const { setSearchQuery, setCurrentPage, setGraphsPerPage, setRowsPerScreen } =
  sourceStationSlice.actions;
export default sourceStationSlice.reducer;

const getS = (state, sourceType) => state.sourceStations[sourceType] || initialSourceState();

export const selectSourceStatus = (sourceType) => (state) => getS(state, sourceType).status;
export const selectSearchQuery = (sourceType) => (state) => getS(state, sourceType).searchQuery;
export const selectPagination = (sourceType) => (state) => {
  const s = getS(state, sourceType);
  return { currentPage: s.currentPage, graphsPerPage: s.graphsPerPage };
};
export const selectRowsPerScreen = (sourceType) => (state) => getS(state, sourceType).rowsPerScreen;

export const selectActiveStations = (sourceType) => (state) => {
  const s = getS(state, sourceType);
  const q = s.searchQuery.trim().toLowerCase();
  if (!q) return s.items;
  return s.items.filter(
    (item) =>
      String(item.name || "").toLowerCase().includes(q) ||
      String(item.externalId || "").toLowerCase().includes(q)
  );
};
