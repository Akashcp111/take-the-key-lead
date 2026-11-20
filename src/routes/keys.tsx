import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/keys")({
  head: () => ({ meta: keyguardMeta("Key Inventory", "View registered room keys, their locations, and availability.") }),
  component: () => <KeyguardApp view="keys" />,
});