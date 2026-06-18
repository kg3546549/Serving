# STACK//BREACH 아키텍처 디펜스 전환 기획

> 문서 목적: 기존 네트워크 침투 퍼즐을 트래픽 처리형 아키텍처 타워디펜스로 전환  
> 핵심 경험: 몰려드는 요청을 시스템에 분산하고, 병목과 장애를 해결하며 서비스를 지킨다.
>
> 문서 상태: 장기 확장 기획. 현재 구현된 정확한 범위는 [현재 구현 상세](./current-implementation-ko.md)를 우선한다.

서버 처리량, 과부하 링, 서버 캐릭터, CDN 배치와 자연스러운 학습 방식은 [트래픽 웨이브·서버 캐릭터 상세 설계](./traffic-wave-and-server-design-ko.md)를 따른다.

캠페인 10개 스테이지의 웨이브 구성, 시설·서버 해금, 별과 연구 포인트는 [레벨 디자인과 해금 요소](./level-design-and-unlocks-ko.md)를 따른다.

요청 처리 수익, 장비 구매 경제, 서로 다른 부하의 요청과 보스 트래픽은 [트래픽 경제와 보스 요청 설계](./traffic-economy-and-boss-design-ko.md)를 따른다.

플레이어 레벨 1~10, 10칸 상점, 리롤, 장비 티어 1~5와 3성 합성은 [오토배틀러 상점·레벨·장비 합성 설계](./autobattler-shop-and-merge-design-ko.md)를 따른다.

---

## 1. 새로운 게임 한 줄 정의

플레이어가 방화벽, 로드밸런서, 애플리케이션 서버, 캐시, 데이터베이스, 메시지 큐 등을 배치하고 업그레이드하여 몰려드는 트래픽을 제한된 비용 안에서 안정적으로 처리하는 **시스템 아키텍처 타워디펜스 게임**이다.

```text
트래픽 발생
→ 보안 계층에서 필터링
→ 로드밸런서가 경로 분산
→ 서버가 요청 처리
→ 캐시 또는 DB에서 데이터 조회
→ 응답 반환
```

플레이어는 적을 공격하는 것이 아니라 요청이 병목 없이 목적지를 왕복하도록 시스템을 설계한다.

---

## 2. 반드시 정리해야 할 용어

화면에는 귀여운 데이터 구체를 사용해도 되지만, 모든 것을 실제 네트워크 `패킷`이라고 부르면 개념이 부정확해질 수 있다.

- 케이블과 라우터를 이동할 때: 네트워크 패킷
- 로드밸런서 이후 서버가 처리할 때: HTTP 요청 또는 연결
- 서버에서 DB로 이동할 때: DB 쿼리
- 큐에 들어갈 때: 메시지 또는 작업
- 사용자에게 돌아갈 때: 응답

게임에서는 이들을 통합해 **트래픽 유닛**이라고 부른다.

트래픽 유닛은 시스템을 통과하면서 외형이 변한다.

```text
사용자 요청 구체
→ HTTP 요청 카드
→ DB 쿼리 조각
→ 응답 상자
```

이 방식이면 귀여운 시각 표현을 유지하면서 실제 시스템의 역할도 잘못 가르치지 않는다.

---

## 3. 핵심 게임 루프

### 준비 단계

1. 스테이지의 예상 트래픽을 확인한다.
2. 제한된 예산으로 시스템을 구매한다.
3. 보드의 빈 격자 칸에 장비와 서버를 배치한다.
4. 장비 사이에 처리 경로를 연결한다.
5. 라우팅, 필터, 캐시, 확장 정책을 간단하게 설정한다.

### 웨이브 단계

1. 사용자 요청이 입구에서 생성된다.
2. 각 요청이 구성한 경로를 따라 이동한다.
3. 시스템은 처리량에 따라 요청을 통과시키거나 대기시킨다.
4. 병목이 생기면 대기열이 길어지고 장비가 붉어진다.
5. 시간 제한 안에 처리되지 않은 요청은 실패한다.
6. 악성 요청이나 불필요한 요청은 서비스 자원을 소모한다.

### 정비 단계

1. 성공률, 지연 시간, 병목, 비용을 확인한다.
2. 서버를 추가하거나 장비를 업그레이드한다.
3. 불필요한 경로를 제거한다.
4. 다음 웨이브의 새로운 트래픽 유형에 대응한다.

```text
설계 → 트래픽 웨이브 → 병목 관찰 → 증설·튜닝 → 더 큰 웨이브
```

---

## 4. 승리와 실패

### 승리 조건

스테이지마다 다음 목표 중 일부를 사용한다.

- 요청 성공률 95% 이상
- 평균 응답 시간 2초 이하
- 최대 오류율 5% 이하
- 악성 요청 차단률 90% 이상
- 데이터 손실 0건
- 예산 한도 이내
- 마지막 보스 웨이브 처리

### 실패 조건

- 핵심 서버의 처리 대기열이 최대치를 초과
- 데이터베이스 연결 수 초과
- 일정 비율 이상의 요청이 시간 초과
- 악성 요청이 보호 대상 서비스에 도달
- 운영 비용이 예산을 초과
- 메시지 유실 또는 중복 처리가 임계치를 초과

즉시 패배시키기보다 웨이브가 끝난 뒤 병목을 보여 주고 재설계할 기회를 제공한다.

---

## 5. 트래픽 유닛 종류

