import React from "react";
import { Box, Typography, Button } from "@mui/material";

// Catches render errors from one route so a single bad response doesn't white-screen the
// whole app. `resetKey` (the current pathname) is passed in from App.jsx — changing it
// forces the boundary to reset when the user navigates away, instead of getting stuck.
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Route render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4} textAlign="center">
          <Typography variant="h6" gutterBottom>
            Something went wrong rendering this page.
          </Typography>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
