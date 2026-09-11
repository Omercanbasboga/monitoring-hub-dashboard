import React from "react";
import { NavLink } from "react-router-dom";
import { Drawer, List, ListItemButton, ListItemText, Typography, Box, Divider } from "@mui/material";
import { SOURCE_REGISTRY, SOURCE_KEYS } from "../features/sources/sourceRegistry";

const WIDTH = 240;

export default function Sidenav() {
  return (
    <Drawer variant="permanent" sx={{ width: WIDTH, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: WIDTH, boxSizing: "border-box" } }}>
      <Box p={2}>
        <Typography variant="h6" fontWeight={800}>
          Monitoring Hub
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItemButton component={NavLink} to="/">
          <ListItemText primary="Overview" />
        </ListItemButton>
        {SOURCE_KEYS.map((key) => (
          <ListItemButton key={key} component={NavLink} to={`/sources/${key}`}>
            <ListItemText primary={SOURCE_REGISTRY[key].label} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}
