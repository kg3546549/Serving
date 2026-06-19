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
          상단의 트래픽 입구와 응답 출구는 고정되어 있습니다. App Server와
          Primary DB를 구매·배치하고 요청부터 응답까지 링크를 완성하세요.
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
            <p>App은 요청·응답 2개, LB는 분기용 트래픽 4개를 연결합니다.</p>
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
            Wave 1은 입구 → App Server A → Primary DB → App Server A
            → 출구 경로를 만듭니다. 입구 링크는 파랑, 출구 링크는 보라,
            서버 내부의 양방향 링크는 두 색으로 표시됩니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>링크 길이와 LINK LEVEL</summary>
          <p>
            링크 길이는 두 장비 사이의 가로·세로 칸 수로 계산합니다.
            LINK LEVEL은 링크 하나의 최대 길이와 전체 사용 가능한 칸 수를
            늘립니다. 긴 경로나 분산 구조를 만들기 전에 확장해야 합니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>BOARD LEVEL은 무엇인가요?</summary>
          <p>
            처음에는 7×4 보드만 사용할 수 있습니다. 플레이어 레벨이 오르면
            BOARD SIZE 또는 LINK CAPACITY 중 하나를 선택해 확장하며, 보드는
            10×5, 최종 13×6 영역까지 열립니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>동일 장비 3개를 모으면?</summary>
          <p>
            같은 종류와 같은 성급의 장비 3개는 상위 성급 1개로 자동
            합성됩니다. 합성 직후 장비 역할에 맞는 증강 3개 중 하나를
            선택합니다. 2성에서는 레어 증강 확률이 5%, 3성에서는 15%입니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>점검 아이템은 어떻게 쓰나요?</summary>
          <p>
            긴급점검은 진행 중인 서비스를 멈추고 15초 점검시간을 엽니다.
            연장점검은 정기점검 시간을 10초 늘리고, 추가점검은 긴급점검
            횟수와 정기점검 시간을 모두 늘립니다.
          </p>
        </details>

        <details className="learn-more">
          <summary>보드를 확대하거나 이동하려면?</summary>
          <p>
            마우스 휠로 커서 위치를 중심으로 확대·축소합니다. 장비가 없는
            보드를 좌클릭 드래그하거나 휠 버튼으로 드래그하면 화면을
            이동합니다. R 키를 누르면 기본 배율과 위치로 돌아갑니다.
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
