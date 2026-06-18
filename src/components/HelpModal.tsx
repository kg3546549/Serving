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
        <h2 id="help-title">요청이 응답으로 돌아오게 구성하세요</h2>
        <p className="help-lead">
          트래픽 입구만 고정되어 있습니다. App Server와 Primary DB를
          상점에서 구매하고 배치한 뒤 장비 사이 경로를 연결하세요.
        </p>

        <div className="reaction-guide">
          <div>
            <span className="reaction-icon open">＋</span>
            <strong>구매·배치</strong>
            <p>상점에서 구매한 장비를 하단 보유 장비 바에서 드래그합니다.</p>
          </div>
          <div>
            <span className="reaction-icon blocked">≋</span>
            <strong>포트 제한</strong>
            <p>App은 트래픽 1개, LB는 트래픽 3개를 연결합니다.</p>
          </div>
          <div>
            <span className="reaction-icon closed">!</span>
            <strong>요청 생명주기</strong>
            <p>서버 처리 후 DB 작업과 응답 반환까지 끝나야 성공입니다.</p>
          </div>
        </div>

        <details className="learn-more">
          <summary>어떤 경로를 그려야 하나요?</summary>
          <p>
            Wave 1은 입구 → App Server A → Primary DB를 연결합니다.
            Wave 5부터는 입구 → Load Balancer → 서버 A/B → DB의 분산
            경로를 만들 수 있습니다. 입구 위치는 이동할 수 없습니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>간선 길이와 LINK LEVEL</summary>
          <p>
            간선 길이는 두 장비 사이의 가로·세로 칸 수로 계산합니다.
            LINK LEVEL은 간선 하나의 최대 길이와 전체 사용 가능한 칸 수를
            늘립니다. 긴 경로나 분산 구조를 만들기 전에 확장해야 합니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>DB는 무엇을 하나요?</summary>
          <p>
            GET은 DB 읽기, POST는 DB 저장을 수행합니다. DB에도 동시 처리
            슬롯과 Queue가 있으므로 서버만 증설하면 DB가 다음 병목이 됩니다.
            Wave 8부터 DB Index를 구매해 Slow Query를 줄일 수 있습니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>실패와 서비스 HP</summary>
          <p>
            Queue 초과와 응답 제한시간 초과 요청은 서비스 HP를 감소시킵니다.
            점검시간마다 장비를 구매·재배치한 뒤 다음 웨이브로 진행합니다.
          </p>
        </details>

        <button type="button" className="soft-primary" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}
