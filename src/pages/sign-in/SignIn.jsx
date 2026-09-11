import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Card, TextField, Button, Typography, Alert } from "@mui/material";
import { http } from "../../api/http";

export default function SignIn() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await http.post("/auth/login", { username, password });
      navigate("/");
    } catch {
      setError("Sign-in failed. Check your credentials.");
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="background.default">
      <Card sx={{ p: 4, width: 360 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" fontWeight={800} mb={2}>
          Monitoring Hub
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth label="Username" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextField fullWidth type="password" label="Password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button fullWidth type="submit" variant="contained" sx={{ mt: 2 }}>
          Sign in
        </Button>
      </Card>
    </Box>
  );
}
