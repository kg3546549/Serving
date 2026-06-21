결론: Phaser 구현 방향
배경 / 보드 / 링크 / 노드 = Phaser WebGL
상단 HUD / 우측 상점 / 하단 인벤토리 = Phaser UI 레이어
발광 = 거의 안 씀
애니메이션 = 상태 변화 때만 매우 짧고 약하게

즉 이전 네온 시안 UI처럼:

Glow + Bloom + Particle + Shine

이 아니라,

정확한 spacing
+ 9-slice 패널
+ icon atlas
+ subtle shadow
+ thin border
+ small easing

으로 가야 합니다.

Phaser는 WebGL/Canvas 렌더링을 제공하지만, 이 디자인처럼 카드·패널 중심 UI를 구현할 때는 WebGL 기준으로 고정하는 편이 좋습니다. Phaser의 FX는 WebGL 전용이므로, 필요 없는 경우에도 WebGL 렌더러를 쓰면 확장성이 남습니다.

1. Phaser 렌더러는 WebGL 고정

Canvas 렌더러로도 화면은 만들 수 있지만, 패널 그림자, 알파 블렌딩, 약한 blur, 향후 상태 이펙트까지 생각하면 WebGL로 고정하세요.

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: "game-root",
  width: 1920,
  height: 1080,
  backgroundColor: "#F3F8FD",
  scene: [BootScene, MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false,
  },
};

여기서 중요한 건 기준 해상도를 하나 정하는 겁니다.

추천 기준 해상도:
1920 × 1080
또는
1600 × 900

현재 이미지 비율은 16:9라서, 내부 UI 좌표도 16:9 고정 캔버스로 설계하고 FIT으로 스케일하는 편이 편합니다.

2. 화면을 Scene 하나에 다 넣지 말고 레이어 구조를 고정

이 UI는 레이어가 명확해야 합니다.

MainScene
├─ BackgroundLayer
│  ├─ 기본 배경색
│  ├─ 은은한 상단 그라데이션
│  └─ 아주 약한 배경 그리드
│
├─ BoardLayer
│  ├─ 중앙 보드 프레임
│  ├─ 타일 셀
│  ├─ 링크 라인
│  └─ 인프라 노드
│
├─ HudLayer
│  ├─ 상단 스테이지 / 웨이브 / KPI
│  ├─ 우측 상점
│  ├─ 하단 리소스 / 카드 트레이
│  └─ 진행바
│
└─ OverlayLayer
   ├─ 선택 노드 상세 패널
   ├─ 툴팁
   ├─ 드래그 프리뷰
   └─ 모달

Phaser Container를 각 레이어의 관리 단위로 쓰면 됩니다.

class MainScene extends Phaser.Scene {
  private backgroundLayer!: Phaser.GameObjects.Container;
  private boardLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;

  create() {
    this.backgroundLayer = this.add.container(0, 0);
    this.boardLayer = this.add.container(0, 0);
    this.hudLayer = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0);
  }
}

Container는 Game Object를 묶어 위치, 스케일, 알파, 가시성 등을 함께 제어하는 데 적합합니다. Game Object는 하나의 Scene에만 속할 수 있으므로, Scene 분리보다 레이어 Container 분리가 이 화면에는 더 자연스럽습니다.

3. 가장 중요한 것: 패널을 Graphics로 매번 그리지 말 것

이 이미지의 핵심은 카드와 패널입니다.

상단 카드
우측 상점 카드
하단 자원 카드
노드 카드
선택 상세 카드
보드 외곽 패널

이걸 전부 Graphics.fillRoundedRect()로 만들면 처음에는 빨리 만들 수 있지만, 완성도가 낮아지고 수정도 힘듭니다.

최고 퀄리티는:

Figma에서 패널 에셋 제작
→ 9-slice 가능한 패널 PNG 제작
→ Phaser NineSlice 사용
→ 텍스트 / 아이콘 / 숫자만 위에 얹기

Phaser의 Nine Slice는 중앙 영역만 늘리고 모서리는 유지하기 때문에, 크기가 달라지는 UI 패널이나 버튼에 적합합니다. 공식 문서도 버튼과 UI처럼 늘어나야 하지만 모서리가 왜곡되면 안 되는 요소에 유용하다고 설명합니다.

예시:

const panel = this.add.nineslice(
  0,
  0,
  "panel-light",
  undefined,
  320,
  160,
  18,
  18,
  18,
  18
);

panel.setOrigin(0, 0);

추천 에셋 종류는 이 정도면 됩니다.