| 트래픽 | 특징 | 적합한 대응 |
|---|---|---|
| 일반 조회 요청 | 가볍고 자주 발생 | 로직 서버, 캐시 |
| 쓰기 요청 | DB 쓰기가 필요함 | Primary DB, 큐 |
| 정적 파일 요청 | 같은 데이터 반복 요청 | CDN, 캐시 |
| 로그인 요청 | 인증 확인이 필요함 | API Gateway, Auth 서버, Rate Limiter |
| 대용량 업로드 | 크고 느림 | Object Storage, 업로드 전용 경로 |
| 실시간 연결 | 오래 연결을 유지함 | L4 LB, 연결 수 업그레이드 |
| 배치 작업 | 처리 시간이 길음 | Queue, Worker |
| 검색 요청 | CPU와 DB 비용이 큼 | 전용 검색 서버, 캐시 |
| 봇 요청 | 반복 속도가 빠름 | Rate Limiter, Bot Filter |
| 공격 요청 | 특정 패턴이나 비정상 입력 | Firewall, WAF |
| DDoS 트래픽 | 매우 많은 단순 요청 | DDoS 방어, CDN, Rate Limiter |
| 재시도 폭풍 | 실패할수록 요청 수 증가 | Timeout, Retry Budget, Circuit Breaker |
| 독성 메시지 | 작업자가 반복 실패함 | Dead Letter Queue |
| 캐시 가능한 요청 | 같은 결과를 반복 사용 | Cache, CDN |
| 캐시 불가능 요청 | 사용자별 또는 최신 데이터 | 로직 서버와 DB 증설 |

색상뿐 아니라 모양과 아이콘으로 구분한다.

---

# 6. 게임에 넣을 실제 시스템 목록

## 6.1 네트워크 경로와 입구

### 1. DNS

**실제 역할**

도메인 이름을 서비스 주소로 연결하고, 구성에 따라 여러 대상 또는 지역으로 트래픽을 안내한다.

**게임 구현**

- 스테이지 입구 선택
- 두 개의 데이터센터 중 트래픽 비율 배분
- 장애 지역을 우회
- 잘못된 DNS 설정 시 모든 트래픽이 한쪽으로 몰림

**업그레이드**

- 기본 단일 대상
- 가중치 라우팅
- 지연 시간 기반 라우팅
- 장애 조치 라우팅

**게임 우선순위:** 후반

---

### 2. Router / Network Route

**실제 역할**

서로 다른 네트워크 사이에서 목적지에 맞는 다음 경로를 선택한다.

**게임 구현**

- 보드에서 경로 분기
- 내부망과 외부망 연결
- 잘못된 경로는 루프 또는 지연 발생
- 특정 트래픽만 전용 경로로 보냄

**업그레이드**

- 연결 가능한 경로 수
- 최대 대역폭
- 우선순위 경로
- 장애 시 우회 경로

**게임 우선순위:** 기본 보드 요소

---

### 3. Network Firewall

**실제 역할**

IP, 포트, 프로토콜, 연결 상태 등을 기준으로 트래픽을 허용하거나 차단한다.

**게임 구현**

- 검은색 악성 패킷 차단
- 사용하지 않는 포트 폐쇄
- 차단 규칙이 많으면 처리 속도 감소
- 잘못된 규칙은 정상 요청도 차단

**업그레이드 트리**

1. IP 차단
2. 포트·프로토콜 규칙
3. 상태 기반 연결 추적
4. 고속 패킷 처리
5. DDoS 방어 모듈

**게임 우선순위:** 초반 핵심

---

### 4. DDoS Protection / Scrubbing

**실제 역할**

대규모 비정상 트래픽을 원본 서비스에 도달하기 전에 흡수하거나 제거한다.

**게임 구현**

- 작은 쓰레기 패킷 떼를 입구에서 제거
- 순간 폭주 웨이브의 양을 크게 감소
- 평상시에는 비용만 발생
- 공격 유형에 맞지 않으면 효과 감소

**업그레이드**

- 초당 흡수량
- 공격 유형 탐지
- 자동 우회
- 정상 사용자 오탐 감소

**게임 우선순위:** 후반 방어 시설

---

## 6.2 트래픽 분산과 요청 제어

### 5. L4 Load Balancer

**실제 역할**

TCP 또는 UDP 연결을 여러 백엔드로 분산한다.

**게임 구현**

- 하나의 길을 여러 서버 길로 분기
- 각 서버의 연결 수를 균등하게 분산
- 실시간 연결과 게임 세션 처리에 유리
- 요청 내용은 읽지 못하고 주소와 포트 중심으로 분산

**업그레이드 트리**

1. 백엔드 2대 연결
2. 최대 동시 연결 증가
3. Least Connections
4. Health Check
5. Connection Draining

**게임 우선순위:** 초반 핵심

---

### 6. L7 Load Balancer / Reverse Proxy

**실제 역할**

HTTP 경로, 호스트, 헤더 등 요청 내용을 기준으로 다른 서버 그룹에 전달할 수 있다. NGINX 같은 역방향 프록시는 요청을 백엔드 서버로 전달하고 로드밸런싱할 수 있다.

**게임 구현**

- `/image` 요청은 이미지 서버로
- `/api` 요청은 로직 서버로
- `/login` 요청은 인증 서버로
- 요청 압축과 TLS 종료
- 서버별 가중치 설정

**업그레이드 트리**

1. Round Robin
2. 가중치 분산
3. 경로 기반 라우팅
4. 세션 고정
5. 비정상 서버 자동 제외

**트레이드오프**

- 세션 고정은 로그인 유지에 유리하지만 한 서버로 부하가 몰릴 수 있음
- 복잡한 L7 분석은 L4보다 처리 비용이 높음

**게임 우선순위:** 중반 핵심

---

### 7. Health Check

**실제 역할**

백엔드 서버가 정상적으로 응답하는지 확인하고 비정상 서버를 트래픽 대상에서 제외한다. 로드밸런서와 오토스케일링 시스템은 건강하지 않은 인스턴스를 분리하거나 교체할 수 있다.

