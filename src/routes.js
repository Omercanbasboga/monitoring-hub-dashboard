import { lazy } from "react";

const SignIn = lazy(() => import("./pages/sign-in/SignIn"));
const CombinedView = lazy(() => import("./features/combined/CombinedView"));
const SourcePage = lazy(() => import("./features/sources/SourcePage"));
const SourceConfigPage = lazy(() => import("./features/sources/SourceConfigPage"));

const routes = [
  { path: "/sign-in", element: SignIn },
  { path: "/", element: CombinedView },
  { path: "/sources/:sourceType", element: SourcePage },
  { path: "/sources/:sourceType/config", element: SourceConfigPage },
];

export default routes;
