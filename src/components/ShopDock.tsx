import type { WaveDefinition } from "../campaign/campaignData";
import type { ShopItemType } from "../simulation/trafficSimulation";
import {
  isMaintenanceItem,
  MAINTENANCE_CATALOG,
  SYSTEM_CATALOG,
} from "../simulation/trafficSimulation";
import { XP_REQUIREMENTS } from "../store/gameStore";
import { ResourceIcon } from "./DeviceIcon";

interface ShopDockProps {
  playerLevel: number;
  playerXp: number;
  shopItems: (ShopItemType | null)[];
  coins: number;
  disabled: boolean;
  wave: WaveDefinition;
  emergencyMaintenanceCharges: number;
  maintenanceExtensionMs: number;
  onRollShop: () => void;
  onBuyXp: () => void;
  onBuyShopItem: (index: number) => void;
  onInspectItem: (item: ShopItemType) => void;
  onClearConnections: () => void;
}

export function ShopDock({
  playerLevel,
  playerXp,
  shopItems,
  coins,
  disabled,
  wave,
  emergencyMaintenanceCharges,
  maintenanceExtensionMs,
  onRollShop,
  onBuyXp,
  onBuyShopItem,
  onInspectItem,
  onClearConnections,
}: ShopDockProps): React.JSX.Element {
  const requiredXp = XP_REQUIREMENTS[playerLevel] || 0;
  const xpPercent =
    playerLevel >= 10 || requiredXp === 0
      ? 100
      : Math.min(100, (playerXp / requiredXp) * 100);

  return (
    <aside className="shop-dock" aria-label="인프라 상점">
      <header className="shop-header">
        <div className="shop-title-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M7 9h5l4 22h20l5-15H15M19 40a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM35 40a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          </svg>
        </div>
        <div>
          <strong>인프라 상점</strong>
          <span>좌클릭 구매 · 우클릭 상세</span>
        </div>
      </header>

      <section className="wave-brief">
        <span>WAVE {String(wave.id).padStart(2, "0")} · {wave.protocol}</span>
        <strong>{wave.name}</strong>
      </section>

      <section className="shop-level-panel" aria-label="플레이어 레벨">
        <div className="shop-level-row">
          <div>
            <small>PLAYER LEVEL</small>
            <strong>LV. {playerLevel}</strong>
          </div>
          <span>{playerLevel >= 10 ? "MAX" : `${playerXp} / ${requiredXp} XP`}</span>
        </div>
        <div className="shop-xp-track"><i style={{ width: `${xpPercent}%` }} /></div>
        <div className="shop-level-actions">
          <button
            type="button"
            onClick={onBuyXp}
            disabled={disabled || coins < 4 || playerLevel >= 10}
          >
            레벨업 XP <b>4</b>
          </button>
          <button
            type="button"
            onClick={onRollShop}
            disabled={disabled || coins < 2}
          >
            상점 새로고침 <b>2</b>
          </button>
        </div>
      </section>

      <div className="maintenance-summary">
        <span>긴급점검 <strong>{emergencyMaintenanceCharges}회</strong></span>
        <span>정기점검 연장 <strong>+{maintenanceExtensionMs / 1000}초</strong></span>
      </div>

      <div className="shop-offers">
        {shopItems.map((item, index) => {
          if (!item) {
            return <div className="shop-offer shop-offer--empty" key={`empty-${index}`} />;
          }
          const maintenance = isMaintenanceItem(item);
          const spec = maintenance
            ? MAINTENANCE_CATALOG[item]
            : SYSTEM_CATALOG[item];
          const cost = spec.cost;
          const category = maintenance
            ? "PASSIVE"
            : SYSTEM_CATALOG[item].category.toUpperCase();
          const tier = maintenance ? null : SYSTEM_CATALOG[item].tier;

          return (
            <button
              type="button"
              className={`shop-offer ${maintenance ? "shop-offer--passive" : ""}`}
              key={`${item}-${index}`}
              onClick={() => {
                if (!disabled && coins >= cost) {
                  onBuyShopItem(index);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                onInspectItem(item);
              }}
              aria-disabled={disabled || coins < cost}
              title="좌클릭 구매 · 우클릭 상세"
            >
              <span className="shop-offer-icon">
                <ResourceIcon type={item} />
              </span>
              <span className="shop-offer-copy">
                <small>{tier ? `TIER ${tier}` : category}</small>
                <strong>{spec.name}</strong>
              </span>
              <span className="shop-offer-price">
                <small>{maintenance ? "PASSIVE" : "BUY"}</small>
                <strong>{cost}</strong>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="shop-footer">
        <button
          type="button"
          className="route-reset-button"
          onClick={onClearConnections}
          disabled={disabled}
        >
          모든 링크 제거
        </button>
      </footer>
    </aside>
  );
}
