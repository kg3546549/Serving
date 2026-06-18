# 아키텍처 디펜스 레벨 디자인과 해금 요소

> 문서 상태: 향후 캠페인 기획. 현재 코드는 Stage 3 수직 프로토타입만 구현한다.
>
> 목표: 새로운 병목이 등장하고, 플레이어가 현상을 관찰한 뒤 적절한 시스템을 해금·배치하며 자연스럽게 아키텍처를 확장하는 캠페인 설계

각 요청의 코인 보상, 장비 상점, 요청 부하와 보스 웨이브의 구체적인 규칙은 [트래픽 경제와 보스 요청 설계](./traffic-economy-and-boss-design-ko.md)를 따른다.

스테이지 내부의 플레이어 레벨, 상점 확률, 리롤과 장비 합성 규칙은 [오토배틀러 상점·레벨·장비 합성 설계](./autobattler-shop-and-merge-design-ko.md)를 따른다.

---

## 1. 레벨 디자인 핵심 원칙

### 문제를 먼저 보여 주고 해결책을 나중에 연다

좋지 않은 방식:

> 이번 스테이지에서는 로드밸런서를 배웁니다.

게임 방식:

1. 서버 한 대로 처음 웨이브를 처리한다.
2. 다음 웨이브에서 서버 앞에 요청이 쌓인다.
3. 서버를 한 대 추가해도 새 서버에는 요청이 가지 않는다.
4. 두 서버 사이의 비어 있는 분기 슬롯이 통통 튄다.
5. Load Balancer가 해금된다.
6. 배치하면 요청 경로가 둘로 갈라진다.

플레이어는 설명보다 결과를 먼저 경험한다.

### 한 스테이지에 새로운 핵심 개념은 최대 2개

- 신규 시설 1개
- 신규 정책 또는 서버 캐릭터 1개

한 번에 많은 시스템을 열면 무엇이 문제를 해결했는지 알기 어렵다.

### 이전 시스템을 계속 재사용

새로운 장비가 이전 장비를 완전히 대체해서는 안 된다.

예:

- Firewall은 Stage 2 이후 계속 사용
- Load Balancer는 Stage 3 이후 서버 확장의 기반
- Cache는 Stage 4 이후 DB 보호 수단
- Queue는 Stage 7 이후 느린 작업과 Burst 대응에 사용

### 절대적인 정답 아키텍처는 만들지 않는다

각 스테이지에는 최소 두 가지 클리어 방식이 존재해야 한다.

```text
고성능 서버 한 대
vs
저렴한 서버 여러 대 + Load Balancer
```

```text
Cache로 DB 조회 감소
vs
Read Replica로 DB 읽기 분산
```

다만 비용, 안정성, 평균 지연, 장애 대응 결과는 달라진다.

---

## 2. 캠페인 진행 구조

## 2.1 하나의 스테이지

한 스테이지는 4~6개의 짧은 웨이브로 구성한다.

```text
트래픽 예고
→ 20~40초 설계 시간
→ 웨이브 30~70초
→ 5초 결과 확인
→ 시설 구매·업그레이드
→ 다음 웨이브
```

권장 총 플레이 시간:

- 초반: 6~10분
- 중반: 10~15분
- 후반: 15~22분
- 최종 스테이지: 25~35분

## 2.2 웨이브 역할

| 웨이브 | 역할 |
|---:|---|
| 1 | 현재 구조의 기본 동작 확인 |
| 2 | 첫 병목 노출 |
| 3 | 신규 시스템을 이용한 해결 |
| 4 | 두 종류 트래픽을 섞어 응용 |
| 5 | 장애·Burst·공격 등 변형 |
| Boss | 스테이지의 모든 개념 종합 |

모든 스테이지에 Boss 웨이브가 필요한 것은 아니다. 초반에는 4개 웨이브로 충분하다.

## 2.3 체크포인트

- 각 웨이브 종료 시 자동 저장
- 실패하면 해당 웨이브의 설계 단계부터 재시작
- 이전 웨이브에서 얻은 코인과 설치 시설 유지
- 실패 원인 리포트만 추가 제공