panel-light.png
panel-soft.png
panel-selected.png
panel-disabled.png
shop-card.png
node-card-blue.png
node-card-purple.png
node-card-teal.png
slot-empty.png
progress-track.png
progress-fill.png
badge-green.png
badge-warning.png
4. “발광 없는 깔끔함”은 그림자와 테두리로 만든다

이 이미지에는 강한 네온 Glow가 아니라 다음이 있습니다.

1. 얇은 푸른 회색 외곽선
2. 미세한 위쪽 하이라이트
3. 약한 드롭 섀도우
4. 은은한 내부 음영
5. 연한 파스텔 포인트 컬러

즉 Phaser FX의 Glow/Bloom은 거의 쓰지 않는 게 맞습니다.

Phaser는 Glow, Bloom, Blur 같은 FX를 제공하지만 이들은 WebGL 전용이고, 이 디자인에서는 선택 상태나 경고 상태에만 제한적으로 쓰는 것이 좋습니다.

추천 상태 표현:

기본 상태:
- 테두리 #D7E2F1
- 그림자 rgba(60, 80, 120, 0.10)

선택 상태:
- 테두리 #79C9E8
- 약한 cyan outer shadow
- scale 1.01

정상 상태:
- 초록 상태점
- 매우 약한 pulse

경고 상태:
- 주황 테두리
- warning icon
- glow 대신 1.5초 opacity pulse
5. UI 패널은 “에셋 + 얇은 그림자”로 설계

Phaser에서 카드 하나를 만드는 구조는 이렇게 두는 게 좋습니다.

NodeCard Container
├─ shadow image
├─ panel background NineSlice
├─ icon background tile
├─ service icon sprite
├─ title text
├─ subtitle text
├─ status dot
├─ queue badge
└─ optional warning badge

예시:

function createInfraNode(
  scene: Phaser.Scene,
  x: number,
  y: number,
  data: {
    title: string;
    subtitle: string;
    icon: string;
    color: number;
    queue: number;
    status: "normal" | "warning" | "selected";
  }
) {
  const container = scene.add.container(x, y);

  const shadow = scene.add.image(3, 5, "node-card-shadow")
    .setOrigin(0.5)
    .setAlpha(0.18);

  const bg = scene.add.nineslice(
    0,
    0,
    "node-card-light",
    undefined,
    112,
    122,
    14,
    14,
    14,
    14
  ).setOrigin(0.5);

  const iconBg = scene.add.rectangle(0, -28, 58, 58, data.color, 1)
    .setStrokeStyle(1, 0xFFFFFF, 0.65);

  const icon = scene.add.image(0, -28, data.icon)
    .setDisplaySize(34, 34);

  const title = scene.add.text(0, 16, data.title, {
    fontFamily: "Pretendard, Arial",
    fontSize: "13px",
    fontStyle: "700",
    color: "#24446A",
    align: "center",
  }).setOrigin(0.5);

  const subtitle = scene.add.text(0, 34, data.subtitle, {
    fontFamily: "Pretendard, Arial",
    fontSize: "11px",
    color: "#6E8098",
    align: "center",
  }).setOrigin(0.5);

  const queueBadge = scene.add.text(0, 55, `QUEUE ${data.queue}`, {
    fontFamily: "Pretendard, Arial",
    fontSize: "10px",
    fontStyle: "700",
    color: data.queue > 0 ? "#E68A21" : "#34A56A",
    backgroundColor: "#F2F6FA",
    padding: { x: 7, y: 4 },
  }).setOrigin(0.5);

  container.add([
    shadow,
    bg,
    iconBg,
    icon,
    title,
    subtitle,
    queueBadge,
  ]);

  return container;
}
6. 배경은 CSS 느낌이 아니라 “정적 텍스처”로 만들어라

이미지처럼 깨끗한 배경을 Phaser Graphics로 매 프레임 만들 필요 없습니다.

추천은:

배경 이미지 1장
+ 보드 배경 이미지 1장
+ 정적 그리드 텍스처
+ 아주 약한 그라데이션 overlay

배경은 다음처럼 에셋화하세요.

background-base.webp
background-grid.webp
board-surface.webp
board-grid.webp

이유는 단순합니다.

CSS식 배경 효과를 Phaser Graphics로 즉석 생성하면
미세한 질감과 품질 통제가 어려움.

특히 이 UI는 “게임 보드”라기보다 “디자인 시스템 UI”에 가까워서, 배경 자체를 디자인 에셋으로 정리하는 편이 훨씬 좋습니다.

정적 그리드나 보드 프레임은 RenderTexture로 한 번 렌더링해서 재사용해도 됩니다. Phaser RenderTexture는 Game Object를 동적 텍스처로 그려 재사용할 수 있는 기능입니다.

