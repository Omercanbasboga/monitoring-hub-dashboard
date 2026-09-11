import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Select,
  MenuItem,
  Button,
  Box,
} from "@mui/material";
import { SOURCE_REGISTRY, SOURCE_KEYS } from "./sourceRegistry";
import { fetchStations, selectActiveStations } from "./sourceStationSlice";
import {
  fetchSourceMatches,
  addSourceMatch,
  removeSourceMatch,
  selectSourceMatches,
} from "../failover/sourceMatchSlice";
import { matchForStation } from "../../common/normalize";
import DashboardLayout from "../../layout/DashboardLayout";

// Station list for one source, plus the failover pairing UI: pick a backup station from
// any other source and pair it with a primary station here. See sourceMatchSlice /
// normalize.js for what a match actually changes at render time.
export default function SourceConfigPage() {
  const { sourceType } = useParams();
  const dispatch = useDispatch();
  const meta = SOURCE_REGISTRY[sourceType];
  const stations = useSelector(selectActiveStations(sourceType));
  const matches = useSelector(selectSourceMatches);

  const [backupSource, setBackupSource] = useState("");
  const [backupStationId, setBackupStationId] = useState("");
  const [primaryStationId, setPrimaryStationId] = useState("");

  useEffect(() => {
    dispatch(fetchStations(sourceType));
    dispatch(fetchSourceMatches());
  }, [dispatch, sourceType]);

  const otherSources = SOURCE_KEYS.filter((k) => k !== sourceType);

  const handleCreateMatch = () => {
    if (!primaryStationId || !backupSource || !backupStationId) return;
    dispatch(
      addSourceMatch({
        primarySource: sourceType,
        primaryStationId,
        secondarySource: backupSource,
        secondaryStationId: backupStationId,
      })
    );
    setPrimaryStationId("");
    setBackupSource("");
    setBackupStationId("");
  };

  if (!meta) {
    return (
      <DashboardLayout>
        <Typography color="error">Unknown source type: {sourceType}</Typography>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {meta.label} — configuration
      </Typography>

      <Card sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          Add a failover pairing
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <Select size="small" displayEmpty value={primaryStationId} onChange={(e) => setPrimaryStationId(e.target.value)}>
            <MenuItem value="" disabled>Primary station ({meta.label})</MenuItem>
            {stations.map((s) => (
              <MenuItem key={s.externalId} value={s.externalId}>{s.name}</MenuItem>
            ))}
          </Select>
          <Select size="small" displayEmpty value={backupSource} onChange={(e) => { setBackupSource(e.target.value); setBackupStationId(""); }}>
            <MenuItem value="" disabled>Backup source</MenuItem>
            {otherSources.map((k) => (
              <MenuItem key={k} value={k}>{SOURCE_REGISTRY[k].label}</MenuItem>
            ))}
          </Select>
          <Select size="small" displayEmpty value={backupStationId} onChange={(e) => setBackupStationId(e.target.value)} disabled={!backupSource}>
            <MenuItem value="" disabled>Backup station id</MenuItem>
          </Select>
          <Button variant="contained" onClick={handleCreateMatch} disabled={!primaryStationId || !backupSource || !backupStationId}>
            Pair
          </Button>
        </Box>
      </Card>

      <Card sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Station</TableCell>
              <TableCell>External id</TableCell>
              <TableCell>Failover pairing</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stations.map((station) => {
              const match = matchForStation(matches, sourceType, { code: station.externalId, id: station.externalId, name: station.name });
              return (
                <TableRow key={station.externalId}>
                  <TableCell>{station.name}</TableCell>
                  <TableCell>{station.externalId}</TableCell>
                  <TableCell>{match ? `${match.primarySource} ↔ ${match.secondarySource}` : "—"}</TableCell>
                  <TableCell align="right">
                    {match && (
                      <Button size="small" color="error" onClick={() => dispatch(removeSourceMatch(match.id))}>
                        Unpair
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </DashboardLayout>
  );
}
