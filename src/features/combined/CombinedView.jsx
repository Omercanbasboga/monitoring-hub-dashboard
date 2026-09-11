import React from "react";
import { Grid, Card, Box, Typography, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { SOURCE_REGISTRY, SOURCE_KEYS } from "../sources/sourceRegistry";
import DashboardLayout from "../../layout/DashboardLayout";

// Overview landing page — one card per source type, linking into its SourcePage. Kept
// deliberately simple; the interesting engineering lives in SourcePage/UnifiedChart.
export default function CombinedView() {
  const navigate = useNavigate();
  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Sources
      </Typography>
      <Grid container spacing={2}>
        {SOURCE_KEYS.map((key) => {
          const meta = SOURCE_REGISTRY[key];
          return (
            <Grid item xs={12} sm={6} md={3} key={key}>
              <Card
                sx={{ p: 2, cursor: "pointer", borderTop: `3px solid ${meta.color}` }}
                onClick={() => navigate(`/sources/${key}`)}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography fontWeight={700}>{meta.label}</Typography>
                  <Chip size="small" label={key} />
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </DashboardLayout>
  );
}
