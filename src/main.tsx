import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "./app/routes.tsx";
import "./design-system/tokens.css";
import "./design-system/vendor/kage.css";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root がない");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routes)} />
  </StrictMode>,
);
