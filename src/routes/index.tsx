import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: keyguardMeta(
      "Room Key Register",
      "Review room-key availability, active issues, overdue returns, and office activity.",
    ),
  }),
  component: () => <KeyguardApp view="dashboard" />,
});