**게임 구현**

- 고장 난 서버 위에 잠든 얼굴 표시
- Health Check가 없으면 요청이 계속 고장 서버로 이동
- Health Check를 설치하면 해당 길이 자동 폐쇄
- 복구 후 다시 경로에 합류

**업그레이드**

- 검사 주기
- 검사 정확도
- 애플리케이션 수준 검사
- 자동 교체

**게임 우선순위:** 로드밸런서 2단계 업그레이드

---

### 8. API Gateway

**실제 역할**

API 진입점에서 라우팅, 인증, 요청 제한, 캐싱, 키와 사용량 정책 등을 처리한다.

**게임 구현**

- 요청의 API 키 검사
- 사용자 등급별 다른 경로 제공
- 엔드포인트별 Rate Limit
- 간단한 응답 캐싱
- 잘못된 요청 형식 조기 거부

**업그레이드 트리**

1. 경로 분리
2. 인증 검사
3. 사용량 제한
4. 응답 캐시
5. 요청 변환

**게임 우선순위:** 중후반

---

### 9. Rate Limiter

**실제 역할**

특정 사용자, IP, 토큰 또는 API 경로가 일정 시간 안에 보낼 수 있는 요청 수를 제한한다.

**게임 구현**

- 빠르게 반복되는 봇 요청을 느리게 함
- 로그인 공격을 차단
- 처리량을 초과한 요청은 입구에서 반환
- 제한이 너무 낮으면 정상 사용자가 탈락

**설정**

- 초당 허용량
- 순간 버스트 허용량
- 사용자별 / IP별 / 경로별 기준
- 제한 초과 시 대기 또는 거부

**게임 우선순위:** 중반 핵심

---

### 10. WAF

**실제 역할**

HTTP 요청 내용을 검사하여 알려진 공격 패턴이나 사용자 정의 규칙에 맞는 요청을 차단한다.

**게임 구현**

- SQL Injection, 비정상 경로, 악성 봇 요청 식별
- 특정 색과 문양을 가진 공격 요청 제거
- 규칙을 많이 활성화하면 검사 시간이 증가
- 강한 규칙은 정상 요청을 오탐할 가능성

**업그레이드 트리**

1. 기본 공격 서명
2. SQL Injection 방어
3. Bot Filter
4. 사용자 정의 규칙
5. 오탐 감소

**게임 우선순위:** 중후반 핵심

---

## 6.3 처리 서버

### 11. Static Web Server

**실제 역할**

HTML, 이미지, CSS 같은 정적 콘텐츠를 제공한다.

**게임 구현**

- 가벼운 정적 요청을 빠르게 처리
- 동적 API 요청은 처리하지 못함
- CDN 해금 전 초반 정적 트래픽 담당

**업그레이드**

- 처리 속도
- 파일 압축
- 로컬 캐시
- 동시 연결 수

**게임 우선순위:** 초반

---

### 12. Logic / Application Server

**실제 역할**

비즈니스 로직을 실행하고 캐시, DB, 외부 서비스와 통신한다.

**게임 구현**

- 대부분의 일반 요청을 처리하는 기본 타워
- 요청 유형마다 CPU 비용이 다름
- 처리량이 넘으면 앞에 대기열 발생
- 여러 대 배치하면 로드밸런서가 필요함

**업그레이드 트리**

1. CPU 처리 슬롯
2. 동시 요청 수
3. 응답 압축
4. Stateless 전환
5. 비동기 작업 분리

**게임 우선순위:** 최초 기본 시설

---

### 13. Auth Server

**실제 역할**

사용자 인증, 토큰 검증, 권한 확인을 담당한다.

**게임 구현**

- 자물쇠 표시가 있는 로그인 요청 전용
- 모든 요청을 Auth 서버로 보내면 병목 발생
- 토큰 캐시 업그레이드로 반복 검증 감소
- 공격 웨이브에서 가장 먼저 과부하될 수 있음

**업그레이드**

- 토큰 검증 캐시
- 세션 저장소
- 다중 인스턴스
- 비정상 로그인 탐지

**게임 우선순위:** 중반

---

### 14. Worker Server

**실제 역할**

큐에서 오래 걸리는 작업을 가져와 비동기로 처리한다.

**게임 구현**

- 이메일, 이미지 변환, 정산 같은 느린 작업 담당
- 사용자의 요청 경로를 막지 않음
- Worker 수보다 작업이 많으면 큐가 쌓임

**업그레이드**

- 동시 작업 수
- 작업 유형 특화
- 실패 재시도
- Consumer Group

**게임 우선순위:** 큐와 함께 중반 해금

---

### 15. Auto Scaling

**실제 역할**

CPU, 메모리, 요청량 같은 지표를 기준으로 서버 인스턴스 수를 자동 조절한다. 수평 확장은 서버 수를 늘리고, 수직 확장은 기존 서버의 자원을 늘린다.

**게임 구현**

- 웨이브가 커지면 서버가 자동 생성
- 트래픽이 줄면 서버가 사라져 비용 절감
- 생성에는 준비 시간이 필요함
- 임계값이 잘못되면 늦게 증설하거나 계속 흔들림

**설정**

- 최소 / 최대 서버 수
- 확장 임계값
- 축소 임계값
- Cooldown
- Warm-up 시간

**게임 우선순위:** 중후반

---

## 6.4 캐시와 콘텐츠 전달

### 16. In-Memory Cache / Redis

**실제 역할**

자주 사용하는 데이터를 메모리에 저장해 애플리케이션과 DB의 반복 작업을 줄인다. 메모리가 가득 차면 정책에 따라 오래되거나 덜 사용하는 키를 제거할 수 있다.