처음부터 재시작시키지 않는다.

---

## 3. 배치 슬롯 규칙

초반에는 완전 자유 배치보다 역할별 슬롯이 적합하다.

| 슬롯 | 배치 가능한 시스템 |
|---|---|
| Edge | CDN, DDoS 방어, 외부 Firewall |
| Gateway | WAF, Rate Limiter, API Gateway, Load Balancer |
| Compute | Logic, Auth, Realtime, Worker 서버 |
| Data | Cache, Connection Pool, DB, Read Replica |
| Async | Queue, Stream, Worker |
| Support | Metrics, Logging, Alerting |

이 방식의 장점:

- CDN이 왜 입구에 있어야 하는지 자연스럽게 드러남
- Load Balancer가 서버보다 앞에 배치됨
- Cache가 Logic Server와 DB 사이에 배치됨
- 화면이 복잡한 케이블 편집기가 되지 않음

중후반에는 일부 범용 슬롯과 자유 분기를 해금한다.

---

## 4. 해금 구조

## 4.1 스테이지 내 임시 해금

웨이브 중 얻은 코인으로 구매한다.

- 서버 배치
- 서버 업그레이드
- Queue 용량
- Cache 용량
- Load Balancer 경로
- 일회성 긴급 복구

스테이지 종료 시 초기화된다.

## 4.2 캠페인 영구 해금

스테이지를 처음 클리어하면 새로운 시스템과 정책이 열린다.

예:

- Stage 3 클리어 → Load Balancer를 이후 스테이지에서 사용
- Stage 4 클리어 → Cache와 TTL 정책 사용
- Stage 7 클리어 → Queue와 Worker 사용

처리량 수치가 영구적으로 오르는 방식은 사용하지 않는다.

## 4.3 선택형 해금

별과 연구 포인트로 획득하는 사이드그레이드다.

- 새로운 서버 캐릭터
- 새로운 Load Balancer 알고리즘
- Cache 정책
- 자동화 모듈
- 시작 Loadout 선택권
- 외형 스킨

기본 시설보다 무조건 강하지 않고 특정 상황에 유리하다.

## 4.4 도감 해금

시스템을 실제로 사용한 뒤 현실 명칭과 구조 카드가 열린다.

```text
게임 이름: 빙글이
현실 이름: Load Balancer
게임에서 한 일: 요청을 두 서버에 분산
현실에서 하는 일: 여러 백엔드로 연결이나 HTTP 요청을 전달
```

시험이나 별도 퀴즈 없이 플레이 기록으로 해금한다.

---

## 5. 재화와 보상

## 5.1 스테이지 코인

시설 설치와 업그레이드에 사용한다.

획득:

- 성공 처리 요청
- 악성 요청 조기 차단
- SLA 연속 유지
- 웨이브 완료

차감:

- 시설 구매
- 업그레이드
- 긴급 재부팅
- 잘못 설치한 시설 철거 손실

## 5.2 별

한 스테이지당 최대 3개.

| 별 | 조건 |
|---|---|
| 안정성 별 | 필수 성공률 달성 |
| 속도 별 | 지연 시간 목표 달성 |
| 효율 별 | 예산·유지비 목표 달성 |

초보자는 안정성 별 하나만 얻어도 다음 스테이지로 진행할 수 있다.

## 5.3 연구 포인트

첫 클리어와 선택 과제로 획득한다.

사용:

- 선택형 서버 캐릭터 해금
- 정책 분기 해금
- 자동화 기능
- Endless 모드 기능

반복 노가다보다 새로운 조건 달성을 중심으로 지급한다.

## 5.4 청사진 카드

스테이지를 클리어하면 실제 아키텍처 패턴 카드가 열린다.

- Scaled Web App
- Cache Aside
- Read Scaling
- Async Worker
- Edge Delivery
- Resilient Service

청사진은 다음 스테이지의 힌트이자 수집 요소다.

---

## 6. 서버 캐릭터 해금 트리

## 기본 캐릭터

### 몽글이

- Stage 1 기본 지급
- 범용 Logic Server
- 모든 일반 요청 처리

