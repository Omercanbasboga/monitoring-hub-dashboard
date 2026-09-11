import React from "react";
import PropTypes from "prop-types";
import { Card, Box, Typography, Chip } from "@mui/material";
import UnifiedChart from "../../../common/UnifiedChart";

export default function SourceChart({ station, series, isLoading, height }) {
  const hasData = Array.isArray(series) && series.some((s) => s.points?.some((p) => p.y != null));
  return (
    <Card variant="outlined" sx={{ p: 1.5 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography variant="subtitle2" fontWeight={700}>
          {station.name}
        </Typography>
        {!hasData && !isLoading && <Chip size="small" label="No data" color="warning" variant="outlined" />}
      </Box>
      <UnifiedChart series={series || []} isLoading={isLoading} height={height} />
    </Card>
  );
}

SourceChart.propTypes = {
  station: PropTypes.shape({ name: PropTypes.string }).isRequired,
  series: PropTypes.array,
  isLoading: PropTypes.bool,
  height: PropTypes.number,
};

SourceChart.defaultProps = { series: [], isLoading: false, height: 220 };
