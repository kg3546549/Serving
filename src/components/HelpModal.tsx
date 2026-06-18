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
          장비를 짧게 우클릭하면 상세정보가 열립니다. 우클릭 드래그 후
          다른 장비에 놓으면 간선, 빈 격자에 놓으면 위치가 바뀝니다.
        </p>

        <div className="reaction-guide">
          <div>
            <span className="reaction-icon open">＋</span>
            <strong>장비 이동</strong>
            <p>우클릭 드래그로 모든 활성 장비를 빈 격자 칸에 옮깁니다.</p>
          </div>
          <div>
            <span className="reaction-icon blocked">≋</span>
            <strong>간선 연결</strong>
            <p>장비를 우클릭 드래그해 다른 장비 위에서 놓습니다.</p>
          </div>
          <div>
            <span className="reaction-icon closed">!</span>
            <strong>자동 웨이브</strong>
            <p>하단 준비 게이지가 가득 차면 웨이브가 자동 시작됩니다.</p>
          </div>
        </div>

        <details className="learn-more">
          <summary>어떤 경로를 그려야 하나요?</summary>
          <p>
            첫 웨이브는 입구 → 앱 서버 A → 데이터베이스를 연결합니다.
            확장 후에는 입구 → 로드밸런서 → 서버 A/B → 데이터베이스의
            다섯 연결이 모두 필요합니다. 같은 간선을 다시 그리면 제거됩니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>상점과 준비 시간</summary>
          <p>
            우측 상점에서 신규 장비를 구매·배치하고 레벨을 올리거나 상품을
            리롤할 수 있습니다. 도움말과 장비 상세정보를 보는 동안 준비
            타이머는 일시 정지됩니다.
          </p>
        </details>

        <button type="button" className="soft-primary" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}