7. 링크는 Glow 대신 “두께 + 색상 계층”만 사용

이 이미지의 링크는 화려한 네온이 아니라:

기본 선: 연한 파랑
강조 선: 조금 진한 파랑
DB 연결: 노랑/앰버
응답 링크: 보라

입니다.

링크를 그릴 때도 강한 blur는 넣지 마세요.

function createLink(
  scene: Phaser.Scene,
  points: Phaser.Math.Vector2[],
  color: number
) {
  const softLine = scene.add.graphics();
  softLine.lineStyle(7, color, 0.14);
  softLine.beginPath();
  softLine.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    softLine.lineTo(points[i].x, points[i].y);
  }

  softLine.strokePath();

  const coreLine = scene.add.graphics();
  coreLine.lineStyle(3, color, 0.88);
  coreLine.beginPath();
  coreLine.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    coreLine.lineTo(points[i].x, points[i].y);
  }

  coreLine.strokePath();

  return { softLine, coreLine };
}

여기서 softLine은 glow가 아니라 선 두께로 생기는 부드러운 하이라이트 정도로 쓰면 됩니다.

색상 예시:

const COLORS = {
  request: 0x70A8F8,
  response: 0xA88BEA,
  database: 0xF4C55B,
  disabled: 0xCCD7E5,
  danger: 0xE87979,
};
8. 패킷 애니메이션도 최소화

이미지 스타일은 타워디펜스처럼 패킷이 계속 우르르 흐르는 UI가 아닙니다.

따라서 패킷은 다음 정도가 적절합니다.

정상:
- 링크당 1~2개 작은 밝은 점
- 1.5~2.5초 주기
- 낮은 알파

요청 증가:
- 링크당 3~5개
- 속도 증가
- 밀도 증가

병목:
- DB 진입 지점에서 패킷 느려짐
- Queue 숫자 증가
- 주황 점 1~2개만 추가

Phaser Curve와 Tween 또는 update 기반 이동을 쓰면 됩니다.

const curve = new Phaser.Curves.Path(200, 200)
  .lineTo(400, 200)
  .lineTo(400, 360);

const packet = this.add.image(200, 200, "packet-dot")
  .setScale(0.75)
  .setAlpha(0.8);

this.tweens.add({
  targets: packet,
  duration: 1800,
  repeat: -1,
  ease: "Linear",
  onUpdate: (tween) => {
    const point = curve.getPoint(tween.progress);
    packet.setPosition(point.x, point.y);
  },
});

단, 패킷을 너무 많이 만들지 마세요.
이 UI에서는 “데이터가 흐른다”는 신호만 있으면 충분합니다.

파티클이 필요할 때 Phaser의 ParticleEmitter는 풀 방식으로 입자를 관리하므로 배경 먼지, 작은 상태 이펙트 등에 사용할 수 있습니다.

9. 애니메이션은 “짧고 기능적인 것만”

이 디자인에서는 모든 요소가 움직이면 오히려 싸 보입니다.

추천 모션 기준:

hover:
120~160ms

선택:
150~220ms

패널 열기:
180~240ms

노드 배치:
220~320ms

경고 pulse:
1.5~2.0초

진행바 변화:
300~500ms

추천 easing:

Sine.easeOut
Sine.easeInOut
Quad.easeOut
Cubic.easeOut

Phaser는 tween 기반 애니메이션을 제공하고, Sine easing은 부드럽고 과하지 않은 UI 전환에 적합합니다.

예시:

this.tweens.add({
  targets: nodeContainer,
  scaleX: 1.015,
  scaleY: 1.015,
  duration: 140,
  ease: "Sine.easeOut",
  yoyo: true,
});

경고 상태도 Glow 대신 살짝만:

this.tweens.add({
  targets: warningBadge,
  alpha: { from: 1, to: 0.45 },
  duration: 900,
  yoyo: true,
  repeat: -1,
  ease: "Sine.easeInOut",
});
10. 텍스트는 일반 Text와 BitmapText를 구분

이 이미지처럼 한글이 많고 UI 텍스트가 중요하면 기본적으로 Phaser Text를 써도 됩니다.

다만 다음은 BitmapText가 좋습니다.

- 빠르게 바뀌는 Requests 수
- Credits
- Queue 수
- Wave 카운터
- HP
- 진행바 수치

BitmapText는 PNG 기반 글리프 아틀라스와 XML/JSON 폰트 정의를 사용합니다. 숫자나 반복 업데이트되는 상태 텍스트에 특히 좋습니다.

하지만 한글 전체를 BitmapText로 만들면 폰트 아틀라스가 커지고 관리가 귀찮습니다.