## 첫 번째 선택 분기

Stage 2에서 둘 중 하나를 무료 해금한다. 다른 하나는 별 4개로 해금한다.

### 토끼

- 빠른 단일 처리
- 낮은 지연 목표에 강함
- Burst에는 약함

### 문어

- 많은 동시 슬롯
- 대량 일반 요청에 강함
- 개별 처리 속도는 보통

플레이어는 서버 업그레이드 방향을 처음 선택한다.

## 중반 캐릭터

### 햄스터

- Stage 4 Cache 선택 과제 완료
- 메모리·세션·캐시 특화

### 두더지

- Stage 5 대용량 파일 과제 완료
- 파일과 저장 요청 특화

### 붕붕이

- Stage 7 기본 해금
- Queue의 작업을 묶어 처리

### 대장장이

- Stage 7 속도 별 획득
- CPU가 무거운 작업 특화

### 장인

- Stage 8 기본 해금
- Auth, Search, Payment 등 단일 요청 유형 특화

## 후반 캐릭터

### 해파리

- Stage 9 동시 연결 과제
- 비동기 I/O와 가벼운 연결 특화

### 구름콩

- Stage 9 효율 별
- Serverless 방식의 순간 확장

### 거미

- Stage 10 실시간 트래픽 선택 과제
- 장기 연결 유지

### 드래곤

- 캠페인 별 24개 이상
- GPU·AI·미디어 대형 작업 특화

드래곤은 최강 서버가 아니라 특정 대형 작업에만 효율적인 후반 사이드그레이드다.

---

## 7. 시스템 해금 순서

| Stage | 기본 해금 | 선택·별 해금 |
|---:|---|---|
| 1 | 몽글이, Primary DB, Metrics 기본 링 | 서버 색상 |
| 2 | CPU·Core·Queue Capacity 업그레이드 | 토끼 또는 문어 |
| 3 | Load Balancer, 추가 Logic Server | Least Connections |
| 4 | App Cache, TTL | 햄스터, LRU/LFU |
| 5 | CDN, Static Server, Edge 슬롯 | 두더지, Origin Shield |
| 6 | Connection Pool, Index, Read Replica | 자동 Read/Write 분리 |
| 7 | Message Queue, Worker, 붕붕이 | 대장장이, DLQ |
| 8 | Firewall, Rate Limiter, WAF, Auth Server | 장인, 사용자 정의 규칙 |
| 9 | Health Check, Circuit Breaker, Auto Scaling | 해파리, 구름콩, Outlier Detection |
| 10 | Multi-Zone, Global LB, Failover | 거미, 드래곤, Endless |

---

## 8. 스테이지 1~10 상세 레벨 디자인

## Stage 1. 작은 가게

### 목표

서버 한 대가 요청을 받아 처리하고 DB를 거쳐 응답하는 흐름을 보여 준다.

### 시작 구조

```text
입구 → 몽글이 → Primary DB → 출구
```

시설 위치는 고정되어 있고 플레이어는 웨이브 시작만 누른다.

### Wave 1: 첫 손님

- 30 RPM
- 일반 조회만 등장
- 서버가 여유 있게 처리

### Wave 2: 단골 손님

- 70 RPM
- DB를 다녀오는 요청 등장
- 서버 처리 슬롯과 DB 왕복을 관찰

### Wave 3: 짧은 줄

- 110 RPM
- 서버 앞에 잠깐 Queue 생성
- 압력 링이 연한 노란색까지 차오름

### Wave 4: 마감 시간

- 130 RPM
- 기본 서버로 처리 가능하지만 여유가 적음

### 해금

- 서버 선택과 정보 카드
- 처리 속도·동시 슬롯 표시
- 기본 Metrics

### 별 조건

- 안정성: 성공률 90%
- 속도: 평균 지연 2.5초 이하
- 효율: 추가 비용 없음

### 자연스러운 발견

서버는 한 번에 모든 요청을 처리하지 못하고 처리 슬롯과 Queue를 가진다.

---

## Stage 2. 점심시간

### 목표

