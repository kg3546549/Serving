import type {
  NodeInstance,
  ShopItemType,
} from "../simulation/trafficSimulation";
import {
  isMaintenanceItem,
  MAINTENANCE_CATALOG,
  SYSTEM_CATALOG,
} from "../simulation/trafficSimulation";
import { ResourceIcon } from "./DeviceIcon";

interface ResourceDetailsPopupProps {
  type: ShopItemType;
  instance?: NodeInstance;
  onClose: () => void;
  onSell?: () => void;
}

const CATEGORY_COPY: Record<string, string> = {
  server: "요청 처리",
  database: "데이터 영속성",
  loadBalancer: "트래픽 분산",
  queue: "비동기 완충",
  security: "보안 필터",
  cache: "응답 가속",
  storage: "대용량 저장",
};

export function ResourceDetailsPopup({
  type,
  instance,
  onClose,
  onSell,
}: ResourceDetailsPopupProps): React.JSX.Element {
  const maintenance = isMaintenanceItem(type);
  const spec = maintenance
    ? MAINTENANCE_CATALOG[type]
    : SYSTEM_CATALOG[type];
  const category = maintenance
    ? "점검 패시브"
    : CATEGORY_COPY[SYSTEM_CATALOG[type].category];
  const tier = maintenance ? null : SYSTEM_CATALOG[type].tier;

  return (
    <div className="choice-overlay resource-overlay" onMouseDown={onClose}>
      <section
        className="resource-details-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="resource-details-close"
          onClick={onClose}
          aria-label="장비 상세 닫기"
        >
          ×
        </button>
        <div className="resource-details-icon">
          <ResourceIcon type={type} />
        </div>
        <span className="resource-details-kicker">
          {maintenance ? "PASSIVE ITEM" : `TIER ${tier} · ${category}`}
        </span>
        <h2 id="resource-details-title">{spec.name}</h2>
        <p>{spec.description}</p>
        <div className="resource-details-stats">
          <span>
            <small>COST</small>
            <strong>{spec.cost}</strong>
          </span>
          <span>
            <small>TYPE</small>
            <strong>{category}</strong>
          </span>
          {instance && (
            <span>
              <small>GRADE</small>
              <strong>{"★".repeat(instance.starLevel)}</strong>
            </span>
          )}
        </div>
        {instance?.augment && (
          <div className="resource-augment">
            <small>ACTIVE AUGMENT</small>
            <strong>{instance.augment}</strong>
          </div>
        )}
        <p className="resource-details-tip">
          {maintenance
            ? "구매 즉시 점검 능력에 적용됩니다."
            : "동일 장비 3개를 모으면 성급이 오르고 증강 선택이 열립니다."}
        </p>
        {onSell && (
          <button type="button" className="resource-sell-button" onClick={onSell}>
            장비 판매
          </button>
        )}
      </section>
    </div>
  );
}
