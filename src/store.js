import { configureStore } from "@reduxjs/toolkit";
import sourceStations from "./features/sources/sourceStationSlice";
import sourceData from "./features/sources/sourceDataSlice";
import sourceMatch from "./features/failover/sourceMatchSlice";

export const store = configureStore({
  reducer: { sourceStations, sourceData, sourceMatch },
});