처리 속도, 동시 처리, 대기열의 차이를 경험한다.

### Wave 1: 평소보다 바쁜 날

- 170 RPM
- 몽글이 압력 링 60%

### 해금 순간

서버를 클릭하면 업그레이드 세 가지가 나타난다.

- CPU: 처리 시간 감소
- Core: 동시 슬롯 증가
- Buffer: Queue 용량 증가

설명 없이 아이콘과 예상 변화만 보여 준다.

### Wave 2: 짧고 빠른 Burst

- 10초간 320 RPM
- Buffer는 버티지만 지연 증가
- CPU/Core는 처리량 향상

### Wave 3: 지속 트래픽

- 240 RPM
- Buffer만 늘린 경우 Queue가 계속 유지됨

### Wave 4: 선택 시험

- 짧은 요청과 무거운 요청 혼합

### 기본 해금

- CPU·Core·Buffer 업그레이드

### 선택 해금

- 토끼 또는 문어 중 하나 선택

### 별 조건

- 안정성: 서버 OFF 없이 완료
- 속도: Timeout 3건 이하
- 효율: 업그레이드 2개 이하

---

## Stage 3. 첫 번째 확장

### 목표

수직 확장의 한계와 수평 확장을 경험한다.

### 시작

몽글이 1대가 최대 업그레이드 상태지만 350 RPM부터 Queue가 증가한다.

### Wave 1: 성장 한계

- 360 RPM
- 서버 하나가 임계 상태에 접근

### 해금 순간

빈 Compute 슬롯과 Logic Server 구매 버튼이 열린다.

### Wave 2: 일하지 않는 새 서버

- 플레이어가 새 서버를 배치할 수 있음
- 연결하지 않으면 새 서버가 놀고 있음
- 기존 서버로만 요청이 몰림

### 해금 순간

두 서버 앞 Gateway 슬롯이 통통 튀며 Load Balancer 해금.

### Wave 3: 두 갈래 길

- Round Robin으로 요청 분산
- 두 서버의 링이 함께 낮아짐

### Wave 4: 긴 요청 혼합

- 한 서버에 긴 요청이 몰리면 Round Robin 불균형 발생

### Wave 5: 확장 시험

- 600 RPM
- 서버 2~3대 조합

### 기본 해금

- Load Balancer
- Logic Server 추가 배치
- Round Robin

### 선택 해금

- 속도 별 획득 시 Least Connections

### 별 조건

- 안정성: 성공률 95%
- 속도: 서버 Queue 평균 5 이하
- 효율: 서버 2대로 클리어

---

## Stage 4. 인기 상품

### 목표

서버를 확장해도 DB가 병목이 될 수 있음을 보여 준다.

### 트래픽

- 같은 상품 조회 60%
- 일반 조회 30%
- 쓰기 10%

### Wave 1: 새로운 병목

- Logic Server는 여유 있음
- DB 앞에 요청이 쌓임
- DB 링이 빨갛게 변함

### 해금 순간

Logic Server와 DB 사이의 Data 슬롯이 열리고 Cache 해금.

### Wave 2: 첫 Cache Hit

- 첫 요청은 DB까지 이동
- 같은 요청부터 Cache가 즉시 응답

### Wave 3: 캐시 용량

- 여러 상품 요청 등장
- 저장 슬롯 부족

### Wave 4: TTL

- 상품 정보가 변경됨
- TTL이 너무 길면 오래된 응답 발생

### Wave 5: 인기 상품 세일

- 반복 조회 Burst

### 기본 해금

- App Cache
- Cache 용량
- TTL

### 선택 해금

- 햄스터
- LRU 또는 LFU 정책

### 별 조건

- 안정성: DB OFF 없음
- 속도: Cache Hit Ratio 60% 이상
- 효율: Logic Server 추가 구매 없음

---

## Stage 5. 이미지 축제

### 목표

정적 콘텐츠를 원본 서버보다 앞에서 처리하는 CDN의 위치를 경험한다.

### 트래픽

- 이미지 70%
- API 조회 20%
- 쓰기 10%

### Wave 1: 큰 파일

