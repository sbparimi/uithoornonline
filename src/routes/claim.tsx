import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/claim")({
  component: ClaimLayout,
});

function ClaimLayout() {
  return <Outlet />;
}
