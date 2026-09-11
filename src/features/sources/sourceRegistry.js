// Generic registry of source types — matches the backend's SourceType enum
// (github.com/Omercanbasboga/monitoring-hub). Config/list pages read this table instead
// of branching on source type with if/switch, so adding a fifth connector someday is a
// registry entry, not a new set of duplicated files.
export const SOURCE_REGISTRY = {
  REST_API: {
    key: "REST_API",
    label: "REST / JSON polling",
    color: "#2a78d6",
  },
  CSV_FEED: {
    key: "CSV_FEED",
    label: "Bulk CSV feed",
    color: "#eb6834",
  },
  FTP_DELIMITED: {
    key: "FTP_DELIMITED",
    label: "FTP (delimited)",
    color: "#1baf7a",
  },
  FTP_BINARY: {
    key: "FTP_BINARY",
    label: "FTP (binary / GCF)",
    color: "#eda100",
  },
};

export const SOURCE_KEYS = Object.keys(SOURCE_REGISTRY);