그래서 추천은:

제목 / 설명 / 한글 UI:
Phaser Text

자주 바뀌는 숫자:
BitmapText

아이콘:
Sprite Atlas
11. 상점은 스크롤 컨테이너를 직접 설계

우측 상점은 Phaser의 기본 DOM 스크롤이 아니라, 내부 콘텐츠 컨테이너를 만들고 clip/mask로 잘라내는 방식이 좋습니다.

ShopPanel
├─ background NineSlice
├─ header
├─ mission card
├─ scroll viewport
│  ├─ item card 1
│  ├─ item card 2
│  ├─ item card 3
│  └─ ...
└─ scroll bar

스크롤 viewport는 GeometryMask로 자릅니다.

const viewport = this.add.container(panelX, panelY);

const maskGraphics = this.make.graphics({});
maskGraphics.fillRect(scrollX, scrollY, scrollWidth, scrollHeight);

const mask = maskGraphics.createGeometryMask();
viewport.setMask(mask);

Phaser의 Graphics는 선, 사각형, arc 등 기하 도형을 만들 수 있고 Geometry Mask 구성에도 사용됩니다.

드래그 및 상점 카드 선택은 Phaser Input으로 처리합니다. Phaser는 마우스와 터치를 통합한 Input 시스템을 제공하며, 드래그 이벤트도 제공합니다.

12. 보드 드래그/줌은 카메라보다 “보드 컨테이너”가 편할 수 있음

이 이미지처럼 화면 전체를 큰 맵으로 탐색하는 구조가 아니라, 중앙 보드가 정해진 UI 영역 안에 있는 구조라면:

Camera pan / zoom
보다
BoardContainer scale / position

이 더 관리하기 편합니다.

즉:

boardContainer.setScale(boardZoom);
boardContainer.setPosition(boardOffsetX, boardOffsetY);

카메라를 쓰면 HUD가 같이 움직이지 않도록 Scene을 나누거나 scrollFactor를 계속 관리해야 합니다.

만약 보드를 크게 확장하고 무한 캔버스처럼 만들 계획이면 Camera를 쓰세요. Phaser Camera는 pan, zoom, shake 등 효과를 제공합니다.

현재 이미지 기준으로는:

HUD = 고정
보드 = 중앙 영역에서만 줌/팬

이므로 BoardContainer 중심 설계를 추천합니다.

13. 이미지와 같은 화면을 위한 에셋 체크리스트

이걸 준비하면 코드보다 퀄리티가 먼저 올라갑니다.

공통
- background-soft.webp
- board-frame.webp
- board-tile.webp
- panel-light-9slice.png
- panel-muted-9slice.png
- button-light.png
- divider.png
- progress-track.png
- progress-fill.png

노드
- node-blue-9slice.png
- node-purple-9slice.png
- node-teal-9slice.png
- node-warning-9slice.png
- queue-badge.png
- status-dot.png

아이콘
- ingress.png
- load-balancer.png
- app-server.png
- database.png
- response-egress.png
- cache.png
- waf.png
- api-gateway.png

상점
- shop-card.png
- shop-card-owned.png
- price-coin.png
- scrollbar-track.png
- scrollbar-thumb.png

상태
- active-badge.png
- warning-badge.png
- fixed-badge.png
- locked-badge.png

아이콘은 가능하면 Figma에서 통일된 2px stroke 스타일로 만들고, 한 장의 atlas로 묶는 게 좋습니다.

14. 권장 색상 토큰

이미지 스타일 기준으로는 이 정도가 맞습니다.

export const UiColor = {
  pageBg: 0xF3F7FB,
  panelBg: 0xFFFFFF,
  panelMuted: 0xF7FAFD,

  border: 0xD9E4EF,
  borderStrong: 0xB8CBE0,

  textMain: 0x2E3B55,
  textSub: 0x78869A,

  blue: 0x1688E6,
  blueSoft: 0xEAF5FF,

  purple: 0x6D42B8,
  purpleSoft: 0xF0EAFF,

  teal: 0x1C9B9A,
  tealSoft: 0xE3F7F5,

  green: 0x2FAC71,
  amber: 0xE89A22,
  red: 0xE85B61,
};

이 디자인은 색을 많이 쓰는 게 아니라:

기본 = 회색/푸른 회색
강조 = 파랑
특수 역할 = 보라
DB/저장 = 청록
경고 = 앰버
성공 = 초록

정도로 제한해야 깔끔합니다.

15. Phaser FX는 여기에서만 써라

이 UI에서 FX 사용 위치를 제한하면 됩니다.

