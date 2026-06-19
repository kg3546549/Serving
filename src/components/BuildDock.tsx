import type { WaveDefinition } from "../campaign/campaignData";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
} from "../simulation/trafficSimulation";
import { SYSTEM_CATALOG } from "../simulation/trafficSimulation";
import { DeviceIcon } from "./DeviceIcon";
import { DEVICE_INFO } from "./devicePresentation";

interface BuildDockProps {
  architecture: ArchitectureConfig;
  ownedNodes: ArchitectureNodeId[];
  coins: number;
  disabled: boolean;
  waveIndex: number;
  wave: WaveDefinition;
  onPurchaseSystem: (systemType: BuildSystemType) => void;
  onClearConnections: () => void;
}

const SHOP_ORDER: readonly BuildSystemType[] = [
  "serverA",
  "database",
  "loadBalancer",
  "serverB",
  "dbIndex",
];

function isPurchased(
  systemType: BuildSystemType,
  architecture: ArchitectureConfig,
  ownedNodes: ArchitectureNodeId[],
): boolean {
  if (systemType === "dbIndex") {
    return architecture.databaseIndexed;
  }
  const nodeId = SYSTEM_CATALOG[systemType].nodeId;
  return nodeId ? ownedNodes.includes(nodeId) : false;
}

export function BuildDock({
  architecture,
  ownedNodes,
  coins,
  disabled,
  waveIndex,
  wave,
  onPurchaseSystem,
  onClearConnections,
}: BuildDockProps): React.JSX.Element {
  const currentWave = waveIndex + 1;

  return (
    <aside className="build-dock" aria-label="인프라 상점">
      <header className="shop-header">
        <div>
          <span>STAGE 01 · HTTPS API</span>
          <strong>인프라 상점</strong>
        </div>
        <div className="shop-wallet" aria-label={`보유 재화 ${coins}`}>
          <small>CREDITS</small>
          <strong>◈ {coins}</strong>
        </div>
      </header>

      <section className="wave-brief">
        <span>
          WAVE {String(wave.id).padStart(2, "0")} · {wave.protocol}
        </span>
        <strong>{wave.name}</strong>
        <p>{wave.description}</p>
      </section>

      <div className="request-lifecycle" aria-label="요청 처리 순서">
        <span>REQUEST</span>
        <i>→</i>
        <span>APP</span>
        <i>→</i>
        <span>DB</span>
        <i>→</i>
        <span>RESPONSE</span>
      </div>

      <div className="shop-offers">
        {SHOP_ORDER.map((systemType) => {
          const item = SYSTEM_CATALOG[systemType];
          const purchased = isPurchased(
            systemType,
            architecture,
            ownedNodes,
          );
          const locked = item.unlockWave > currentWave;
          const requiresDatabase =
            systemType === "dbIndex" && !architecture.hasDatabase;
          return (
            <button
              key={systemType}
              type="button"
              className="shop-offer"
              disabled={
                disabled ||
                locked ||
                purchased ||
                requiresDatabase ||
                coins < item.cost
              }
              onClick={() => onPurchaseSystem(systemType)}
            >
              <span className="build-icon">
                <DeviceIcon nodeId={item.nodeId ?? "dbIndex"} />
              </span>
              <span className="build-copy">
                <small>
                  {locked
                    ? `WAVE ${item.unlockWave} 해금`
                    : systemType === "dbIndex"
                      ? "DATABASE UPGRADE"
                      : DEVICE_INFO[item.nodeId!].category}
                </small>
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
              <span className="build-price">
                <strong>
                  {purchased
                    ? "OWNED"
                    : locked
                      ? "LOCKED"
                      : requiresDatabase
                        ? "DB 필요"
                        : `◈ ${item.cost}`}
                </strong>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="shop-footer">
        <p>
          좌클릭 드래그: 이동 · 우클릭/Shift+드래그: 링크 · 입출구는 고정
        </p>
        <button
          type="button"
          className="route-reset-button"
          onClick={onClearConnections}
          disabled={disabled || architecture.connections.length === 0}
        >
          모든 링크 제거
        </button>
      </footer>
    </aside>
  );
}
