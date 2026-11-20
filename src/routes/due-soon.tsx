import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/due-soon")({
  head: () => ({ meta: keyguardMeta("Due Soon", "View active room key issues due within 30 minutes.") }),
  component: () => <KeyguardApp view="due-soon" />,
});