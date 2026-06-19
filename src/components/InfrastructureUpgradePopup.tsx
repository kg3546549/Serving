import type {
  ArchitectureConfig,
} from "../simulation/trafficSimulation";
import { getBoardTier, getLinkTier } from "../simulation/trafficSimulation";
import type { InfrastructureUpgradeChoice } from "../store/gameStore";

interface InfrastructureUpgradePopupProps {
  architecture: ArchitectureConfig;
  pendingCount: number;
  onSelect: (choice: InfrastructureUpgradeChoice) => void;
}

export function InfrastructureUpgradePopup({
  architecture,
  pendingCount,
  onSelect,
}: InfrastructureUpgradePopupProps): React.JSX.Element {
  const boardTier = getBoardTier(architecture.boardLevel);
  const linkTier = getLinkTier(architecture.linkLevel);
  const boardMax = boardTier.upgradeCost === null;
  const linkMax = linkTier.upgradeCost === null;

  return (
    <div className="choice-overlay">
      <section
        className="choice-modal infrastructure-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="infra-upgrade-title"
      >
        <span className="choice-kicker">LEVEL UP REWARD</span>
        <h2 id="infra-upgrade-title">인프라 확장 선택</h2>
        <p>
          레벨업 보상으로 링크 용량 또는 보드 크기를 확장합니다.
          {pendingCount > 1 ? ` 선택 ${pendingCount}회 남음` : ""}
        </p>
        <div className="choice-options choice-options--two">
          <button
            type="button"
            className="choice-card"
            disabled={linkMax}
            onClick={() => onSelect("link")}
          >
            <small>LINK UPGRADE</small>
            <strong>라인 추가</strong>
            <span>
              전체 링크 용량과 링크 하나의 최대 연결 길이를 늘립니다.
            </span>
            <b>
              {linkMax
                ? "MAX LEVEL"
                : `LV.${linkTier.level} → LV.${linkTier.level + 1}`}
            </b>
          </button>
          <button
            type="button"
            className="choice-card"
            disabled={boardMax}
            onClick={() => onSelect("board")}
          >
            <small>BOARD UPGRADE</small>
            <strong>보드 사이즈 추가</strong>
            <span>새 장비를 배치할 수 있는 격자 영역을 확장합니다.</span>
            <b>
              {boardMax
                ? "MAX LEVEL"
                : `LV.${boardTier.level} → LV.${boardTier.level + 1}`}
            </b>
          </button>
        </div>
      </section>
    </div>
  );
}
