import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/keys/register")({
  head: () => ({ meta: keyguardMeta("Register a Key", "Add a fictional room key to the KEYGUARD inventory.") }),
  component: () => <KeyguardApp view="register" />,
});