- 이미지 요청이 Logic Server와 네트워크 경로를 점유

### 해금 순간

입구 옆 Edge 슬롯이 열리고 CDN 해금.

### Wave 2: 잘못된 위치

- CDN을 원본 뒤에 둘 수도 있지만 부하 감소 효과가 작음
- 시설을 이동할 기회 제공

### Wave 3: Edge Cache

- CDN을 입구에 놓으면 이미지 요청이 바로 반환

### Wave 4: Cache Miss

- 새로운 이미지가 계속 등장
- 첫 요청은 원본까지 이동

### Wave 5: 세계 사진전

- 먼 지역 요청
- CDN 지역 노드 업그레이드

### 기본 해금

- CDN
- Static Server
- Edge 슬롯

### 선택 해금

- 두더지
- Origin Shield

### 별 조건

- 안정성: 원본 서버 OFF 없음
- 속도: 정적 요청 평균 지연 1초 이하
- 효율: CDN Hit Ratio 70% 이상

---

## Stage 6. 주문 폭주

### 목표

DB 연결 수와 읽기·쓰기 경로를 분리한다.

### Wave 1: 연결 고갈

- Logic Server를 늘리자 DB 연결이 빠르게 가득 참

### 해금

- Connection Pool

### Wave 2: Pool 크기

- 너무 작으면 Logic Server가 대기
- 너무 크면 DB가 압력 100%

### Wave 3: 조회 증가

- 읽기 80%
- Read Replica 해금

### Wave 4: 쓰기 혼합

- 쓰기는 반드시 Primary
- 잘못된 경로는 데이터 불일치 발생

### Wave 5: 주문 오픈

- 읽기와 쓰기 Burst 혼합

### 기본 해금

- Connection Pool
- DB Index
- Read Replica

### 선택 해금

- Read/Write 자동 라우팅
- Replica Health Check

### 별 조건

- 안정성: 데이터 손실 0
- 속도: DB Queue 평균 6 이하
- 효율: Replica 1대만 사용

---

## Stage 7. 느린 작업

### 목표

오래 걸리는 작업을 사용자 요청 경로에서 분리한다.

### Wave 1: 붙잡힌 서버

- 이메일과 이미지 변환 작업이 Logic Server 슬롯을 오래 점유

### 해금 순간

- Async 슬롯
- Message Queue
- 붕붕이 Worker

### Wave 2: 접수와 처리

- Logic Server는 작업을 Queue에 넣고 즉시 접수 응답
- Worker가 뒤에서 처리

### Wave 3: Queue 증가

- Worker보다 작업 유입이 많음
- Worker 추가 또는 Batch 업그레이드

### Wave 4: 무거운 계산

- 대장장이 선택 해금

### Wave 5: 독성 작업

- 반복 실패 작업 등장
- DLQ 선택 해금

### 기본 해금

- Message Queue
- Worker
- 붕붕이

### 선택 해금

- 대장장이
- Dead Letter Queue

### 별 조건

- 안정성: 메시지 유실 0
- 속도: Queue 최대 길이 25 이하
- 효율: Worker 2대 이하

---

## Stage 8. 로그인 공격

### 목표

불필요하거나 위험한 요청을 처리 서버 이전에 제거한다.

### Wave 1: 빠른 봇

- 로그인 요청이 Auth와 Logic Server를 점유

### 해금

- Rate Limiter
- Auth Server

### Wave 2: 제한 설정

- 제한이 너무 낮으면 정상 사용자도 거부
- 너무 높으면 봇 통과

### Wave 3: 공격 패턴

- WAF 해금
- 악성 요청 문양 검사

### Wave 4: 오탐

- 강한 WAF 규칙이 정상 요청 일부 차단

### Wave 5: 혼합 공격

- 일반 사용자, 봇, 공격 요청 동시 등장

### 기본 해금

- Rate Limiter
- WAF
- Auth Server

### 선택 해금

- 장인 Auth 서버
- 사용자 정의 WAF 규칙

### 별 조건

- 안정성: 공격 통과 5건 이하
- 속도: 정상 로그인 성공률 95%
- 효율: 정상 사용자 오탐 2% 이하

