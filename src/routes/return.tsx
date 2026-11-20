import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/return")({
  head: () => ({ meta: keyguardMeta("Return a Key", "Close an active room key issue and update key availability.") }),
  component: () => <KeyguardApp view="return" />,
});