**게임 구현**

- 이전에 처리한 것과 같은 요청을 즉시 반환
- Cache Hit는 서버와 DB를 통과하지 않음
- Cache Miss는 원래 경로로 이동
- 캐시 용량이 가득 차면 데이터가 밀려남

**업그레이드 트리**

1. 저장 슬롯
2. TTL 증가
3. LRU 제거 정책
4. LFU 제거 정책
5. Cache Replica

**트레이드오프**

- TTL이 길면 빠르지만 오래된 데이터를 줄 수 있음
- TTL이 짧으면 최신이지만 DB 부하가 증가

**게임 우선순위:** 초중반 핵심

---

### 17. CDN / Edge Cache

**실제 역할**

사용자와 가까운 엣지 위치에서 정적 또는 캐시 가능한 콘텐츠를 제공하여 원본 서버의 부하와 지연을 줄인다.

**게임 구현**

- 보드 입구 주변에서 이미지와 정적 요청을 즉시 처리
- 원본 서버까지 가는 요청 수를 대폭 감소
- 첫 요청은 원본까지 가고 이후 요청은 엣지에서 반환
- 캐시 규칙이 나쁘면 Hit Ratio가 낮음

**업그레이드**

- 엣지 노드 수
- 캐시 용량
- TTL 정책
- Origin Shield
- 장애 원본 전환

**게임 우선순위:** 후반 고비용 시설

---

### 18. Object Storage

**실제 역할**

이미지, 영상, 백업, 대용량 파일 같은 객체를 저장한다.

**게임 구현**

- 대용량 업로드와 다운로드를 로직 서버와 DB에서 분리
- 대용량 트래픽 전용 경로 생성
- CDN의 원본으로 연결 가능

**업그레이드**

- 저장 용량
- 업로드 속도
- 버전 보관
- 복제

**게임 우선순위:** 중후반

---

## 6.5 데이터베이스

### 19. Primary Database

**실제 역할**

서비스의 핵심 데이터를 읽고 쓴다.

**게임 구현**

- 쓰기 요청의 최종 목적지
- 연결 수와 초당 쿼리 수가 제한됨
- 과부하 시 모든 경로가 느려짐
- 파괴되면 데이터 손실 위험

**업그레이드 트리**

1. 연결 수
2. 처리 성능
3. 인덱스
4. 트랜잭션 처리
5. 백업

**게임 우선순위:** 최초 기본 시설

---

### 20. Connection Pool

**실제 역할**

DB 연결을 매번 새로 만들지 않고 일정 수의 연결을 재사용한다.

**게임 구현**

- 로직 서버와 DB 사이의 좁은 다리
- 연결 생성 비용을 감소
- Pool 크기가 너무 작으면 대기
- 너무 크면 DB가 동시에 과부하

**설정**

- 최소 연결 수
- 최대 연결 수
- 대기 시간
- 유휴 연결 정리

**게임 우선순위:** DB 첫 업그레이드

---

### 21. Read Replica

**실제 역할**

Primary의 데이터를 복제하고 읽기 요청을 분산한다. PostgreSQL 같은 시스템에서는 Primary와 Standby/Replica 구조를 사용할 수 있다.

**게임 구현**

- 파란색 읽기 요청을 Replica로 분산
- 빨간색 쓰기 요청은 Primary로만 이동
- 복제 지연 때문에 최신 데이터 요청은 Primary 필요
- Replica 장애 시 읽기 부하가 Primary로 되돌아감

**업그레이드**

- Replica 수
- 복제 속도
- 읽기 라우팅 정확도
- 장애 승격

**게임 우선순위:** 중반 핵심

---

### 22. Database Index

**실제 역할**

특정 조건의 데이터를 더 빠르게 찾을 수 있게 한다.

**게임 구현**

- 특정 모양의 조회 요청 처리 시간이 크게 감소
- 모든 컬럼에 인덱스를 추가하면 쓰기 비용과 유지 비용 증가
- 스테이지마다 자주 사용되는 조회 패턴을 관찰해야 함

**게임 우선순위:** 업그레이드 모듈

---

### 23. Database Sharding

**실제 역할**

데이터를 기준에 따라 여러 DB에 나누어 저장하고 처리량을 분산한다.

**게임 구현**

- 사용자 ID 또는 지역에 따라 DB 길을 분리
- 샤드 키가 나쁘면 한 DB에만 요청 집중
- 샤드 간 조회는 처리 비용 증가
- 재분배 작업 중 일시적 성능 저하

**게임 우선순위:** 후반 고급 시스템

---

### 24. Backup / Standby / Failover

**실제 역할**

Primary 장애 시 복제본을 승격하거나 백업에서 데이터를 복구한다.

**게임 구현**

- 평소에는 비용을 소모하지만 직접 처리량 기여는 적음
- 장애 웨이브에서 데이터 손실을 방지
- 수동 승격과 자동 승격 선택

**게임 우선순위:** 후반 생존 시설

---

## 6.6 비동기 처리

### 25. Message Queue

**실제 역할**

요청과 오래 걸리는 작업 사이에 버퍼를 두어 생산자와 소비자의 처리 속도 차이를 흡수한다.

**게임 구현**

- 느린 작업을 즉시 Worker로 보내지 않고 줄 세움
- 짧은 폭주를 흡수해 로직 서버가 멈추지 않음
- Queue가 가득 차면 새 작업 유실
- Worker가 부족하면 대기 시간이 증가

**업그레이드 트리**

1. Queue 용량
2. 보관 시간
3. 우선순위 Queue
4. 파티션
5. 복제

**게임 우선순위:** 중반 핵심

---

### 26. Stream / Kafka

