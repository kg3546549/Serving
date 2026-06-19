import type { ArchitectureNodeId } from "../simulation/trafficSimulation";

export const DEVICE_INFO: Readonly<
  Record<ArchitectureNodeId, { name: string; category: string }>
> = {
  entry: { name: "Traffic Ingress", category: "FIXED ENTRY" },
  exit: { name: "Response Egress", category: "FIXED EXIT" },
  loadBalancer: { name: "Load Balancer", category: "ROUTING" },
  serverA: { name: "App Server A", category: "COMPUTE" },
  serverB: { name: "App Server B", category: "COMPUTE" },
  database: { name: "Primary DB", category: "DATABASE" },
} as const;
