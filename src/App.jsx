import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CircularProgress, Box, ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import routes from "./routes";
import ErrorBoundary from "./common/ErrorBoundary";

const theme = createTheme({
  palette: { primary: { main: "#0A498E" }, info: { main: "#26ACE2" } },
});

const fallback = (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
    <CircularProgress color="primary" />
  </Box>
);

export default function App() {
  const { pathname } = useLocation();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={fallback}>
          <Routes>
            {routes.map(({ path, element: Element }) => (
              <Route key={path} path={path} element={<Element />} />
            ))}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