---

## Stage 9. 연쇄 장애

### 목표

서버 장애를 감지하고 격리하며 재시도 폭풍을 막는다.

### Wave 1: 느려지는 서버

- 서버 하나가 간헐적으로 느려짐
- Load Balancer가 계속 요청을 보냄

### 해금

- Health Check
- Outlier Detection

### Wave 2: 서버 OFF

- 고장 서버를 자동 제외

### Wave 3: Retry Storm

- 실패 요청이 복제되어 전체 트래픽 증가
- Circuit Breaker 해금

### Wave 4: 갑작스러운 증가

- Auto Scaling 해금
- Warm-up 때문에 즉시 증설되지 않음

### Wave 5: 장애와 Burst

- 서버 OFF와 트래픽 증가 동시 발생

### 기본 해금

- Health Check
- Circuit Breaker
- Auto Scaling

### 선택 해금

- 해파리
- 구름콩
- Outlier Detection

### 별 조건

- 안정성: 전체 서비스 중단 없음
- 속도: Timeout 10건 이하
- 효율: 최대 서버 4대 이하

---

## Stage 10. 글로벌 출시

### 목표

지금까지 배운 시스템을 비용 안에서 조합한다.

### 맵

- 두 개 지역
- 각 지역에 Edge, Gateway, Compute, Data 슬롯
- 한 지역에 장애가 발생할 수 있음

### Wave 1: 지역 사용자

- 지역별 지연 차이

### Wave 2: 정적 콘텐츠

- CDN과 Global Routing

### Wave 3: 실시간 사용자

- 장기 연결 트래픽

### Wave 4: 출시 Burst

- Auto Scaling과 Queue

### Wave 5: 지역 장애

- Multi-Zone 또는 Failover 필요

### Final Wave

- 정적·조회·쓰기·로그인·비동기·실시간 요청 혼합

### 기본 해금

- Global Load Balancer
- Multi-Zone
- Failover
- Endless Mode

### 선택 해금

- 거미
- 드래곤
- Multi-Region 청사진

### 별 조건

- 안정성: 성공률 99%
- 속도: P95 지연 목표 달성
- 효율: 유지비 한도 준수

---

## 9. 업그레이드 해금 방식

## 서버 업그레이드

각 서버는 한 스테이지에서 최대 3단계까지만 올린다.

### 1단계

기본 수치 강화.

- CPU
- Core
- RAM

### 2단계

플레이 스타일 분기.

```text
빠른 처리
vs
많은 동시 처리
```

### 3단계

운영 기능.

- Health Check
- Graceful Shutdown
- Stateless
- 작업 특화

모든 업그레이드를 한 서버에 동시에 넣을 수 없게 한다.

## 시설 업그레이드

### Load Balancer

```text
Round Robin
├─ Least Connections
└─ Weighted

Health Check
└─ Outlier Detection
```

### Cache

```text
용량 증가
├─ LRU
└─ LFU

TTL
├─ 오래 유지
└─ 빠른 갱신
```

### Queue

```text
용량 증가
├─ 우선순위
└─ 파티션

실패 처리
└─ Dead Letter Queue
```

### Firewall/WAF

```text
처리량
├─ 빠른 필터
└─ 정밀 검사

규칙
├─ 공격 탐지
└─ 봇 탐지
```

---

## 10. 선택 과제와 숨겨진 해금

선택 과제는 별 조건과 별도로 한 스테이지에 1개만 둔다.

예:

- Stage 3: 서버 하나를 OFF시키지 않고 완료 → Least Connections
- Stage 4: Cache Hit 80% → 햄스터
- Stage 5: 원본 요청 30% 이하 → Origin Shield
- Stage 7: 독성 작업 5개 격리 → DLQ
- Stage 8: 정상 사용자 오탐 0 → 장인
- Stage 9: Auto Scaling 없이 완료 → 해파리
- Stage 10: 실시간 연결 100% 유지 → 거미

숨겨진 조건은 결과 화면에서 일부 진행도를 알려 준다.

---

## 11. 영구 성장의 제한

