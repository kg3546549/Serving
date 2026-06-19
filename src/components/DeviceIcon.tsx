import type {
  ArchitectureNodeId,
  BuildSystemType,
  MaintenanceItemType,
} from "../simulation/trafficSimulation";
import { SYSTEM_CATALOG } from "../simulation/trafficSimulation";

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

interface ResourceIconProps {
  type: BuildSystemType | MaintenanceItemType;
}

export function ResourceIcon({ type }: ResourceIconProps): React.JSX.Element {
  if (
    type === "emergencyMaintenance" ||
    type === "extendedMaintenance" ||
    type === "additionalMaintenance"
  ) {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" />
        <path d="M24 14v11l7 5M18 5h12M24 5v4" />
      </svg>
    );
  }
  const spec = SYSTEM_CATALOG[type];
  if (spec.category === "queue") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="8" y="9" width="32" height="8" rx="3" />
        <rect x="8" y="20" width="32" height="8" rx="3" />
        <rect x="8" y="31" width="32" height="8" rx="3" />
        <path d="M15 13h18M15 24h18M15 35h18" />
      </svg>
    );
  }
  if (spec.category === "security") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 5 39 11v11c0 10-6 17-15 21C15 39 9 32 9 22V11Z" />
        <path d="m17 24 5 5 10-11" />
      </svg>
    );
  }
  if (spec.category === "cache" || spec.category === "storage") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m24 6 16 9-16 9L8 15Z" />
        <path d="m8 24 16 9 16-9M8 33l16 9 16-9" />
      </svg>
    );
  }
  return (
    <DeviceIcon
      nodeId={
        spec.category === "database"
          ? "database"
          : spec.category === "loadBalancer"
            ? "loadBalancer"
            : "serverA"
      }
    />
  );
}
