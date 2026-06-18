# 서비스 도메인 캠페인과 Stage 1 구현 아키텍처

## 1. 캠페인 정렬 기준

스테이지는 네트워크 프로토콜 이름의 난이도가 아니라, 실제 서버를 구현할 때 필요한 상태 관리·데이터 처리·실시간성·미디어 파이프라인의 복잡도를 기준으로 정렬한다.

| Stage | 서비스 도메인 | 주요 프로토콜 | 구현 난이도가 증가하는 이유 |
|---:|---|---|---|
| 1 | 기본 HTTPS API | HTTPS | 짧은 요청과 관계형 DB 트랜잭션 |
| 2 | WEB/WAS 분리 | HTTPS | 정적·동적 요청 분기와 세션 |
| 3 | 콘텐츠 전송 | HTTPS | Cache, Object Storage, Range 응답 |
| 4 | IoT Telemetry | MQTT, TCP | 장기 연결, QoS, 중복 메시지 |
| 5 | 실시간 양방향 | WebSocket, TCP | 연결 상태, Fan-out, 순서 보장 |
| 6 | VOD 스트리밍 | HLS, DASH | Transcode, Segment, ABR |
| 7 | 라이브 방송 | RTMP, SRT, HLS | 실시간 Ingest와 지연 예산 |
| 8 | RTSP 관제 | RTSP, RTP, TCP | 제어 세션과 미디어 세션, 녹화·재생 통합 |

## 2. 게임의 세 계층

### 캠페인 계층

서비스 도메인과 해금 장비를 정의한다. 한 스테이지는 10개 웨이브를 가진다.

### 아키텍처 계층

플레이어가 상점에서 장비를 구매하고 격자에 배치한 뒤 간선을 연결한다. 트래픽 입구만 고정 시설이다.

### 요청 생명주기 계층

각 요청은 다음 과정을 모두 통과해야 성공한다.

```text
고정 Ingress
→ App Server 대기
→ 비즈니스 로직 처리
→ DB 대기
→ DB 읽기 또는 저장
→ 응답 생성
→ 기존 경로를 역방향으로 이동
→ Ingress 도착
```

서버 처리만 끝난 요청은 성공으로 계산하지 않는다. DB 처리와 응답 반환 전에 제한 시간을 넘기면 Timeout이다.

## 3. DB의 게임 역할

DB는 장식용 종착점이 아니라 별도 Queue와 동시 처리 슬롯을 가진 시스템이다.

- GET은 읽기 처리 시간을 점유한다.
- POST는 더 긴 쓰기 처리 시간을 점유한다.
- Slow Query는 일반 읽기보다 오래 슬롯을 점유한다.
- App Server를 늘리면 DB 유입량이 증가해 DB가 다음 병목이 된다.
- DB Index는 읽기와 Slow Query 시간을 줄이고 Queue 용량을 늘린다.

따라서 플레이어는 `서버 증설만 하면 항상 해결된다`고 학습하지 않는다.

## 4. 적 디자인

적은 몬스터가 아니라 서버 자원을 서로 다르게 점유하는 요청이다.

| 적 | 서버 영향 | DB 영향 | 시각 표현 |
|---|---|---|---|
| GET Read | 보통 | 짧은 읽기 | 파란 요청 카드 |
| POST Write | 보통 | 긴 쓰기 | 보라 요청 카드 |
| Slow Query | 보통 | 매우 긴 읽기 | 주황 요청 카드 |
| Burst | Queue를 빠르게 채움 | 후속 병목 유발 | 여러 카드가 밀집해 등장 |

후속 스테이지에서는 MQTT Publish, WebSocket Session, HLS Segment, RTSP Control과 RTP Media가 같은 Traffic Unit 규칙을 확장한다.

## 5. 장비 디자인

| 장비 | 구매 시점 | 역할 |
|---|---:|---|
| App Server A | Wave 1 | HTTPS 비즈니스 로직 처리 |
| Primary DB | Wave 1 | 데이터 읽기·저장과 응답 데이터 생성 |
| Load Balancer | Wave 5 | 두 App Server로 Round Robin 분산 |
| App Server B | Wave 5 | 서버 처리량과 Queue 용량 확장 |
| DB Index | Wave 8 | DB 읽기 시간과 Slow Query 비용 감소 |

트래픽 입구는 구매 장비가 아니며 보드 왼쪽에 고정된다. 최초 보유 장비는 없다.

최초 Wave는 구매·배치·연결을 학습할 수 있도록 준비시간 60초를 제공하고, 이후 점검시간은 25초로 줄여 운영 템포를 유지한다.

### 포트와 링크 용량

App Server의 트래픽 포트는 1개로 제한한다. DB 연결은 데이터 포트로 분리한다. Load Balancer는 입구와 두 서버를 연결할 수 있도록 트래픽 포트 3개를 가진다.

간선은 자유 선이 아니라 그리드 칸을 소비하는 인프라 자원이다. 간선 하나의 길이와 모든 간선의 합계가 LINK LEVEL 용량을 넘으면 연결하거나 장비를 이동할 수 없다. 수평 확장 구조는 LINK LV.2가 필요하도록 설계한다.

## 6. Stage 1 레벨 곡선

1~3 웨이브는 최소 경로와 GET/POST 차이를 학습한다. 4~6 웨이브는 단일 서버의 한계를 만들고 Load Balancer와 서버 증설을 요구한다. 7~10 웨이브는 Slow Query와 쓰기 비율을 높여 DB Index가 필요한 DB 병목으로 전환한다.

## 7. 코드 경계

```text
src/campaign/campaignData.ts
  스테이지, 프로토콜, 웨이브, 적·장비 메타데이터

src/simulation/trafficSimulation.ts
  프레임워크 비종속 요청/서버/DB/응답 Tick 시뮬레이션

src/store/gameStore.ts
  코인, 구매, 배치, 진행도, 서비스 HP

src/game/ArchitectureScene.ts
  요청 생명주기와 Queue 압력을 Phaser로 재생

src/components/
  캠페인 HUD, 상점, 결과와 도움말
```

Phaser는 판정을 만들지 않고 순수 TypeScript 시뮬레이션 결과만 재생한다. 이 경계를 유지하면 MQTT나 RTSP를 추가할 때 화면 코드를 다시 작성하지 않고 Traffic Unit과 Node 처리 규칙을 확장할 수 있다.
