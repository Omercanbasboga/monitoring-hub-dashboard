# Monitoring Hub Dashboard

A React dashboard for the [`monitoring-hub`](https://github.com/Omercanbasboga/monitoring-hub) backend — a
Spring Boot service that unifies REST/CSV/FTP sensor feeds into one API. This is the frontend counterpart:
real-time, gap-aware, downsampled time-series charts per source, with cross-source failover pairing.

This is a personal, generic reimplementation of the architecture and patterns from a production dashboard
I built and operated as part of a larger internal system. It is written from scratch for this repository —
no proprietary code, credentials, branding, or infrastructure details from that project are included.

## A note on the UI layer

The original app was built on top of a commercial React admin template (Creative Tim's Soft UI Dashboard
PRO). That template's code and design system are licensed and not open source, so none of it — components,
theme, layout chrome — is reproduced here, regardless of the university-IP question. What you're looking at
is a from-scratch layout built directly on plain [MUI](https://mui.com/) (fully open source), preserving the
same real engineering underneath (downsampling, gap detection, incremental polling, failover) without any of
the original visual design or licensed code.

## What it does

- **Per-source dashboards** (`REST_API` / `CSV_FEED` / `FTP_DELIMITED` / `FTP_BINARY`, matching the backend's
  `SourceType`) — station search, pagination, adjustable date range and refresh interval, all driven by one
  generic `SourcePage` rather than one page per source (the original had a near-duplicate page/slice/API
  module per data network; this consolidates that into a single parameterized implementation).
- **Render-time LTTB downsampling** (`common/UnifiedChart.jsx`) — a raw series can be tens of thousands of
  points; the chart recomputes the visually-significant subset from the actual pixel width on every render,
  so spikes survive downsampling and zooming in reveals real points instead of a pre-averaged blur.
- **Gap-aware charts** — a real outage in the underlying feed draws as a dashed break, not a straight line
  across missing data, computed in the same pass as the downsampling instead of a second full-array walk.
- **Incremental polling** (`SourcePage`) — after the first load, each refresh interval fetches only a small
  overlap window and merges it into the existing series (`common/normalize.js`'s `mergePointsByTimestamp`,
  binary-search based) instead of re-fetching and re-sorting the full range every tick.
- **Cross-source failover** (`features/failover`) — pair a station on one source with a backup station on a
  different source; if the primary feed goes quiet, the chart transparently switches to showing the backup
  reading instead of going blank.

## Tech stack

React 18, Redux Toolkit, React Router 6, MUI 5, Highcharts, Luxon, Axios.

## Running it

```bash
npm install
cp .env.example .env   # point REACT_APP_API_BASE_URL at your monitoring-hub instance
npm start
```

## Project layout

```
src/
├── common/           # decimate.js (LTTB), normalize.js (merge/cap/failover), UnifiedChart.jsx
├── features/
│   ├── sources/      # sourceRegistry, station/data slices, SourcePage, SourceConfigPage
│   ├── failover/      # cross-source primary/backup pairing
│   └── combined/      # overview landing page
├── layout/            # DashboardLayout, Navbar, Sidenav
├── pages/sign-in/
└── api/                # axios client + generic per-source-type endpoints
```
