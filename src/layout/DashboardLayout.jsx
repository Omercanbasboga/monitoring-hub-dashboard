import React from "react";
import { Box } from "@mui/material";
import Sidenav from "./Sidenav";
import Navbar from "./Navbar";

export default function DashboardLayout({ children }) {
  return (
    <Box display="flex">
      <Sidenav />
      <Box flexGrow={1} minWidth={0}>
        <Navbar />
        <Box p={3}>{children}</Box>
      </Box>
    </Box>
  );
}
