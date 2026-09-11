import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Grid, Box, Typography, TextField, MenuItem, Select, Button, Chip } from "@mui/material";
import { SOURCE_REGISTRY } from "./sourceRegistry";
import {
  fetchStations,
  selectActiveStations,
  selectSourceStatus,
  selectSearchQuery,
  selectPagination,
  setSearchQuery,
  setCurrentPage,
  setGraphsPerPage,
} from "./sourceStationSlice";
import { fetchSourceMatches, selectSourceMatchStatus, selectSourceMatches } from "../failover/sourceMatchSlice";
import { isStationAbsorbedAsSecondary } from "../../common/normalize";
import { fetchLast24hChart, fetchRangeChart, clearSourceSeries, selectSeries, selectLoading } from "./sourceDataSlice";
import SourceChart from "./components/SourceChart";
import DashboardLayout from "../../layout/DashboardLayout";

const DATE_RANGE_OPTIONS = [
  { value: 1, label: "Last 24h" },
  { value: 2, label: "Last 2 days" },
  { value: 7, label: "Last 7 days" },
];
const REFRESH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 30000, label: "Every 30s" },
  { value: 60000, label: "Every minute" },
  { value: 300000, label: "Every 5 min" },
];
const FETCH_CONCURRENCY = 3;
const INCREMENTAL_OVERLAP_MS = 2 * 60 * 1000;

// A per-row wrapper so each chart's `useSelector` calls run inside their own component
// instance — calling useSelector inside a .map() callback directly would break the rules
// of hooks the moment the visible station list changes length between renders.
function ConnectedSourceChart({ sourceType, station }) {
  const series = useSelector(selectSeries(sourceType, station.externalId));
  const isLoading = useSelector(selectLoading(sourceType, station.externalId)) === "loading";
  return <SourceChart station={station} series={series} isLoading={isLoading} />;
}

/**
 * One page component handles every source type — the source type comes from the route
 * (`/sources/:sourceType`). The original app had one full page + slice + API module per
 * network; the underlying behavior (search, paginate, incrementally poll, resolve
 * failover) never actually differed between them, so it's written once here.
 */
export default function SourcePage() {
  const { sourceType } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const meta = SOURCE_REGISTRY[sourceType];

  const [dateRange, setDateRange] = useState(1);
  const [refreshInterval, setRefreshInterval] = useState(30000);

  const status = useSelector(selectSourceStatus(sourceType));
  const stationsRaw = useSelector(selectActiveStations(sourceType));
  const sourceMatches = useSelector(selectSourceMatches);
  const sourceMatchStatus = useSelector(selectSourceMatchStatus);
  const stations = useMemo(
    () => stationsRaw.filter((s) => !isStationAbsorbedAsSecondary(sourceMatches, sourceType, s)),
    [stationsRaw, sourceMatches, sourceType]
  );
  const searchQuery = useSelector(selectSearchQuery(sourceType));
  const { currentPage, graphsPerPage } = useSelector(selectPagination(sourceType));

  useEffect(() => {
    if (status === "idle") dispatch(fetchStations(sourceType));
  }, [dispatch, sourceType, status]);

  useEffect(() => {
    if (sourceMatchStatus === "idle") dispatch(fetchSourceMatches());
  }, [dispatch, sourceMatchStatus]);

  const totalPages = Math.max(1, Math.ceil(stations.length / graphsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const visible = stations.slice((safePage - 1) * graphsPerPage, safePage * graphsPerPage);
  const visibleIdsKey = JSON.stringify(visible.map((s) => s.externalId));

  // Incremental polling: first tick pulls the full selected range, every tick after that
  // only pulls a small overlap window and merges it in (see sourceDataSlice / normalize.js).
  useEffect(() => {
    dispatch(clearSourceSeries(sourceType));
    const ids = JSON.parse(visibleIdsKey);
    if (ids.length === 0 || sourceMatchStatus !== "succeeded") return;

    let lastFetchAt = null;
    const run = async () => {
      const cycleStart = new Date();
      const isIncremental = lastFetchAt !== null;
      for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
        const batch = ids.slice(i, i + FETCH_CONCURRENCY);
        await Promise.all(
          batch.map((id) => {
            if (isIncremental) {
              const start = new Date(lastFetchAt.getTime() - INCREMENTAL_OVERLAP_MS);
              return dispatch(
                fetchRangeChart({ sourceType, id, start: start.toISOString(), end: cycleStart.toISOString(), retentionDays: dateRange })
              );
            }
            if (dateRange === 1) return dispatch(fetchLast24hChart({ sourceType, id, retentionDays: dateRange }));
            const start = new Date();
            start.setDate(cycleStart.getDate() - dateRange);
            return dispatch(
              fetchRangeChart({ sourceType, id, start: start.toISOString(), end: cycleStart.toISOString(), retentionDays: dateRange })
            );
          })
        );
      }
      lastFetchAt = cycleStart;
    };

    run();
    let intervalId;
    if (refreshInterval > 0) intervalId = setInterval(run, refreshInterval);
    return () => intervalId && clearInterval(intervalId);
  }, [dispatch, sourceType, visibleIdsKey, dateRange, refreshInterval, sourceMatchStatus]);

  if (!meta) {
    return (
      <DashboardLayout>
        <Typography color="error">Unknown source type: {sourceType}</Typography>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Card sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="h6" fontWeight={700}>
                {meta.label}
              </Typography>
              <Chip size="small" label={stations.length} sx={{ bgcolor: meta.color, color: "#fff", fontWeight: 700 }} />
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by station name or id…"
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery({ sourceType, value: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <Box display="flex" flexWrap="wrap" gap={2} justifyContent={{ md: "flex-end" }}>
              <Select size="small" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                {DATE_RANGE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
              <Select size="small" value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)}>
                {REFRESH_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
              <Box display="flex" alignItems="center" gap={1}>
                <Button size="small" variant="outlined" disabled={safePage <= 1} onClick={() => dispatch(setCurrentPage({ sourceType, page: safePage - 1 }))}>
                  Prev
                </Button>
                <Typography variant="body2">Page {safePage}/{totalPages}</Typography>
                <Button size="small" variant="outlined" disabled={safePage >= totalPages} onClick={() => dispatch(setCurrentPage({ sourceType, page: safePage + 1 }))}>
                  Next
                </Button>
              </Box>
              <Button size="small" variant="contained" onClick={() => navigate(`/sources/${sourceType}/config`)}>
                Configuration
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {status === "loading" && stations.length === 0 ? (
        <Typography>Loading stations…</Typography>
      ) : stations.length === 0 ? (
        <Typography color="text.secondary">No active stations for this source yet.</Typography>
      ) : (
        <Grid container spacing={2}>
          {visible.map((station) => (
            <Grid item xs={12} md={6} key={station.externalId}>
              <ConnectedSourceChart sourceType={sourceType} station={station} />
            </Grid>
          ))}
        </Grid>
      )}
    </DashboardLayout>
  );
}
