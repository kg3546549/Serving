# STACK//BREACH

서버 인프라를 직접 구매·배치하고, 실제 요청 생명주기의 병목을 해결하는 아키텍처 디펜스 게임입니다.

현재 구현 범위는 `Stage 1: 기본 HTTPS API`의 10개 웨이브입니다.

## 현재 플레이 흐름

1. 보드 상단에는 고정된 `Traffic Ingress`와 `Response Egress`가 존재합니다.
2. 최초 상점에서 `EC2 App Server`와 `RDS Primary DB`를 구매합니다.
3. 장비를 격자에 배치하고 다음 경로를 연결합니다.

```text
Traffic Ingress → App Server A → Primary DB
Primary DB → App Server A → Response Egress
```

4. 요청은 서버 처리 후 DB 읽기·저장을 수행합니다.
5. DB 작업이 끝난 응답이 상단 Egress까지 돌아와야 성공입니다.
6. Credits를 장비 구매, 상점 새로고침, XP에 배분합니다.
7. 레벨업하면 LINK CAPACITY 또는 BOARD SIZE 중 하나를 확장합니다.
8. 같은 장비 3개를 모아 성급을 올리고 역할별 증강을 선택합니다.

## 요청과 장비

| 요청 | 의미 | 주요 병목 |
|---|---|---|
| GET | DB 읽기 | App Server, DB Read |
| POST | DB 저장 | DB Write |
| SLOW | 인덱스 없는 느린 조회 | DB Queue |
| Burst | 짧은 간격의 요청 묶음 | Server Queue |

장비는 20종, 5개 티어로 구성되며 가격은 `4 / 12 / 25 / 50 / 90`입니다. 서버·DB·로드밸런서는 직접 배치하고 Queue·Cache·Security·Storage는 패시브 성능 보정을 제공합니다.

## 조작

- 서비스 개시 진행바 아래의 보유 장비 카드 좌클릭 또는 드래그: 배치
- 상점·보유 장비·보드 장비 우클릭: 상세정보
- 배치 장비 좌클릭: 선택 효과
- 배치 장비 좌클릭 드래그: 이동
- 장비 우클릭 드래그 또는 Shift+좌클릭 드래그: 링크 연결·해제
- Traffic Ingress와 Response Egress: 이동 불가, 연결만 가능
- 마우스 휠: 커서 위치를 중심으로 보드 확대·축소
- 빈 보드 좌클릭 드래그 또는 휠 버튼 드래그: 활성 보드 주변에서 화면 이동
- `R`: 보드 배율과 화면 위치 초기화

## 포트와 링크 용량

- Traffic Ingress: 요청 링크 1개
- Response Egress: 응답 링크 1개
- App Server A: 트래픽 링크 2개와 DB 데이터 링크 1개
- App Server B: Load Balancer 양방향 링크 1개와 DB 데이터 링크 1개
- Load Balancer: 입구·출구·서버 분기용 트래픽 링크 4개
- Primary DB: 데이터 링크 2개
- 허용 경로 외의 장비 조합은 연결 불가

링크 길이는 두 장비 사이의 가로·세로 그리드 칸 수로 계산합니다. 입구
링크는 파랑, 출구 링크는 보라, DB 링크는 노랑으로 표시합니다.

| LINK LEVEL | 링크 1개 최대 | 전체 링크 예산 |
|---:|---:|---:|
| 1 | 4칸 | 8칸 |
| 2 | 6칸 | 22칸 |
| 3 | 9칸 | 36칸 |

보드는 7×4에서 시작합니다. 플레이어 레벨이 오를 때 BOARD SIZE를 선택하면 10×5, 13×6으로 확장됩니다.

| BOARD LEVEL | 사용 영역 |
|---:|---:|
| 1 | 7×4 |
| 2 | 10×5 |
| 3 | 13×6 |

## 화면 배치

- 우측: 웨이브 정보와 인프라 상점
- 하단 첫 줄: 서비스 개시 Progress Bar
- 하단 둘째 줄: LINK CAPACITY, BOARD SIZE, 보유 장비 Dock

보유 장비를 상점에서 분리해 상점 상품을 더 많이 한 화면에 표시합니다.

## 실행과 검증

```powershell
npm install
npm run dev
npm test
npm run build
```

개발 서버 기본 주소는 `http://127.0.0.1:5173`입니다.

## 코드 구조

```text
src/
├─ campaign/      캠페인, 스테이지, 프로토콜, 웨이브 데이터
├─ simulation/    요청 → 서버 → DB → 응답 Tick 시뮬레이션
├─ store/         구매, 배치, 코인, HP, 웨이브 진행
├─ game/          Phaser 보드와 요청 생명주기 연출
├─ components/    React HUD, 상점, 도움말, 결과 화면
└─ audio/         Web Audio 효과음
```

## 설계 문서

- [서비스 도메인 캠페인과 Stage 1 구현 아키텍처](./docs/service-domain-campaign-architecture-ko.md)
- [현재 구현 상세](./docs/current-implementation-ko.md)
- [장비 티어·레벨·합성·증강 구현 명세](./docs/device-upgrade-spec-ko.md)
- [문서 전체 목차](./docs/README.md)
