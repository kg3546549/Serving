# STACK//BREACH 현재 구현

> 기준: 2026년 6월 19일

## 구현 범위

현재 플레이 가능한 범위는 `Stage 1: 기본 HTTPS API`의 Wave 1~10이다. 이후 Stage 2~8은 `src/campaign/campaignData.ts`에 서비스 도메인, 프로토콜, 적, 장비 설계 데이터가 정의되어 있다.

## 시작 상태

- 보드 왼쪽의 Traffic Ingress만 고정 배치
- 보유 장비 0개
- 시작 Credits 240
- Service HP 100
- 첫 구성 시간 60초, 이후 점검시간 25초
- App Server A와 Primary DB는 Wave 1부터 구매 가능

최소 운영 경로:

```text
Traffic Ingress → App Server A → Primary DB
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

## 포트와 간선 제약

| 장비 | 트래픽 포트 | 데이터 포트 |
|---|---:|---:|
| Traffic Ingress | 1 | 0 |
| App Server A/B | 1 | 1 |
| Load Balancer | 3 | 0 |
| Primary DB | 0 | 2 |

App Server는 외부 트래픽 간선을 하나만 받을 수 있다. DB 연결은 별도의 데이터 포트로 계산한다. Load Balancer만 입구 1개와 서버 분기 2개를 포함한 트래픽 간선 3개를 지원한다.

허용 연결은 다음으로 제한한다.

- Ingress ↔ App Server A
- Ingress ↔ Load Balancer
- Load Balancer ↔ App Server A/B
- App Server A/B ↔ Primary DB

간선 길이는 Manhattan 거리로 계산한다. `LINK LEVEL`은 간선 하나의 최대 길이와 전체 간선 칸 예산을 확장한다.

| Level | 간선 최대 길이 | 전체 예산 | 다음 레벨 비용 |
|---:|---:|---:|---:|
| 1 | 4칸 | 8칸 | 60 |
| 2 | 6칸 | 22칸 | 100 |
| 3 | 9칸 | 36칸 | 없음 |

## 화면 구현

- React: 메뉴, HUD, 상점, 도움말, 결과
- Phaser: 13×6 고밀도 격자, 장비, 직교 간선, 요청 이동, Queue 압력
- Zustand: 구매, 배치, 연결, 코인, HP, 웨이브 진행
- 순수 TypeScript: Tick 기반 서버·DB·응답 시뮬레이션

Phaser는 시뮬레이션 판정에 관여하지 않고 계산된 Traffic Event를 시간순으로 재생한다.

## 검증

```powershell
npm test
npm run build
```

테스트는 최소 요청 생명주기, 단일 서버 병목, Load Balancer 분산, DB Index 효과, 미완성 경로 실패, 구매·배치·고정 입구 규칙을 검증한다.
