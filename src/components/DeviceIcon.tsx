import type { ArchitectureNodeId } from "../simulation/trafficSimulation";

interface DeviceIconProps {
  nodeId: ArchitectureNodeId | "dbIndex";
}

export function DeviceIcon({ nodeId }: DeviceIconProps): React.JSX.Element {
  if (nodeId === "loadBalancer") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="18" y="18" width="12" height="12" rx="2" />
        <path d="M24 6v12M24 30v12M6 24h12M30 24h12" />
        <path d="m20 10 4-4 4 4M38 20l4 4-4 4M20 38l4 4 4-4M10 20l-4 4 4 4" />
      </svg>
    );
  }
  if (nodeId === "database" || nodeId === "dbIndex") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="11" rx="15" ry="6" />
        <path d="M9 11v26c0 3 7 6 15 6s15-3 15-6V11M9 24c0 3 7 6 15 6s15-3 15-6" />
        {nodeId === "dbIndex" && <path d="m18 35 4 4 9-10" />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 12h32v24H8zM15 42h18M24 36v6" />
      <path d="M15 19h18M15 25h12M15 31h15" />
      <circle cx="34" cy="31" r="2" />
    </svg>
  );
}