**실제 역할**

이벤트를 파티션으로 나누어 저장하고 Consumer Group이 병렬로 처리할 수 있게 한다.

**게임 구현**

- 이벤트 유닛을 여러 레일로 분할
- 파티션 수가 병렬 처리 상한 결정
- 같은 키의 이벤트는 순서를 유지
- Consumer가 추가되면 파티션이 재배치됨

**업그레이드**

- 파티션 수
- Broker 수
- Replica
- Consumer 수

**게임 우선순위:** 후반 대규모 이벤트 스테이지

---

### 27. Dead Letter Queue

**실제 역할**

반복 처리에 실패한 메시지를 정상 큐에서 분리해 조사하고 다시 처리할 수 있게 한다.

**게임 구현**

- 보라색 독성 작업을 별도 보관
- DLQ가 없으면 같은 작업이 반복 재시도되어 Worker를 점유
- 플레이어가 웨이브 후 원인을 분석하고 Redrive 가능

**게임 우선순위:** Queue 업그레이드

---

## 6.7 안정성과 장애 격리

### 28. Timeout

**실제 역할**

응답이 너무 늦는 호출을 무한정 기다리지 않고 종료한다.

**게임 구현**

- 느린 서버에 붙잡힌 연결을 해제
- Timeout이 너무 짧으면 정상 느린 요청도 실패
- 너무 길면 연결 슬롯이 모두 차지됨

**게임 우선순위:** 기본 설정

---

### 29. Retry Policy / Retry Budget

**실제 역할**

일시적 실패를 다시 시도하되 재시도가 폭발하지 않도록 최대 횟수와 예산을 제한한다.

**게임 구현**

- 실패한 요청에 한 번 더 기회 제공
- 무제한 Retry는 트래픽 유닛을 복제해 재시도 폭풍 생성
- Retry Budget이 전체 재시도 수를 제어

**게임 우선순위:** 중후반

---

### 30. Circuit Breaker

**실제 역할**

실패하거나 과부하된 서비스로 호출이 계속 몰리는 것을 막아 연쇄 장애를 방지한다.

**게임 구현**

- 불타는 서버로 향하는 길을 일시적으로 닫음
- 빠르게 실패 응답을 돌려보내 전체 시스템을 보호
- 임계값이 너무 민감하면 정상 서버도 자주 차단
- 복구 확인 후 Half-open 상태로 일부 트래픽만 허용

**게임 우선순위:** 후반 핵심

---

### 31. Outlier Detection

**실제 역할**

서버 그룹 안에서 오류율이나 지연 시간이 다른 서버보다 나쁜 인스턴스를 자동 제외한다.

**게임 구현**

- 여러 로직 서버 중 연기 나는 한 서버만 자동 격리
- Health Check가 놓치는 간헐적 장애 대응
- 오판 시 서버 용량을 불필요하게 감소

**게임 우선순위:** Load Balancer 고급 업그레이드

---

### 32. Multi-Zone / Multi-Region

**실제 역할**

서로 다른 장애 영역이나 지역에 시스템을 배치해 한 곳의 장애가 전체 서비스 장애가 되지 않게 한다.

**게임 구현**

- 보드를 두 영역으로 확장
- 지역 전체 장애 이벤트 대응
- 데이터 복제와 네트워크 비용 증가
- DNS 또는 Global Load Balancer로 트래픽 분산

**게임 우선순위:** 최종 캠페인

---

## 6.8 관측과 운영

### 33. Metrics Monitor

**실제 역할**

요청량, CPU, 지연 시간, 오류율, Queue 길이 같은 지표를 수집한다.

**게임 구현**

- 설치 전에는 장비가 단순히 힘들어 보이기만 함
- 설치 후 실제 처리량과 병목 수치 표시
- 업그레이드하면 다음 웨이브 예측 제공

**게임 우선순위:** 초반 지원 시설

---

### 34. Logging

**실제 역할**

요청과 오류 이벤트를 기록해 실패 원인을 조사할 수 있게 한다.

**게임 구현**

- 웨이브 종료 후 실패 요청의 경로를 재생
- 악성 요청의 공통 패턴 발견
- 로그 저장량에 따라 비용 증가

**게임 우선순위:** 도움말·분석 기능

---

### 35. Alerting

**실제 역할**

정의한 조건을 만족할 때 운영자에게 장애 또는 위험을 알린다.

**게임 구현**

- DB 연결 80% 초과
- Queue 길이 급증
- 오류율 증가
- 서버 응답 없음

업그레이드하면 자동 일시정지 또는 추천 대응을 제공한다.

**게임 우선순위:** 중반 지원 시설

---

# 7. 게임에 우선 도입할 시스템

모든 시스템을 처음부터 구현하면 규칙이 지나치게 복잡해진다.

## MVP 핵심 9종

| 시스템 | 게임에서 필요한 이유 |
|---|---|
| Logic Server | 기본 처리 타워 |
| Primary DB | 요청의 최종 병목 |
| Network Firewall | 불필요한 트래픽 제거 |
| Load Balancer | 다중 경로와 서버 분산 |
| Cache | 반복 요청 우회 |
| Connection Pool | 서버와 DB 사이 병목 조절 |
| Message Queue | 순간 폭주 흡수 |
| Worker | 느린 작업 분리 |
| Metrics Monitor | 플레이어가 병목을 판단할 정보 제공 |

## 중간 확장 7종

- L7 Load Balancer
- Rate Limiter
- WAF
- API Gateway
- Read Replica
- Health Check
- Auto Scaling

## 후반 확장 7종

- CDN
- Object Storage
- DDoS Protection
- Circuit Breaker
- Kafka / Stream
- Database Sharding
- Multi-Zone / Multi-Region

