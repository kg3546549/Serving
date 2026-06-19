# STACK//BREACH 현재 구현

> 기준: 2026년 6월 19일

## 구현 범위

현재 플레이 가능한 범위는 `Stage 1: 기본 HTTPS API`의 Wave 1~10이다. 이후 Stage 2~8은 `src/campaign/campaignData.ts`에 서비스 도메인, 프로토콜, 적, 장비 설계 데이터가 정의되어 있다.

## 시작 상태

- 보드 상단의 Traffic Ingress와 Response Egress 고정 배치
- BOARD LV.1의 7×4 영역만 사용 가능
- 보유 장비 0개
- 시작 Credits 240
- Service HP 100
- 첫 구성 시간 60초, 이후 점검시간 25초
- App Server A와 Primary DB는 Wave 1부터 구매 가능

최소 운영 경로:

```text
Traffic Ingress → App Server A → Primary DB
Primary DB → App Server A → Response Egress
```

## 요청 성공 판정

요청은 다음 이벤트를 순서대로 통과한다.

```text
spawned
→ routed
→ server_started 또는 server_queued
→ database_routed
→ database_started 또는 database_queued
→ database_completed
→ response_started
→ completed
```

서버 처리가 끝나도 DB 처리 또는 응답 반환 전에 제한 시간을 넘기면 실패한다.

## 트래픽 종류

- GET Read: 일반 DB 읽기
- POST Write: 읽기보다 오래 걸리는 DB 저장
- Slow Read: 인덱스가 없으면 DB 슬롯을 오래 점유
- Burst: 요청 생성 간격을 줄여 Queue를 압박하는 웨이브 패턴

Stage 1의 전송 프로토콜은 HTTPS로 고정된다. MQTT, WebSocket, HLS, RTMP, SRT, RTSP는 이후 스테이지 데이터에 배치되어 있다.

## 장비와 해금

| 장비 | 가격 | 해금 | 구현 효과 |
|---|---:|---:|---|
| App Server A | 60 | Wave 1 | 동시 처리 2, Queue 6 |
| Primary DB | 80 | Wave 1 | 동시 처리 2, Queue 8 |
| Load Balancer | 80 | Wave 5 | 두 서버 Round Robin |
| App Server B | 70 | Wave 5 | 서버 처리량 2배 확장 |
| DB Index | 110 | Wave 8 | 읽기·Slow Query 단축, DB Queue 14 |

## 병목 전환

- Wave 1~4: 최소 경로와 GET/POST 학습
- Wave 5~7: App Server Queue 포화와 수평 확장
- Wave 8~10: Primary DB Queue 포화와 DB Index

서버를 증설하면 DB 유입량이 증가하므로, 후반에는 서버가 아니라 DB가 병목으로 표시된다.

## 포트와 링크 제약

| 장비 | 트래픽 포트 | 데이터 포트 |
|---|---:|---:|
| Traffic Ingress | 1 | 0 |
| Response Egress | 1 | 0 |
| App Server A | 2 | 1 |
| App Server B | 1 | 1 |
| Load Balancer | 4 | 0 |
| Primary DB | 0 | 2 |

App Server A는 직접 구성에서 입구 요청 링크와 출구 응답 링크를 각각 사용한다. App Server B는 Load Balancer와 연결되는 양방향 링크 하나를 사용한다. DB 연결은 별도의 데이터 포트로 계산한다. Load Balancer는 입구, 출구, 서버 A/B를 연결하는 트래픽 링크 4개를 지원한다.

허용 연결은 다음으로 제한한다.

- Ingress ↔ App Server A
- Egress ↔ App Server A
- Ingress ↔ Load Balancer
- Egress ↔ Load Balancer
- Load Balancer ↔ App Server A/B
- App Server A/B ↔ Primary DB

링크 길이는 Manhattan 거리로 계산한다. `LINK LEVEL`은 링크 하나의 최대 길이와 전체 링크 칸 예산을 확장한다.

| Level | 링크 최대 길이 | 전체 예산 | 다음 레벨 비용 |
|---:|---:|---:|---:|
| 1 | 4칸 | 8칸 | 60 |
| 2 | 6칸 | 22칸 | 100 |
| 3 | 9칸 | 36칸 | 없음 |

`BOARD LEVEL`은 실제 배치 가능한 격자 영역을 확장한다.

| Level | 사용 영역 | 다음 레벨 비용 |
|---:|---:|---:|
| 1 | 7×4 | 90 |
| 2 | 10×5 | 140 |
| 3 | 13×6 | 없음 |

## 화면 구현

- React: 메뉴, HUD, 우측 상점, 하단 보유 장비 Dock, 도움말, 결과
- Phaser: 단계 확장형 13×6 격자, 장비, 직교 링크, 요청 이동, Queue 압력
- Zustand: 구매, 배치, 연결, 코인, HP, 웨이브 진행
- 순수 TypeScript: Tick 기반 서버·DB·응답 시뮬레이션

서비스 개시 Progress Bar 아래에 LINK CAPACITY, BOARD SIZE, 가로형 보유 장비 Dock을 배치한다. 장비 카드는 `READY`와 `ONLINE` 상태를 표시하며 기존 클릭·드래그 배치 동작을 유지한다. 보드의 장식 배경은 제거하고 링크와 장비 상태에 시선을 집중시킨다.

요청 링크는 파랑, 응답 링크는 보라, DB 데이터 링크는 노랑으로 표시한다. Load Balancer와 App Server 사이처럼 요청과 응답이 같은 물리 링크를 공유하는 구간은 파랑·보라 이중선으로 표시한다. 완료된 요청은 Response Egress에서 `200 OK` 피드백을 출력한다.

Phaser는 시뮬레이션 판정에 관여하지 않고 계산된 Traffic Event를 시간순으로 재생한다.

## 검증

```powershell
npm test
npm run build
```

테스트는 최소 요청 생명주기, 단일 서버 병목, Load Balancer 분산, DB Index 효과, 미완성 경로 실패, 보드 확장, 링크 용량, 고정 입출구 규칙을 검증한다.