사용 가능:
- 선택된 노드
- 병목 DB
- 웨이브 완료 순간
- 클릭 가능한 중요한 버튼
- 진행바 끝부분

사용 금지:
- 모든 카드
- 모든 텍스트
- 상점 목록 전체
- 하단 슬롯 전체
- 배경 전체

예를 들어 선택 노드만 약하게 Glow:

const glow = selectedNode.postFX.addGlow(
  0x67C7F2,
  2,
  0,
  false,
  0.08,
  8
);

다만 Phaser 3.60 이후 FX는 WebGL 전용이며, Glow/Bloom/Blur/Vignette 등 내장 효과를 제공합니다. FX는 개별 Game Object 또는 Layer에 적용할 수 있으나, 화면 전체에 남발하면 UI 텍스트가 탁해질 수 있습니다.

최종 구현 원칙

이 이미지를 Phaser로 최대한 똑같이 만들려면 아래가 핵심입니다.

1. 모든 UI를 Graphics로 즉석 생성하지 않는다.
2. 패널, 카드, 슬롯은 Figma 기반 9-slice 에셋을 쓴다.
3. 아이콘은 atlas sprite로 관리한다.
4. 배경과 보드 프레임은 정적 텍스처로 만든다.
5. 링크는 약한 색상 계층만 사용한다.
6. Glow/Bloom은 선택·경고 상태에만 제한한다.
7. 애니메이션은 짧고 기능적으로만 넣는다.
8. 텍스트는 한글 UI는 Text, 빠른 숫자는 BitmapText로 분리한다.
9. 상점은 mask 기반 스크롤 컨테이너로 만든다.
10. 보드와 HUD를 Container 레이어로 분리한다.

한 줄로 정리하면:

이 화면은 Phaser의 “이펙트 기술”로 만드는 것이 아니라, 정밀한 UI 에셋 시스템과 얕은 상태 애니메이션으로 만드는 화면입니다.

아냐 그럼에도 게임처럼 배치했을떄의 애니메이션같은건 다 있어야해.
그리고 인게임 보드도 최대한 카메라 시점도 깔끔하게 이동해야 하고, 보드게임 느낌이 나되 애저 느낌이 공존하는 느낌이어야 해.
7s 동안 생각함

맞아. 깔끔한 Azure형 UI라고 해서 정적이어야 하는 건 아니고,
핵심은 애니메이션의 목적이 게임 피드백이어야 하고, 장식용 글리터가 되면 안 된다는 거야.

네 게임은 방향을 이렇게 잡는 게 제일 좋다.

Azure 같은 정보 구조 + 보드게임 같은 손맛 + 타워디펜스 같은 실시간 흐름

즉, “화면은 SaaS 콘솔처럼 정돈”, “행동은 게임처럼 살아있게” 만들어야 한다.

추천 최종 구조
Phaser Scene 구성

BoardScene
- 보드
- 노드
- 링크
- 패킷
- 배치 애니메이션
- 카메라 이동
- 병목 / 성공 / 실패 연출

HudScene
- 상단 상태바
- 우측 상점
- 하단 카드
- 진행바
- 선택 패널

OverlayScene
- 카드 드래그 프리뷰
- 배치 가능 / 불가 표시
- 툴팁
- 경고 팝업
- 웨이브 시작 / 종료 연출

Phaser Scene은 각각 별도 display list, update loop, camera, input을 가질 수 있어서 보드와 HUD를 분리하기 좋다.

중요한 포인트는:

BoardScene 카메라만 움직인다.
HudScene은 카메라 영향 없이 항상 화면에 고정된다.

이렇게 해야 “게임판은 부드럽게 이동하는데, Azure 콘솔 같은 UI는 안정적으로 고정”된 느낌이 난다.

1. 카메라는 보드게임처럼, 하지만 과하지 않게

보드게임 느낌을 내려면 카메라가 단순 확대/축소만 하는 게 아니라, 플레이어의 행동을 “살짝 따라가야” 한다.

Phaser Camera는 pan, zoom, fade, flash, shake 같은 효과를 기본 제공한다.

다만 네 게임에서는 shake를 거의 쓰지 말고, Pan + Zoom + 아주 약한 focus 중심으로 가야 한다.

카메라 상태 3개만 만들기
1. Overview
- 전체 인프라 구조를 보는 기본 시점
- 줌 0.9~1.0

2. Placement Focus
- 장비를 배치할 때 해당 위치로 약하게 이동
- 줌 1.05~1.15

3. Incident Focus
- DB 병목, 링크 끊김, 실패 발생 시
- 문제 노드 쪽으로 0.2~0.4초 이동
- 줌 1.1~1.2