---

# 8. 시설별 공통 능력치

모든 시스템은 같은 능력치를 가지지 않는다. 역할에 따라 필요한 값만 사용한다.

| 능력치 | 의미 |
|---|---|
| Throughput | 초당 처리 가능한 트래픽 유닛 수 |
| Concurrency | 동시에 점유할 수 있는 연결 또는 작업 수 |
| Queue Capacity | 기다릴 수 있는 유닛 수 |
| Processing Time | 한 유닛 처리 시간 |
| Bandwidth | 큰 유닛이 지나갈 수 있는 속도 |
| Accuracy | 필터 또는 탐지의 정확도 |
| False Positive | 정상 요청을 잘못 차단할 확률 |
| Availability | 고장 없이 동작할 확률 |
| Warm-up | 배치 또는 확장 후 활성화까지 걸리는 시간 |
| Cost | 설치 비용 |
| Running Cost | 웨이브마다 발생하는 유지비 |
| Energy | 특수 능력 사용 비용 |

---

# 9. 로드밸런서 상세 게임 설계

로드밸런서는 새 게임의 대표 시스템으로 삼는다.

## 기본 동작

```text
                 ┌─ Logic Server A
Request → LB ────┼─ Logic Server B
                 └─ Logic Server C
```

- 요청이 들어올 때 한 서버를 선택한다.
- 서버마다 현재 처리 중인 요청과 대기열이 보인다.
- 선택된 길이 잠깐 빛난다.
- 서버가 과부하되면 얼굴이 붉어지고 처리 속도가 느려진다.

## 분산 알고리즘

### Round Robin

요청을 서버 순서대로 보낸다.

- 이해하기 쉬움
- 서버 성능이 같을 때 적합
- 느린 요청과 빠른 요청이 섞이면 불균형 발생

### Least Connections

현재 연결이 가장 적은 서버를 선택한다.

- 오래 유지되는 연결에 유리
- 상태 계산 비용이 조금 증가

### Weighted

좋은 서버에는 더 많은 요청을 보낸다.

- 서로 다른 등급의 서버를 조합할 수 있음
- 가중치를 잘못 설정하면 한 서버 과부하

### Hash / Sticky Session

같은 사용자를 같은 서버로 보낸다.

- 세션 유지에 유리
- 특정 사용자 그룹이 한 서버에 몰릴 수 있음

## 업그레이드 예시

| 레벨 | 해금 |
|---:|---|
| 1 | 서버 2대, Round Robin |
| 2 | 서버 3대, 처리량 증가 |
| 3A | Least Connections |
| 3B | Weighted Routing |
| 4 | Health Check |
| 5A | Path Routing |
| 5B | Connection Draining |
| 6 | Auto Scaling 연동 |

---

# 10. 새 캠페인 10개 스테이지 초안

| Stage | 상황 | 해금 시스템 | 핵심 학습 |
|---:|---|---|---|
| 1 | 작은 웹사이트 운영 | Logic Server, DB | 서버와 DB의 기본 요청 흐름 |
| 2 | 쓰레기 트래픽 유입 | Firewall | 필요 없는 트래픽을 앞에서 제거 |
| 3 | 서버 한 대의 한계 | Load Balancer, 추가 서버 | 수평 확장과 부하 분산 |
| 4 | 같은 상품 조회 폭주 | Cache | Cache Hit와 DB 부하 감소 |
| 5 | DB 연결 고갈 | Connection Pool, Index | DB 병목과 연결 수 관리 |
| 6 | 읽기 트래픽 급증 | Read Replica | 읽기와 쓰기 경로 분리 |
| 7 | 이미지 처리 작업 폭주 | Queue, Worker | 동기·비동기 처리 분리 |
| 8 | 로그인 봇 공격 | Rate Limiter, WAF | 남용 제한과 응용 계층 필터 |
| 9 | 서버 장애와 재시도 폭풍 | Health Check, Auto Scaling, Circuit Breaker | 장애 격리와 자동 복구 |
| 10 | 글로벌 출시일 | CDN, Multi-Zone, 전체 시스템 | 비용과 안정성을 함께 고려한 종합 설계 |

---

# 11. 새 스테이지의 웨이브 예시

## Stage 3: 서버 한 대의 한계

### 초기 구조

```text
Request → Logic Server → DB
```

웨이브 1은 처리 가능하지만 웨이브 2부터 Logic Server 앞에 요청이 쌓인다.

### 플레이어 선택

- Logic Server 자체 업그레이드
- Logic Server 한 대 추가
- Load Balancer 설치

서버만 추가하고 Load Balancer를 설치하지 않으면 새 서버로 요청이 가지 않는다.

### 다음 웨이브

짧은 요청과 오래 걸리는 요청이 섞여 Round Robin의 한계가 드러난다.

### 추가 선택

- Least Connections 업그레이드
- 서버 성능 균등화

### 클리어 조건

- 요청 성공률 97% 이상
- 평균 응답 시간 1.5초 이하
- 예산 1,500 이하

---

# 12. 경제와 해금

## 설치 비용

웨이브 시작 전에 시설을 배치할 때 사용한다.

## 유지 비용

서버, DB, CDN 같은 고성능 시설은 웨이브마다 비용이 발생한다.

## 연구 포인트

스테이지 클리어 후 영구 업그레이드에 사용한다.

예:

- Load Balancer 경로 슬롯
- Cache TTL 정책
- Firewall 규칙 슬롯
- Metrics 예측 범위

## 해금 원칙

- 비싼 시스템이 항상 정답이면 안 됨
- 이전 시설을 잘 구성하면 고급 시설 없이도 낮은 랭크로 클리어 가능
- 고급 시설은 더 높은 성공률, 비용 효율, 장애 대응을 가능하게 함

