import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { ModuleWorkspace } from "@/components/module-workspace";
import { getModule, moduleKeys } from "@/lib/erp-data";
import "./styles.css";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  )
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard
});

const moduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$moduleKey",
  component: ModuleRoute
});

function ModuleRoute() {
  const { moduleKey } = moduleRoute.useParams();
  const module = getModule(moduleKey);

  if (!module || !moduleKeys.includes(module.key)) {
    return (
      <div className="mx-auto max-w-[1600px] p-7">
        <h1 className="text-2xl font-bold">Module not found</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">The requested ERP module does not exist.</p>
      </div>
    );
  }

  return <ModuleWorkspace moduleKey={module.key} />;
}

const routeTree = rootRoute.addChildren([indexRoute, moduleRoute]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