예시:

focusNode(node: Phaser.GameObjects.Container) {
  const camera = this.cameras.main;

  camera.pan(
    node.x,
    node.y,
    260,
    "Sine.easeOut",
    true
  );

  camera.zoomTo(
    1.12,
    260,
    "Sine.easeOut"
  );
}

카메라 pan 효과는 지정 위치로 카메라 중심을 일정 시간 동안 이동시키고, zoom 효과는 현재 줌에서 목표 줌으로 부드럽게 전환한다.

중요한 규칙
카메라가 매 이벤트마다 움직이면 피곤하다.
중요한 사건에서만 이동해야 한다.

추천 기준:

상황	카메라 이동
일반 요청 처리	없음
카드 hover	없음
노드 선택	아주 약한 focus
장비 배치 완료	해당 위치로 150~220ms 이동
DB 병목 발생	병목 노드로 250~350ms focus
웨이브 실패	문제 위치 focus 후 전체 overview 복귀
웨이브 완료	전체 보드 zoom out 후 결과 표시
2. 배치 애니메이션은 “보드게임 말 놓는 느낌”으로

노드를 그냥 setPosition() 하면 너무 툴 느낌이 난다.

배치 시에는 다음 4단계를 주면 된다.

1. 드래그 중: 반투명 프리뷰
2. 유효 타일: 파란 테두리
3. 드롭 순간: 살짝 아래에서 올라오며 정착
4. 링크 연결: 선이 그려지고 요청 점이 1번 지나감
배치 애니메이션
placeNode(node: Phaser.GameObjects.Container, x: number, y: number) {
  node.setPosition(x, y);
  node.setScale(0.82);
  node.setAlpha(0);

  this.tweens.add({
    targets: node,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    y: y - 8,
    duration: 180,
    ease: "Back.easeOut",
    onComplete: () => {
      this.tweens.add({
        targets: node,
        y,
        duration: 110,
        ease: "Sine.easeInOut",
      });
    },
  });
}

Phaser Tween Manager는 위치, alpha, scale 같은 속성을 시간 기반으로 부드럽게 변경하는 표준 기능이다.

여기서 핵심은 Back.easeOut을 너무 세게 쓰지 않는 거다.

좋음:
- 1~3px 정도의 착지감
- 180~240ms

나쁨:
- 크게 튀는 bounce
- 너무 긴 elastic
- 모바일 캐주얼 게임 같은 과장된 팝업

Azure 감성을 유지하려면 “착지”는 있어도 “통통 튀는 장난감” 같으면 안 된다.

3. 링크 생성은 게임의 핵심 연출로 만들기

이 게임에서 제일 중요한 행동은 사실 “장비 배치”가 아니라 링크 연결이야.

링크 연결 시에는 무조건 시각적 보상이 있어야 한다.

카드 배치
→ 포트 하이라이트
→ 링크가 source에서 target으로 그려짐
→ 짧은 패킷 1개 이동
→ 링크 상태 활성화
링크 생성 애니메이션

링크는 즉시 전체를 보여주지 말고 draw progress로 그리는 게 좋다.

방법은 2가지다.

방식 A. Graphics Path를 구간별로 다시 그리기

가장 단순한 방식.

const progress = { value: 0 };

this.tweens.add({
  targets: progress,
  value: 1,
  duration: 240,
  ease: "Sine.easeOut",
  onUpdate: () => {
    linkGraphics.clear();
    drawPartialLink(linkGraphics, pathPoints, progress.value);
  },
});
방식 B. RenderTexture + 마스크

고급스럽고 깔끔한 방식.

링크 전체를 미리 그림
→ reveal mask를 좌측에서 우측으로 이동
→ 선이 “배선되는 느낌”으로 등장

RenderTexture는 Game Object들을 동적 텍스처에 그려 재사용할 수 있고, 복잡한 정적/반정적 요소를 캐싱하는 데 적합하다.

링크 생성 후에는 작은 패킷 하나만 보내면 된다.

패킷 1개가 source → target으로 이동
= "이 연결이 활성화되었다"는 피드백

그 뒤 웨이브 중에는 실제 요청량에 따라 패킷 밀도를 조절한다.

4. 패킷은 “많이”가 아니라 “의미 있게”

타워디펜스 느낌을 내고 싶다고 패킷을 수십 개씩 흘리면 화면이 지저분해진다.

네 UI 스타일에는 이렇게 가는 게 맞다.

평상시:
링크당 0~2개

트래픽 증가:
링크당 3~5개

병목:
DB 직전 링크에서 패킷이 느려지고 쌓임

