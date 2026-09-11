import React from "react";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";

export default function Navbar() {
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Toolbar>
        <Box flexGrow={1} />
        <Typography variant="body2" color="text.secondary">
          Sea-level / environmental monitoring dashboard
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
