import axios from "axios";

// Single axios instance, base URL from the environment — never hardcoded. See
// monitoring-hub's README for the matching backend this dashboard is built against.
export const http = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:8082/api",
  timeout: 15000,
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      window.location.assign("/sign-in");
    }
    return Promise.reject(err);
  }
);

export const toISOZ = (d) => new Date(d).toISOString();