장애:
패킷이 빨간/주황색으로 변하고 사라짐

성공:
Response Egress에서 작은 체크 펄스

즉 “패킷 숫자”가 아니라 “패킷 행동”으로 상태를 보여줘야 한다.

속도 = 처리량
간격 = 요청량
멈춤 = 병목
색상 = 상태

이렇게 하면 플레이어가 숫자를 안 봐도 현재 문제가 어디인지 알 수 있다.

5. 병목은 DB 카드만 빛나게 하지 말고 “흐름 자체가 변해야 함”

병목이 발생했을 때 제일 좋은 연출은:

1. DB 입력 링크의 패킷 속도 저하
2. DB 앞쪽에 패킷 간격이 좁아짐
3. App Server Queue 숫자 증가
4. DB 카드 테두리가 앰버로 전환
5. DB 주변에 약한 warning ring
6. 선택하지 않아도 작은 아이콘 표시

즉 DB 하나만 빨갛게 만드는 게 아니라, 시스템 전체 흐름이 막히는 모습을 보여줘야 한다.

추천 상태 단계:

NORMAL
→ HIGH_LOAD
→ BOTTLENECK
→ CRITICAL
→ FAILURE

각 상태별 표현:

상태	링크	패킷	노드	UI
NORMAL	파랑/보라	일정 속도	기본	초록 상태점
HIGH_LOAD	조금 두꺼움	밀도 증가	약한 강조	Queue 증가
BOTTLENECK	앰버 혼합	속도 저하	앰버 테두리	경고 아이콘
CRITICAL	앰버/레드	대기 정체	펄스	상단 알림
FAILURE	회색/빨강	드롭/소멸	비활성	HP 감소

이게 “Azure 느낌”과 “게임성”이 공존하는 방식이다.

6. FX는 노드가 아니라 “사건”에 사용

Phaser FX Pipeline은 Glow, Bloom, Blur, Vignette, Shine 등을 제공하지만 WebGL 전용이고, 게임 오브젝트 또는 컨테이너에 적용할 수 있다.

여기서 중요한 기준:

항상 켜져 있는 Glow = 싸 보일 가능성 높음
사건 발생 시 잠깐 켜지는 Glow = 게임 피드백
좋은 FX 사용처
- 새 노드 배치 직후 0.25초 highlight
- 링크 연결 완료 순간
- 병목 첫 발생 순간
- 웨이브 클리어
- 카드 구매 성공
- 장비 업그레이드
쓰면 안 되는 곳
- 모든 카드 외곽
- 상점 아이템 전체
- 모든 텍스트
- 보드 타일 전체
- 상시 배경

예:

const glow = nodeContainer.postFX.addGlow(
  0x68B8FF,
  2,
  0,
  false,
  0.08,
  10
);

this.tweens.add({
  targets: glow,
  outerStrength: { from: 0.08, to: 0.7 },
  duration: 160,
  yoyo: true,
  hold: 120,
  onComplete: () => {
    nodeContainer.postFX.remove(glow);
  },
});

Phaser의 Glow FX는 Game Object 주위에 부드러운 halo를 만들고 색상과 강도를 제어할 수 있다.

7. 카메라 이동은 “보드게임 줌”으로 설계

보드게임 느낌을 살리려면 카메라 이동이 다음처럼 느껴져야 한다.

플레이어가 보드를 직접 손으로 움직이는 느낌
+
중요한 상황에서 카메라가 살짝 안내해주는 느낌

추천 입력:

마우스 휠:
보드 줌 인/아웃

마우스 중앙 버튼 드래그:
보드 팬

스페이스 + 좌클릭 드래그:
보드 팬

노드 더블 클릭:
해당 노드 focus

빈 공간 더블 클릭:
전체 보드 보기

Phaser InputPlugin은 Scene 단위 입력을 처리하며 포인터 이벤트를 제공하고, Pointer는 마우스/터치 입력을 캡슐화한다.

줌 중심점 보정

휠 확대 시 그냥 camera.zoom += 0.1 하면 마우스 위치가 아니라 화면 중심으로 확대되어 답답하다.

반드시 마우스 위치를 중심으로 월드 좌표를 보정해야 한다.

this.input.on(
  "wheel",
  (
    pointer: Phaser.Input.Pointer,
    _objects: unknown[],
    _deltaX: number,
    deltaY: number
  ) => {
    const camera = this.cameras.main;

    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);

    const nextZoom = Phaser.Math.Clamp(
      camera.zoom - deltaY * 0.001,
      0.65,
      1.45
    );

    camera.setZoom(nextZoom);

    const newWorldPoint = camera.getWorldPoint(pointer.x, pointer.y);

    camera.scrollX += worldPoint.x - newWorldPoint.x;
    camera.scrollY += worldPoint.y - newWorldPoint.y;
  }
);

