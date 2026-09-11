import { http } from "./http";

// One generic client shared by every source type (REST_API / CSV_FEED / FTP_DELIMITED /
// FTP_BINARY — matching the backend's SourceType), parameterized by `sourceType` instead
// of duplicating an API module per source.
export const getStations = (sourceType) =>
  http.get(`/unified/stations/${sourceType}`).then((r) => r.data);

export const getLast24h = (sourceType, externalId) =>
  http.get(`/sources/${sourceType}/stations/${externalId}/readings/chart/last-24h`).then((r) => r.data);

export const getRange = (sourceType, externalId, start, end) =>
  http
    .get(`/sources/${sourceType}/stations/${externalId}/readings`, { params: { start, end } })
    .then((r) => r.data);

// Failover / source-match endpoints — cross-source primary/backup pairing.
export const getSourceMatches = () => http.get("/source-match").then((r) => r.data);
export const createSourceMatch = (payload) => http.post("/source-match", payload).then((r) => r.data);
export const deleteSourceMatch = (id) => http.delete(`/source-match/${id}`).then((r) => r.data);
export const getSourceMatchData = (id) => http.get(`/source-match/${id}/data`).then((r) => r.data);
export const getSourceMatchDataRange = (id, start, end) =>
  http.get(`/source-match/${id}/data`, { params: { start, end } }).then((r) => r.data);