---

# 13. UI 전환 방향

현재의 밝고 둥근 디자인 컨셉은 그대로 유지한다.

## 유지

- 파스텔 색상
- 둥근 시스템 타워
- 단순한 아이콘
- 큰 버튼
- 화면에 텍스트 최소화
- 도움말 안에서만 상세 개념 제공

## 변경

현재:

```text
고정된 PC → Router → Firewall → Server
포트 하나 선택
패킷 한 개 전송
```

변경:

```text
빈 격자 칸이 있는 넓은 보드
시설 구매 → 격자 배치 → 선 연결
웨이브 시작
수십 개 요청이 여러 경로로 이동
과부하 장비 업그레이드
```

## 기본 화면

```text
┌──────────────────────────────────────────────────────────┐
│ Stage 3   ●●●○○       코인 820       속도 ×1   ?        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  입구  →  [Firewall]  →  [Load Balancer]                │
│                              ├→ [Logic A] ─┐             │
│                              └→ [Logic B] ─┼→ [DB]       │
│                                                          │
│              요청들이 경로를 따라 계속 이동             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [방화벽] [LB] [서버] [캐시] [DB]       [웨이브 시작]     │
└──────────────────────────────────────────────────────────┘
```

## 도움말

시설을 길게 누르거나 `?`를 누르면 다음만 보여 준다.

- 현실에서 하는 역할
- 어떤 요청에 효과적인지
- 처리량과 비용
- 현재 병목 원인
- 추천 업그레이드

---

# 14. 시뮬레이션 구조 변경

기존 `한 번의 PlayerAction → 한 번의 패킷 결과` 구조에서 시간 기반 트래픽 시뮬레이션으로 바뀐다.

## TrafficUnit

```text
id
type
size
arrivalTime
deadline
processingCost
cacheKey
readOrWrite
malicious
clientId
retryCount
```

## SystemNode

```text
id
systemType
level
throughput
concurrency
queueCapacity
processingTime
health
cost
rules
upgradeModules
```

## NetworkEdge

```text
from
to
bandwidth
latency
enabled
trafficFilter
```

## WaveDefinition

```text
duration
spawnPattern
trafficMix
burstTimes
failureEvents
successTargets
budget
```

## 시뮬레이션 Tick

```text
1. 새 TrafficUnit 생성
2. 각 노드의 대기열에 진입
3. 처리 슬롯이 비면 작업 시작
4. 처리 완료 후 다음 경로 선택
5. Timeout, Drop, Retry 판정
6. 성공 응답 또는 실패 기록
7. 지표 갱신
```

Phaser는 유닛의 이동과 장비 상태를 표현하고, 순수 TypeScript 엔진이 처리량과 결과를 계산하는 기존 원칙은 유지한다.

---

# 15. 기존 코드에서 재사용한 부분

| 기존 구현 | 현재 반영 |
|---|---|
| React + Phaser 분리 | 유지 |
| React–Phaser Event Bus | 유지 |
| 파스텔·둥근 UI | 유지 |
| 패킷 이동 Tween | 다수 TrafficUnit 이동으로 확장 완료 |
| 성공·실패 연출 | 웨이브 결과와 과부하 효과로 재사용 |
| Trace와 Energy | 코인과 실시간 처리 결과로 교체 완료 |
| 포트 선택 Dock | 시설 구매 Build Dock으로 교체 완료 |
| TCP Probe 엔진 | Tick 기반 Traffic Simulation Engine으로 교체 완료 |
| 고정 NetworkScene | ArchitectureScene으로 교체 완료 |
| 결과 모달 | 성공률·평균 지연·최대 Queue·코인 결과로 확장 완료 |
| HelpModal | 시스템 역할과 병목 도움말 제공 |

---

# 16. 문서 전환 상태

## `game-overview-summary-ko.md`

**현재 아키텍처 디펜스 기준으로 재작성 완료**

변경 전:

- 해킹 퍼즐
- 도구 선택
- 패킷 하나의 실패 지점 조사
- OSI 계층 돌파

변경 후:

- 아키텍처 타워디펜스
- 시설 배치와 경로 설계
- 대량 트래픽 웨이브
- 비용, 성능, 안정성의 균형

---

## `campaign-stage-design-01-10-ko.md`

**전체 교체**

기존 L1~L7 순차 퍼즐을 다음 흐름으로 바꾼다.

```text
단일 서버
→ 방화벽
→ 로드밸런싱
→ 캐시
→ DB 최적화
→ Replica
→ Queue/Worker
→ WAF/Rate Limit
→ Auto Scaling/Circuit Breaker
→ 글로벌 종합 아키텍처
```

---

## `network-game-plan-ko.md`

**핵심 규칙 대규모 재작성**

| 기존 섹션 | 변경 |
|---|---|
| OSI Layer Gate | 시스템 요청 흐름과 병목 모델로 변경 |
| 관찰→도구→패킷 발사 | 설계→웨이브→관측→업그레이드 |
| Trace | 운영 비용 또는 SLO 위험도로 변경 |
| Energy | 설치 코인과 유지 비용으로 변경 |
| 증거 노트 | Metrics와 병목 리포트로 변경 |
| 힌트 | 관측 시스템과 시스템 도감으로 변경 |
| 도구 해금 | 시설과 업그레이드 해금으로 변경 |
| 패킷 인스펙터 | 요청 경로 리플레이로 축소 |
| 점수 | 성공률, 지연, 데이터 손실, 비용으로 변경 |

OSI 개념은 삭제하지 않고 도움말과 고급 스테이지의 기반 지식으로 이동한다.

---