영구 성장으로 허용:

- 새로운 선택지
- 자동화
- 외형
- 정보 표시
- 배치 Loadout
- Challenge Mode

영구 성장으로 금지:

- 모든 서버 처리량 +20%
- 모든 시설 가격 -30%
- 처음부터 코인 2배
- 실패 요청 자동 처리

이런 수치 증가는 레벨 설계를 무너뜨리고 아키텍처 판단을 약하게 만든다.

---

## 12. 도움 기능 해금

초보자가 막히지 않도록 정보 기능도 점진적으로 해금한다.

| 해금 | 기능 |
|---|---|
| Stage 1 | 압력 링 |
| Stage 2 | 처리량·Queue 숫자 |
| Stage 3 | 요청 경로 하이라이트 |
| Stage 4 | Cache Hit Ratio |
| Stage 5 | 트래픽 유형 비율 |
| Stage 6 | DB 연결 사용률 |
| Stage 7 | Queue 유입·처리 그래프 |
| Stage 8 | 정상·봇·공격 요청 구분 |
| Stage 9 | 병목 자동 표시 |
| Stage 10 | P50/P95 지연과 비용 분석 |

플레이어는 게임이 진행될수록 실제 관측 도구와 유사한 정보를 보게 된다.

---

## 13. 난이도 모드

## 편안한 모드

- 웨이브 사이 무제한 설계 시간
- 서버 OFF 전 대응 시간 증가
- 철거 환불 100%
- 병목 자동 강조

## 기본 모드

- 일반 비용과 처리량
- 철거 환불 70%
- 도움말 선택 사용

## 아키텍트 모드

- 예고되지 않은 Burst
- 장애 이벤트
- 높은 유지비
- 병목 자동 표시 없음
- P95 지연과 가용성 요구

난이도에 따라 학습 내용을 바꾸지 않고 압박과 정보량만 조정한다.

---

## 14. 캠페인 이후 해금

## Endless Traffic Lab

- 웨이브가 계속 강해짐
- 시설과 서버 자유 구성
- 최고 처리 RPM 기록

## Architecture Challenge

- 서버 2대 제한
- Cache 사용 금지
- DB Replica 금지
- 비용 제한
- 특정 서버 캐릭터만 사용

## Failure Lab

- 서버 OFF
- DB 장애
- Queue 적체
- CDN 장애
- 지역 단절

고장 상황을 해결하며 장애 대응 구조를 실험한다.

## Sandbox

- 무제한 코인
- 모든 시설 사용
- 원하는 트래픽 조합 생성
- 실제 아키텍처 청사진 저장

---

## 15. 첫 구현용 축소 레벨

전체 캠페인을 바로 구현하지 않고 Stage 1~3만 먼저 만든다.

## Prototype Stage A

- 몽글이 서버 1대
- 개별 요청 애니메이션
- 처리 슬롯 2개
- Queue 8개
- 압력 링과 OFF

## Prototype Stage B

- CPU/Core/Buffer 업그레이드
- Burst 웨이브

## Prototype Stage C

- 추가 서버
- Load Balancer
- Round Robin
- 서버 OFF 시 경로 영향

이 세 단계가 재미있으면 Cache와 CDN으로 확장한다.

---

## 16. 최종 해금 흐름 요약

```text
Stage 1
단일 서버의 처리 흐름
↓
Stage 2
서버 성능과 캐릭터 선택
↓
Stage 3
Load Balancer와 수평 확장
↓
Stage 4
Cache와 DB 보호
↓
Stage 5
CDN과 Edge 처리
↓
Stage 6
DB Pool·Replica·읽기/쓰기 분리
↓
Stage 7
Queue·Worker·비동기 처리
↓
Stage 8
Rate Limit·WAF·Auth
↓
Stage 9
Health Check·Circuit Breaker·Auto Scaling
↓
Stage 10
Global·Multi-Zone·Failover
```

플레이어는 새로운 시스템 이름을 외워서 해금하는 것이 아니라, 이전 구조의 한계를 직접 경험한 뒤 다음 해결 방법을 얻게 된다.