이걸 넣으면 “지도 툴”처럼 자연스럽고, 보드게임 판을 확대하는 느낌이 난다.

8. 카드 드래그는 “상점 → 보드”가 아니라 “말 놓기”처럼

상점 카드를 클릭해서 바로 생성하면 관리툴 느낌이 강하다.

게임스럽게 하려면:

상점 카드 press
→ ghost card 생성
→ 보드 위에 반투명 프리뷰
→ 유효 칸은 파란색
→ 불가능 칸은 회색/붉은색
→ drop 시 착지 애니메이션
→ 링크 가능 포트 강조

드래그 프리뷰는 실제 노드와 다르게:

alpha: 0.55
scale: 0.95
outline: blue or gray

배치 가능 셀은:

기본: 거의 안 보이는 연한 grid
hover: 연한 파랑 fill
valid: 청록 테두리
invalid: 빨강 테두리

이런 보드 피드백이 들어가야 “TFT 배치” 느낌이 난다.

9. Azure 느낌을 유지하는 디자인 규칙

게임 애니메이션을 넣더라도 아래 규칙을 지키면 Azure 느낌이 유지된다.

1. 색상은 상태 표현에만 쓴다.
2. 정보는 카드/표 형태로 정렬한다.
3. 아이콘은 단순한 라인 아이콘을 쓴다.
4. 과장된 bounce/elastic을 줄인다.
5. 배경은 깨끗하고 밝은 중립색을 유지한다.
6. UI 모션은 150~300ms 안에 끝낸다.
7. 텍스트는 항상 흔들거나 빛나지 않는다.
8. 성공/실패 연출도 “시스템 이벤트”처럼 보여야 한다.

즉:

게임스러움 = 움직임, 피드백, 배치감
Azure스러움 = 정렬, 정보 구조, 차분한 색, 정확한 상태 표현

둘은 충돌하지 않는다.

10. 웨이브 연출을 타임라인으로 설계

웨이브 시작/종료는 단순히 숫자만 바뀌면 안 되고, 짧은 연출이 있어야 한다.

Phaser Timeline은 특정 시간에 콜백이나 이벤트를 순서대로 예약하는 Scene 수준 시퀀서다.

웨이브 시작 연출
0ms
- 상단 Wave 숫자 변경
- 현재 미션 카드 나타남

250ms
- Ingress 노드 강조

500ms
- 첫 패킷 출발

800ms
- 전체 트래픽 흐름 시작
this.add.timeline([
  {
    at: 0,
    run: () => this.showWaveMission(wave),
  },
  {
    at: 240,
    run: () => this.highlightNode("traffic-ingress"),
  },
  {
    at: 500,
    run: () => this.spawnPacket("traffic-ingress"),
  },
  {
    at: 800,
    run: () => this.startTrafficFlow(),
  },
]);
웨이브 완료 연출
1. 패킷 흐름이 천천히 줄어듦
2. Response Egress에 체크 pulse
3. 전체 보드가 0.98 → 1.0으로 짧게 안정
4. 상단 progress가 채워짐
5. 보상 카드가 하단에서 슬라이드

이 정도면 충분히 게임스럽다.

11. 실제 구현 우선순위
1단계: 보드 조작감
- 마우스 중심 줌
- 드래그 팬
- 노드 선택
- 더블 클릭 focus
- 전체 보기 버튼
2단계: 배치 감각
- 드래그 프리뷰
- valid/invalid tile
- 카드 착지
- 연결 포트 강조
3단계: 링크 흐름
- 링크 생성 draw animation
- 패킷 이동
- 트래픽 밀도 변화
- 링크 상태 색상
4단계: 사건 연출
- 병목
- 장애
- 웨이브 시작
- 웨이브 종료
- 업그레이드
5단계: 후처리
- 선택 Glow
- 병목 Warning ring
- 짧은 Shine
- 약한 Vignette
핵심 한 줄

네가 원하는 건 “미니멀한 Azure 콘솔 화면 위에서, 인프라 노드들이 실제 보드게임 말처럼 배치되고 살아 움직이는 느낌”이다.

그래서 구현 원칙은 이거다.

UI는 정적이고 차분하게.
보드는 살아있고 반응적으로.
FX는 상시가 아니라 사건 발생 순간에만.
카메라는 플레이어가 조작하지만, 중요한 사건엔 살짝 안내한다.

이 방향이면 깔끔함을 잃지 않으면서도 게임다운 손맛이 살아난다.