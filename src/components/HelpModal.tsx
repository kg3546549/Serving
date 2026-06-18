interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps): React.JSX.Element {
  return (
    <div className="soft-overlay">
      <section
        className="help-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="도움말 닫기"
        >
          ×
        </button>

        <div className="help-mascot" aria-hidden="true">
          ?
        </div>
        <h2 id="help-title">설계하고 병목을 막으세요</h2>
        <p className="help-lead">
          장비 사이를 드래그해 트래픽 길을 그리세요. 확장 장비는 카드를
          빈 격자 칸으로 드래그하거나, 카드를 선택한 뒤 칸을 눌러 배치합니다.
        </p>

        <div className="reaction-guide">
          <div>
            <span className="reaction-icon open">＋</span>
            <strong>격자 배치</strong>
            <p>해금된 장비를 비어 있는 격자 칸 어디든 배치합니다.</p>
          </div>
          <div>
            <span className="reaction-icon blocked">≋</span>
            <strong>경로 연결</strong>
            <p>장비에서 다른 장비까지 직접 선을 그려 요청 경로를 만듭니다.</p>
          </div>
          <div>
            <span className="reaction-icon closed">!</span>
            <strong>병목 관찰</strong>
            <p>Queue와 압력 링을 보고 서버가 막히는 위치를 확인합니다.</p>
          </div>
        </div>

        <details className="learn-more">
          <summary>어떤 경로를 그려야 하나요?</summary>
          <p>
            첫 웨이브는 입구 → 앱 서버 A → 데이터베이스를 연결합니다.
            확장 후에는 입구 → 로드밸런서 → 서버 A/B → 데이터베이스의
            다섯 연결이 모두 필요합니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>클리어 조건</summary>
          <p>
            Wave 1은 성공률 95%, Wave 2는 성공률 90% 이상이 목표입니다.
            같은 선을 다시 그리면 연결이 제거되며, 실패해도 번 코인과 설치
            시설은 유지됩니다.
          </p>
        </details>

        <button type="button" className="soft-primary" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}
