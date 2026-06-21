import type {
  ArchitectureNodeId,
  BuildSystemType,
  MaintenanceItemType,
} from "../simulation/trafficSimulation";
import { SYSTEM_CATALOG } from "../simulation/trafficSimulation";
import { DEVICE_ICON_META } from "../config/deviceIconMeta";

interface DeviceIconProps {
  nodeId: ArchitectureNodeId | "dbIndex";
}

export function DeviceIcon({ nodeId }: DeviceIconProps): React.JSX.Element {
  const targetId = nodeId === "dbIndex" ? "database" : nodeId;
  const meta = DEVICE_ICON_META[targetId];
  if (!meta) {
    return DEVICE_ICON_META.serverA.reactRender();
  }

  if (nodeId === "dbIndex") {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {meta.reactRender()}
        <svg
          viewBox="0 0 48 48"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none"
          }}
        >
          <path
            d="m18 35 4 4 9-10"
            fill="none"
            stroke="#1da4a0"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return meta.reactRender();
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
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <circle cx="24" cy="24" r="17" />
        <path d="M24 14v11l7 5M18 5h12M24 5v4" />
      </svg>
    );
  }
  const spec = SYSTEM_CATALOG[type];
  if (spec.category === "queue") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <rect x="8" y="9" width="32" height="8" rx="3" />
        <rect x="8" y="20" width="32" height="8" rx="3" />
        <rect x="8" y="31" width="32" height="8" rx="3" />
        <path d="M15 13h18M15 24h18M15 35h18" />
      </svg>
    );
  }
  if (spec.category === "security") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
        <path d="M24 5 39 11v11c0 10-6 17-15 21C15 39 9 32 9 22V11Z" />
        <path d="m17 24 5 5 10-11" />
      </svg>
    );
  }
  if (spec.category === "cache" || spec.category === "storage") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
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