## `web-game-architecture-and-direction-ko.md`

**기술 골격은 유지하고 도메인 부분 수정**

유지:

- React 아웃게임
- Phaser 인게임
- 순수 TypeScript 시뮬레이션
- Presentation Event 구조
- 카메라, 파티클, 사운드

변경:

- `PlayerAction` 중심 엔진 → Tick 기반 시뮬레이션
- 한 개 Packet Sprite → Object Pool 기반 다수 TrafficUnit
- 실패 연출 → 과부하, Drop, Timeout, 장애 연출
- 도구 패널 → Build Dock과 Upgrade Panel
- 고정 토폴로지 → 격자 배치와 직접 연결 경로

---

## `README.md`

**현재 구현·확장 기획·이전 컨셉으로 분류 완료**

1. 아키텍처 디펜스 전환 기획
2. 새 게임 요약
3. 시스템 도감
4. 새 캠페인 10개
5. 웹 기술 구조
6. 기존 침투 퍼즐안 보관

---

## 루트 `README.md`

**격자 배치와 직접 경로 연결 기준으로 반영 완료**

- ArchitectureScene
- Build Dock
- TrafficUnit Simulation
- Stage 3의 20개·50개 요청 웨이브

---

# 17. 기존 문서에서 유지할 가치가 있는 내용

새 컨셉에서도 다음 내용은 그대로 유효하다.

- 네트워크 개념을 잘못 단순화하지 않는 원칙
- 실제 외부 시스템을 공격하지 않는 안전한 시뮬레이션
- 실패가 정보를 제공해야 한다는 원칙
- UI와 시뮬레이션 엔진 분리
- 결과를 PresentationEvent로 연출하는 구조
- JSON 기반 스테이지
- 초보자는 도움말로 완료할 수 있게 하는 설계
- 성공과 실패를 화면 안에서 보여 주는 연출

---

# 18. 추천 개발 순서

## 1단계: 새 수직 프로토타입

다음 시스템만 구현한다.

- 트래픽 입구
- Logic Server 1대
- Primary DB
- Load Balancer
- 추가 Logic Server

웨이브:

- 20개 요청: 단일 서버로 처리 가능
- 50개 요청: 단일 서버 과부하
- Load Balancer + 서버 2대로 처리 성공

## 2단계: 시설 배치

- 하단 Build Dock
- 빈 격자 칸 선택
- 시설 구매
- 경로 연결
- 삭제와 환불

## 3단계: 관측

- 노드 Queue 길이
- 처리량
- 요청 성공률
- 평균 지연
- 병목 장비 자동 강조

## 4단계: 캐시와 방화벽

- 반복 조회 요청
- 악성 또는 불필요한 요청
- Cache Hit
- Firewall Drop

## 5단계: 10개 캠페인 확장

새 시스템을 한 스테이지에 1~2개씩만 추가한다.

---

# 19. 첫 구현에서 제외할 시스템

다음은 실제 개념이 중요하지만 MVP에 넣으면 복잡도가 크게 증가한다.

- BGP
- VLAN
- NAT 세부 설정
- Kubernetes Pod와 Service 세부 개념
- Service Mesh
- 분산 합의 알고리즘
- 데이터베이스 트랜잭션 격리 수준
- Exactly-once 처리
- Multi-Region 데이터 충돌 해결
- 실제 암호화 계산

이들은 기본 게임이 재미있고 읽기 쉬운지 검증한 후 확장한다.

---

# 20. 최종 권장 방향

새 게임의 핵심은 많은 장비를 보여 주는 것이 아니다.

각 시스템이 눈에 보이는 문제를 해결해야 한다.

```text
요청이 서버 앞에 쌓인다
→ 서버를 추가한다
→ 추가 서버로 요청이 가지 않는다
→ 로드밸런서를 설치한다
→ DB가 새로운 병목이 된다
→ 캐시 또는 Replica를 고민한다
```

이처럼 하나의 병목을 해결하면 다음 병목이 나타나는 구조가 가장 자연스럽고 교육적이다.

게임의 재미는 정답 아키텍처를 외우는 데서 나오지 않는다.

- 어떤 트래픽이 들어오는지
- 현재 어디가 막히는지
- 비용 안에서 무엇을 먼저 개선할지
- 장애가 발생했을 때 어떤 구조가 버티는지

이 네 가지를 플레이어가 직접 판단하게 만드는 것이 목표다.

---

# 21. 참고한 실제 시스템 동작

- AWS Elastic Load Balancing과 Auto Scaling: [트래픽 분산](https://docs.aws.amazon.com/autoscaling/ec2/userguide/autoscaling-load-balancer.html), [Health Check](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html)
- NGINX: [HTTP Load Balancing](https://nginx.org/en/docs/http/load_balancing.html), [Reverse Proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- Kubernetes: [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- Cloudflare: [Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/), [WAF](https://developers.cloudflare.com/waf/managed-rules/), [DDoS Protection](https://developers.cloudflare.com/ddos-protection/)
- Redis: [Cache Eviction](https://redis.io/docs/latest/develop/reference/eviction/), [Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- PostgreSQL: [Replication](https://www.postgresql.org/docs/current/runtime-config-replication.html), [High Availability](https://www.postgresql.org/docs/current/high-availability.html)
- Apache Kafka: [Design and Partitions](https://kafka.apache.org/43/design/design/)
- Amazon SQS: [Visibility Timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html), [Dead Letter Queue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- Amazon CloudFront: [Caching](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ConfiguringCaching.html)
- Amazon API Gateway: [Caching](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-caching.html), [Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- Envoy: [Circuit Breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking), [Outlier Detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)
- Prometheus: [Metrics and Monitoring](https://prometheus.io/), [Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
