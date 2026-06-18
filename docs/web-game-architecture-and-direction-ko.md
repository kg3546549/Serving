# 웹 네트워크 게임 기술 구조 및 연출 설계

> 문서 상태: 이전 네트워크 침투 퍼즐을 기준으로 작성된 기술·연출 참고안. 현재 구현 구조는 [현재 구현 상세](./current-implementation-ko.md)를 따른다.
>
> 프로젝트: STACK//BREACH  
> 문서 목적: React 아웃게임과 Phaser 인게임의 역할, 게임 연출 규칙, 구현 구조 확정  
> 기술 기준: React + TypeScript + Phaser 3 + 순수 TypeScript 네트워크 시뮬레이션

---

## 1. 결론

이 프로젝트는 퀴즈 사이트가 아니라 **네트워크를 직접 조작하고 결과를 체험하는 2D 전략·퍼즐 게임**으로 만든다.

최종 기술 구조는 다음과 같다.

```text
웹 애플리케이션
├─ React + TypeScript
│  ├─ 메인 메뉴
│  ├─ 캠페인과 스테이지 선택
│  ├─ 장비·스킬·업적 관리
│  ├─ 설정과 저장
│  └─ 인게임 HUD 및 상세 정보 패널
│
├─ Phaser 3 + WebGL
│  ├─ 네트워크 월드
│  ├─ 장비와 링크
│  ├─ 패킷 이동
│  ├─ 카메라 연출
│  ├─ 파티클·셰이더·후처리
│  ├─ 성공·실패 시퀀스
│  └─ 인게임 사운드
│
└─ 순수 TypeScript 시뮬레이션 엔진
   ├─ Ethernet, ARP, IP, ICMP
   ├─ TCP, UDP, DNS
   ├─ HTTP, TLS, SSH
   ├─ 장비·방화벽·라우팅 규칙
   └─ 행동 판정과 연출 이벤트 생성
```

React Flow는 실제 플레이 화면에 사용하지 않는다. React Flow는 추후 개발자용 스테이지 편집기를 만들 때만 검토한다.

---

## 2. 왜 Phaser인가

### 2.1 이 게임의 중앙 화면은 다이어그램이 아니라 게임 월드다

중앙 토폴로지는 네트워크 도식을 표시하는 것에서 끝나지 않는다.

- 장비가 부팅되고 정지한다.
- 링크에 에너지가 흐른다.
- 패킷이 경로를 따라 이동한다.
- 라우터가 패킷을 분석하고 다음 홉으로 보낸다.
- 방화벽이 패킷을 차단한다.
- TTL이 감소하고 패킷이 소멸한다.
- 인증서나 암호화 계층이 시각적으로 조립된다.
- 성공 시 네트워크 전체가 활성화된다.
- 실패 시 원인에 따라 장비와 화면이 반응한다.

이 요구에는 단순 노드 그래프보다 게임 루프, 카메라, Tween, 파티클, 사운드, 씬과 WebGL 후처리를 제공하는 Phaser가 적합하다.

### 2.2 Phaser에서 사용할 핵심 기능

| 기능 | 게임 적용 |
|---|---|
| Scene | 로딩, 인게임, 결과 연출 상태 분리 |
| Camera | 줌, 패닝, 흔들림, 플래시, 페이드 |
| Tween | 장비 배치, 패킷 이동, UI 강조 |
| ParticleEmitter | 전기, 데이터 조각, 충돌, 폭발 |
| Sprite Animation | 장비 부팅, 포트 점멸, 방화벽 작동 |
| FX Pipeline | Glow, Bloom, Blur, Pixelate, Vignette, Displacement |
| Audio | 패킷 발사, 장비 작동, 실패 충격, 성공 음악 |
| Input | 클릭, 드래그, 조준, 홀드, 영역 선택 |
| Depth | 배경, 링크, 장비, 패킷, 효과, 텍스트 순서 |
| Data Loader | 스테이지 JSON과 이미지·오디오 에셋 로딩 |

### 2.3 PixiJS보다 Phaser를 우선하는 이유

PixiJS는 매우 좋은 고성능 2D 렌더러지만, 게임 구조를 직접 설계해야 하는 부분이 더 많다. Phaser는 다음 요소를 한 프레임워크에서 제공한다.

- 게임 Scene 생명주기
- 카메라
- 입력
- Tween
- 파티클
- 사운드
- 애니메이션
- 후처리 효과
- 게임 오브젝트 관리

이 프로젝트는 단순 렌더링보다 사건의 순서와 연출이 중요하므로 Phaser가 초기 개발 속도에 유리하다.

---

## 3. 제품 정체성

### 3.1 지향점

플레이어는 정답을 고르는 사람이 아니라 다음 역할을 수행한다.

- 네트워크 공간을 탐색하는 요원
- 장비와 연결을 조작하는 엔지니어
- 패킷을 구성하고 발사하는 오퍼레이터
- 응답과 오류를 해석하는 분석가
- 제한된 자원으로 경로를 개척하는 전략가

### 3.2 피해야 할 형태

- 문제 설명 아래 객관식 버튼 배치
- HTTP, TCP, SSH 중 하나를 고르면 즉시 정답 판정
- 실패 시 “틀렸습니다” 팝업만 표시
- 성공 시 체크 아이콘만 표시
- 토폴로지를 정적인 배경 그림으로 사용
- 모든 행동을 일반 HTML 버튼 클릭으로 처리
- 정답을 몰라도 모든 버튼을 한 번씩 누르면 클리어

### 3.3 게임으로 느껴져야 하는 최소 조건

- 모든 주요 입력에 준비·실행·결과 단계가 있다.
- 패킷과 장비가 플레이어 행동에 물리적으로 반응한다.
- 실패 원인이 화면 안에서 발생한다.
- 성공은 단계적 상승과 피날레를 가진다.
- 화면, 소리, 진동감 있는 타이밍이 같은 사건을 표현한다.
- 플레이어가 위험과 기대를 느낄 수 있는 자원이 있다.
- 같은 정답이라도 더 정확하고 효율적인 플레이가 높은 평가를 받는다.

---

## 4. React와 Phaser의 역할 분리

### 4.1 React 담당

React는 정보 밀도가 높고 접근성이 필요한 UI를 담당한다.

- 로그인 또는 프로필
- 메인 메뉴
- 캠페인 지도
- 스테이지 선택
- 업적과 해금
- 장비·스킬 로드아웃
- 옵션
- 저장 데이터
- 목표 목록
- 증거 노트
- 패킷 상세 테이블
- 장비 설정 폼
- HTTP 요청 빌더
- SSH 인증 정보 선택
- 터미널 출력
- 결과 리포트

### 4.2 Phaser 담당

Phaser는 즉시 반응하고 움직이는 게임 월드를 담당한다.

- 네트워크 토폴로지 렌더링
- 맵 카메라
- 장비 선택과 강조
- 장비 배치
- 링크 연결
- 포트 조준
- 패킷 조립·발사·이동
- 장비 통과 애니메이션
- 성공·실패 애니메이션
- 배경 환경 효과
- 게임 내 짧은 상태 텍스트
- 월드 공간 툴팁
- 시각·음향 피드백

### 4.3 겹치지 않게 할 기준

| 항목 | React | Phaser |
|---|---|---|
| 복잡한 텍스트 | 담당 | 짧은 라벨만 |
| 표와 폼 | 담당 | 사용하지 않음 |
| 장비와 링크 | 상태 표시만 | 담당 |
| 패킷 이동 | 타임라인 제공 | 담당 |
| 성공·실패 판정 | 표시 | 판정하지 않음 |
| 성공·실패 연출 | 결과 화면 | 담당 |
| 네트워크 규칙 | 사용하지 않음 | 사용하지 않음 |
| 네트워크 엔진 호출 | 담당 가능 | 이벤트로 요청 가능 |

Phaser가 네트워크 정답을 직접 판정하지 않도록 한다. Phaser는 받은 결과를 표현하는 역할이다.

---

## 5. 전체 런타임 흐름

```text
플레이어 입력
  ↓
React 또는 Phaser 입력 어댑터
  ↓
PlayerAction 생성
  ↓
SimulationEngine.execute(action)
  ↓
ActionResult
  ├─ stateChanges
  ├─ evidence
  ├─ objectiveChanges
  └─ presentationEvents
        ↓
PresentationDirector
        ↓
Phaser 연출 재생
        ↓
React HUD와 저장 상태 갱신
```

### 5.1 핵심 원칙

시뮬레이션 결과와 애니메이션 결과를 분리한다.

좋은 구조:

```text
TCP 연결 실패 판정
→ FIREWALL_BLOCKED 이벤트 생성
→ 방화벽 충돌 연출 재생
```

피해야 할 구조:

```text
패킷 스프라이트가 방화벽 이미지와 충돌했기 때문에
TCP 연결을 실패로 판정
```

두 번째 구조는 애니메이션 프레임이나 좌표가 게임 규칙에 영향을 주기 때문에 테스트가 어렵고 버그가 발생하기 쉽다.

---

## 6. 액션과 이벤트 모델

### 6.1 PlayerAction

```ts
export type PlayerAction =
  | {
      type: "ENABLE_INTERFACE";
      nodeId: string;
      interfaceId: string;
    }
  | {
      type: "SEND_ARP";
      sourceNodeId: string;
      targetIp: string;
    }
  | {
      type: "PING";
      sourceNodeId: string;
      targetIp: string;
    }
  | {
      type: "TCP_CONNECT";
      sourceNodeId: string;
      targetIp: string;
      port: number;
    }
  | {
      type: "HTTP_REQUEST";
      sessionId: string;
      method: string;
      host: string;
      path: string;
      headers: Record<string, string>;
      body?: string;
    };
```

### 6.2 ActionResult

```ts
export interface ActionResult {
  success: boolean;
  reason?: FailureReason;
  stateChanges: StateChange[];
  newEvidence: Evidence[];
  objectiveChanges: ObjectiveChange[];
  presentationEvents: PresentationEvent[];
}
```

### 6.3 PresentationEvent

```ts
export type PresentationEvent =
  | { type: "TOOL_CHARGED"; toolId: string }
  | { type: "PACKET_ASSEMBLED"; packetId: string; layers: string[] }
  | { type: "PACKET_LAUNCHED"; packetId: string; sourceNodeId: string }
  | { type: "PACKET_MOVED"; packetId: string; from: string; to: string }
  | { type: "DEVICE_PROCESSED_PACKET"; packetId: string; nodeId: string }
  | { type: "PACKET_BLOCKED"; packetId: string; nodeId: string }
  | { type: "PACKET_EXPIRED"; packetId: string; nodeId: string }
  | { type: "RESPONSE_LAUNCHED"; packetId: string; sourceNodeId: string }
  | { type: "LAYER_GATE_OPENED"; layer: number }
  | { type: "OBJECTIVE_COMPLETED"; objectiveId: string }
  | { type: "STAGE_CLEARED"; rank: string }
  | { type: "STAGE_FAILED"; reason: string };
```

### 6.4 연출 큐

여러 이벤트를 즉시 동시에 실행하지 않고 `PresentationDirector`가 순서를 관리한다.

```ts
await director.play([
  packetAssembled,
  packetLaunched,
  packetMovedToRouter,
  routerProcessed,
  packetMovedToFirewall,
  packetBlocked,
]);
```

각 연출은 완료 시점을 반환해야 한다.

```ts
interface PresentationClip {
  play(context: PresentationContext): Promise<void>;
  skipToEnd(): void;
}
```

플레이어가 이미 본 반복 연출은 속도를 높이거나 건너뛸 수 있도록 한다.

---

## 7. 인게임 화면 구조

```text
┌──────────────────────────────────────────────────────────────────────┐
│ React HUD: 임무명 | 현재 목표 | Trace | 에너지 | 힌트 | 메뉴       │
├───────────────┬───────────────────────────────────┬──────────────────┤
│ React         │                                   │ React            │
│ 목표·증거     │         Phaser WebGL World         │ 스킬·장비        │
│               │                                   │                  │
│ 발견 정보     │ 장비 / 링크 / 패킷 / 카메라 / FX │ 선택 도구 설정   │
│               │                                   │                  │
├───────────────┴───────────────────────────────────┴──────────────────┤
│ React: 터미널 | 패킷 인스펙터 | 장비 로그 | 이벤트 타임라인       │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.1 Phaser Canvas

- 가능한 넓은 중앙 영역을 차지한다.
- `Resize` 스케일 모드를 사용한다.
- 월드 좌표와 화면 좌표 변환 함수를 공통 모듈로 둔다.
- React 패널 크기 변경 시 Phaser Canvas도 즉시 재조정한다.
- 최소 해상도는 1280×720, 권장 기준은 1440×900으로 설정한다.

### 7.2 React 오버레이

React 오버레이가 Phaser 입력을 불필요하게 막지 않도록 한다.

- HUD 컨테이너 기본값: `pointer-events: none`
- 실제 버튼과 패널만: `pointer-events: auto`
- 월드 툴팁이 복잡하면 Phaser 좌표를 React Portal 위치로 변환
- 모달이 열리면 Phaser 입력을 명시적으로 잠금

---

## 8. 핵심 조작 설계

### 8.1 장비 선택

```text
마우스 진입
→ 외곽선 약한 발광
→ 장비 이름과 상태 노출

클릭
→ 카메라가 짧게 중심 보정
→ 선택 링 전개
→ 연결 포트와 사용 가능 행동 표시
→ 우측 상세 패널 갱신
```

### 8.2 스킬 사용

스킬은 일반 버튼 클릭 후 즉시 실행하지 않는다.

```text
스킬 선택
→ 커서 변경
→ 유효 대상 강조
→ 대상 조준
→ 필요한 옵션 구성
→ 실행 홀드 또는 확정
→ 패킷 조립
→ 발사
```

행동이 복잡하지 않은 초반 스테이지에서는 일부 단계를 생략할 수 있지만, 최소한 `준비 → 대상 선택 → 실행 → 결과` 흐름은 유지한다.

### 8.3 패킷 조립

패킷을 계층별 카드 또는 링으로 표현한다.

```text
[HTTP GET /status]
       ↓ 캡슐화
[TCP dst:8080 SYN]
       ↓
[IPv4 dst:10.0.20.15]
       ↓
[Ethernet dst:Gateway MAC]
```

실행 순간 각 레이어가 중심으로 접혀 하나의 패킷 오브젝트가 된다.

이 연출은 캡슐화 개념을 설명하는 동시에 공격 또는 스킬 준비처럼 보이게 한다.

### 8.4 장비 배치

```text
인벤토리 장비 선택
→ 월드에 반투명 홀로그램 생성
→ 설치 가능 위치 표시
→ 회전 또는 포트 방향 조정
→ 확정
→ 부품 조립 파티클
→ 장비 부팅
→ 링크 포트 활성화
```

### 8.5 케이블 연결

```text
첫 번째 포트 선택
→ 케이블 끝이 커서를 따라옴
→ 호환 포트만 강조
→ 두 번째 포트 선택
→ 케이블이 곡선으로 연결
→ 신호 테스트 펄스
→ 성공 또는 규격 불일치 반응
```

---

## 9. 패킷 이동 연출

### 9.1 기본 이동

패킷은 링크 위를 단순히 같은 속도로 움직이지 않는다.

- 발사 직전에 장비 포트가 충전된다.
- 패킷이 출발할 때 짧은 반동이 발생한다.
- 링크에 앞서가는 에너지 펄스가 흐른다.
- 패킷 뒤에 데이터 파편 또는 잔상이 남는다.
- 장비에 진입하면 잠깐 축소되고 내부 처리 후 반대 포트로 발사된다.
- 응답 패킷은 다른 색과 방향성으로 구분한다.

### 9.2 프로토콜별 시각 언어

| 프로토콜 | 대표 색상 | 형태 | 움직임 |
|---|---|---|---|
| ARP | 노란색 | 확산 링 | 같은 LAN에 브로드캐스트 |
| ICMP | 청록색 | 파동 구체 | 왕복 펄스 |
| TCP SYN | 파란색 | 삼각 헤드 | 정밀하고 빠른 직선 이동 |
| TCP SYN-ACK | 보라색 | 이중 헤드 | 반대 방향 반사 |
| TCP RST | 빨간색 | 날카로운 파편 | 충돌 후 튕김 |
| UDP | 주황색 | 작은 데이터 덩어리 | 확인 없이 연속 발사 |
| DNS | 하늘색 | 물음표→주소 변환 | 서버에서 형태 변화 |
| HTTP | 흰색·파란색 | 문서 카드 | 요청과 응답 크기 차이 |
| TLS | 자주색 | 보호막 캡슐 | 키 교환 후 잠금 효과 |
| SSH | 녹색 | 터미널 블록 | 채널이 지속적으로 유지 |

색상만으로 구분하지 않고 아이콘, 형태, 라벨을 함께 사용한다.

### 9.3 장비 내부 처리

패킷이 장비를 통과할 때 장비 역할이 보이게 한다.

- 스위치: MAC 테이블을 검색하고 해당 포트가 점등
- 라우터: IP 헤더가 펼쳐지고 라우팅 경로가 선택
- 방화벽: 규칙 목록이 짧게 스캔되고 허용 또는 차단
- DNS 서버: 이름 문자열이 IP 주소로 변환
- 웹 서버: 요청 카드가 처리 큐에 들어간 뒤 응답 생성
- SSH 서버: 호스트 키 확인 후 인증 자물쇠 해제

---

## 10. 실패 연출 시스템

### 10.1 원칙

실패는 팝업이 아니라 월드 안에서 발생해야 한다.

실패 연출은 다음 세 가지를 동시에 전달한다.

1. 어디에서 실패했는가
2. 어떤 종류의 실패인가
3. 다음에 무엇을 조사할 수 있는가

### 10.2 실패 원인별 연출

| 실패 | 시각 연출 | 음향 | 남기는 단서 |
|---|---|---|---|
| `LINK_DOWN` | 포트에서 신호가 끊기고 케이블 펄스 소멸 | 전원 차단음 | 인터페이스와 링크 상태 |
| `ARP_UNRESOLVED` | ARP 링이 확산되지만 응답 없이 사라짐 | 빈 공간 에코 | ARP 캐시와 LAN 범위 |
| `NO_ROUTE` | 라우터 내부 경로 선이 갈라지다 모두 적색 | 탐색 실패음 | 마지막 도달 라우터 |
| `TTL_EXPIRED` | 패킷 위 숫자가 0이 되고 픽셀 분해 | 짧은 디지털 파열 | 만료된 홉 위치 |
| `PORT_CLOSED` | 서버 포트가 닫히며 RST가 반사 | 금속성 반사음 | 호스트 도달 성공, 포트 닫힘 |
| `FIREWALL_BLOCKED` | 붉은 에너지 벽 생성 후 패킷 파괴 | 강한 충돌음 | 차단 장비와 규칙 후보 |
| `TIMEOUT` | 패킷 잔상이 어둠 속에서 점차 소멸 | 낮아지는 비프음 | 응답 부재, 원인 미확정 |
| `DNS_FAILURE` | 도메인 문자가 깨지고 물음표로 변환 | 오류 스캔음 | DNS 설정 |
| `HTTP_404` | 서버가 빈 폴더 카드를 반환 | 가벼운 실패음 | Host와 경로 |
| `HTTP_405` | 메서드 카드가 거부되고 `Allow` 카드 등장 | 카드 튕김음 | 허용 메서드 |
| `TLS_NAME_MISMATCH` | 인증서와 호스트명이 겹치지 않고 균열 | 유리 균열음 | 인증서 SAN |
| `SSH_AUTH_FAILED` | 열리던 터미널 채널이 잠금 장치로 닫힘 | 잠금음 | 사용자와 인증 수단 |

### 10.3 실패 강도

모든 실패에 큰 화면 흔들림과 폭발을 사용하지 않는다.

| 등급 | 예시 | 강도 |
|---|---|---|
| 정보 실패 | HTTP 404, 잘못된 입력 | 작은 반응, 화면 흔들림 없음 |
| 통신 실패 | 포트 닫힘, 라우팅 실패 | 대상 중심 강조, 약한 카메라 반동 |
| 위험 실패 | 방화벽 탐지, Trace 증가 | 붉은 경고, Vignette, 큰 사운드 |
| 스테이지 실패 | Trace 최대, 핵심 장비 파괴 | 전체 화면 시퀀스 |

강약이 없으면 중요한 사건도 평범하게 느껴진다.

### 10.4 실패 후 흐름

```text
실패 발생
→ 0.4~1.2초 원인 연출
→ 실패 지점 카메라 포커스
→ 관련 패킷 자동 선택
→ 패킷·장비 로그에 증거 추가
→ 플레이어 조작 복귀
```

대부분의 실패는 게임 오버가 아니라 정보를 얻는 과정이다.

---

## 11. 성공 연출 시스템

### 11.1 소목표 성공

예:

- 링크 활성화
- 올바른 ARP 응답 확보
- 라우팅 경로 복구
- 열린 포트 발견
- TLS 인증 성공

연출:

```text
성공 대상 점등
→ 짧은 상승음
→ 목표 카드에 에너지 전송
→ 다음 사용 가능 도구 또는 경로가 월드에 나타남
```

소목표마다 전체 화면을 가리지 않는다. 플레이 흐름을 유지하면서 다음 가능성을 열어 주는 것이 목적이다.

### 11.2 계층 돌파

각 OSI 계층의 핵심 조건을 해결했을 때 `Layer Gate Open` 연출을 사용한다.

```text
현재 계층 아이콘 확대
→ 잠금 링 회전
→ 패킷 헤더 조각이 결합
→ 링이 부서지며 다음 계층 점등
→ 토폴로지에 새 정보가 표시
```

계층별 연출 언어:

- L1: 전원과 신호
- L2: 프레임과 MAC 격자
- L3: 경로와 좌표
- L4: 포트 잠금과 연결
- L5: 채널과 세션
- L6: 변환과 암호 보호막
- L7: 명령과 서비스 응답

### 11.3 스테이지 최종 성공

```text
1. 마지막 결과 패킷 도착
2. 월드 사운드가 0.1초 정지
3. 대상 장비로 카메라 빠른 줌
4. 잠금 또는 장애 상태 해제
5. 성공 데이터가 네트워크 전체로 역방향 확산
6. 모든 성공 경로가 순서대로 점등
7. 배경 Vignette가 풀리고 Bloom 상승
8. OSI 계층 아이콘이 아래부터 순서대로 활성화
9. ACCESS GRANTED 또는 NETWORK RESTORED 표시
10. 결과 화면 전환
```

성공 문구는 임무에 따라 달라져야 한다.

- `LINK ESTABLISHED`
- `ROUTE RESTORED`
- `SESSION SECURED`
- `ACCESS GRANTED`
- `SERVICE RECOVERED`
- `MISSION COMPLETE`

### 11.4 랭크 연출

- S: 거의 완벽한 경로가 금색 데이터 스트림으로 재생
- A: 청록색 안정화 효과
- B: 일반 성공 효과
- Assisted: 성공은 동일하게 존중하되 분석 지원 사용 표시

힌트를 사용했다고 성공 연출을 약하게 만들지는 않는다. 평가 정보만 결과 화면에서 구분한다.

---

## 12. 카메라 연출

### 12.1 평상시

- 플레이어가 자유롭게 이동·확대·축소
- 선택 시 대상이 화면 중심에서 약간 벗어난 위치에 배치되어 패널과 겹치지 않게 함
- 중요한 패킷은 카메라가 부드럽게 추적할 수 있음

### 12.2 자동 연출

- 패킷 발사: 출발지에서 목적지 방향으로 짧은 리드
- 장비 처리: 카메라가 완전히 멈추지 않고 속도만 늦춤
- 차단: 충돌 지점을 중심으로 약한 흔들림
- 계층 돌파: 해당 장비 또는 패킷으로 줌
- 최종 성공: 연출 전용 카메라 경로 사용

### 12.3 카메라 사용 제한

- 사용자 조작을 자주 강제로 빼앗지 않는다.
- 반복 패킷은 자동 추적하지 않는다.
- 멀미를 유발하는 지속 흔들림을 사용하지 않는다.
- 설정에서 흔들림 강도와 자동 줌을 줄일 수 있게 한다.

---

## 13. 화면 후처리와 환경 효과

### 13.1 기본 분위기

- 어두운 네트워크 공간
- 미세한 격자
- 느리게 이동하는 데이터 입자
- 활성 링크의 약한 발광
- 미발견 영역의 노이즈 또는 안개
- 현재 계층에 따른 배경 패턴 변화

### 13.2 상태별 후처리

| 상태 | 효과 |
|---|---|
| 탐색 | 낮은 Bloom, 약한 Scanline |
| 도구 조준 | 대상 외 영역 약한 Blur 또는 암전 |
| 패킷 전송 | 링크 Glow 증가 |
| 위험 증가 | 붉은 Vignette와 노이즈 |
| TLS 오류 | 짧은 Displacement와 색 분리 |
| 장비 장애 | Pixelate와 간헐적 Flicker |
| 성공 | Bloom 상승 후 안정화 |

### 13.3 효과 남용 방지

- 기본 화면은 읽기 쉬워야 한다.
- 글자와 패킷 정보를 왜곡하는 효과는 0.5초 안에 종료한다.
- 모든 화면에 Glow를 강하게 적용하지 않는다.
- 색수차와 글리치는 오류 또는 보안 사건에만 제한한다.
- 후처리를 꺼도 핵심 상태를 이해할 수 있어야 한다.

---

## 14. 사운드 설계

### 14.1 사운드 계층

- UI: 선택, 취소, 탭 이동
- 장비: 전원, 부팅, 포트, 팬, 릴레이
- 프로토콜: 패킷 발사, 응답, 핸드셰이크
- 환경: 서버실 저음, 데이터 흐름
- 사건: 차단, 오류, 인증 성공
- 음악: 탐색, 위험 상승, 클리어

### 14.2 프로토콜 사운드 언어

- ARP: 넓게 퍼지는 소나
- ICMP: 짧은 핑과 응답
- TCP: 3단계 리듬
- UDP: 빠르고 가벼운 연속음
- TLS: 두 키가 맞물리는 금속·디지털 혼합음
- SSH: 지속 연결을 나타내는 낮은 채널음

### 14.3 동기화 원칙

시각 효과보다 소리가 늦으면 조작감이 무너진다.

- 입력 피드백: 50ms 이내
- 충돌음: 충돌 프레임에 동기화
- 성공 충격음: 카메라 줌 정점과 동기화
- 패킷 이동음: 거리에 따라 팬과 볼륨 조절

---

## 15. 게임성 강화 시스템

### 15.1 Trace

무작위 조사와 잘못된 접근이 누적되면 Trace가 상승한다.

- 정확한 제한 프로브: 낮은 상승
- 전체 포트 난사: 높은 상승
- 인증 반복 실패: 높은 상승
- 로그를 근거로 한 정확한 행동: 상승 없음 또는 감소

Trace 단계:

```text
0~29: 안정
30~59: 감시
60~79: 경계
80~99: 추적
100: 임무 실패 또는 비상 탈출
```

단계가 오르면 음악, 배경, 방화벽 반응이 변한다.

### 15.2 Energy 또는 Bandwidth

강력한 도구를 무제한 사용하지 못하게 하는 자원이다.

- ping과 기본 조회: 매우 낮은 비용
- traceroute: 낮은 비용
- 범위 프로브: 중간 비용
- 암호 분석 또는 특수 장비: 높은 비용
- 정확한 단서 발견: 일부 회복

초반 스테이지에서는 자원 부족으로 진행이 막히지 않게 한다.

### 15.3 콤보가 아닌 분석 연쇄

빠른 클릭 콤보 대신 논리적으로 이어지는 행동을 보상한다.

```text
링크 확인
→ ARP 확인
→ 경로 확인
→ 포트 확인
→ 서비스 요청 성공
```

불필요한 행동 없이 증거 기반으로 이어지면 `Clean Route`, `Silent Probe`, `Layer Perfect` 같은 보너스를 준다.

### 15.4 장비와 스킬

스킬은 프로토콜 이름 버튼이 아니라 플레이 방식의 선택지가 되어야 한다.

예:

- Packet Lens: 패킷 헤더 일부를 즉시 시각화
- Route Pulse: 특정 경로의 응답 홉 강조
- Port Needle: 한 포트만 낮은 Trace로 확인
- Session Anchor: 연결 세션 한 번 유지
- Signal Booster: 불안정 링크 일시 안정화

학습용 기본 도구와 게임용 특수 스킬을 구분한다. 특수 스킬이 네트워크 원리를 무시하고 정답을 자동으로 알려주면 안 된다.

---

## 16. 애니메이션 시간 기준

### 16.1 기본 타이밍

| 행동 | 권장 시간 |
|---|---:|
| 버튼 입력 피드백 | 80~150ms |
| 대상 선택 | 150~250ms |
| 패킷 조립 | 300~700ms |
| 짧은 링크 이동 | 250~500ms |
| 장비 처리 | 150~400ms |
| 정보성 실패 | 400~800ms |
| 큰 실패 | 800~1500ms |
| 소목표 성공 | 500~1000ms |
| 최종 성공 | 3~6초 |

### 16.2 반복 행동 가속

- 첫 관찰: 1.0배
- 같은 행동 두 번째: 1.5배
- 이미 본 연출: 2.0배 또는 스킵 가능
- 최종 성공과 첫 계층 돌파: 기본적으로 스킵하지 않음

연출 때문에 학습과 실험 속도가 느려지지 않도록 한다.

---

## 17. 권장 프로젝트 구조

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  └─ providers/
│
├─ outgame/
│  ├─ main-menu/
│  ├─ campaign/
│  ├─ loadout/
│  ├─ achievements/
│  └─ settings/
│
├─ game/
│  ├─ GameHost.tsx
│  ├─ bridge/
│  │  ├─ game-events.ts
│  │  ├─ react-phaser-bridge.ts
│  │  └─ input-lock.ts
│  ├─ config/
│  │  └─ phaser-config.ts
│  ├─ scenes/
│  │  ├─ BootScene.ts
│  │  ├─ PreloadScene.ts
│  │  ├─ NetworkScene.ts
│  │  └─ ResultScene.ts
│  ├─ objects/
│  │  ├─ NetworkDevice.ts
│  │  ├─ NetworkLink.ts
│  │  ├─ PacketSprite.ts
│  │  └─ LayerGate.ts
│  ├─ presentation/
│  │  ├─ PresentationDirector.ts
│  │  ├─ clips/
│  │  ├─ camera/
│  │  ├─ particles/
│  │  ├─ fx/
│  │  └─ audio/
│  └─ input/
│
├─ ingame-ui/
│  ├─ objectives/
│  ├─ evidence/
│  ├─ toolbox/
│  ├─ packet-inspector/
│  ├─ terminal/
│  └─ result/
│
├─ simulation/
│  ├─ engine/
│  ├─ world/
│  ├─ actions/
│  ├─ events/
│  ├─ rules/
│  ├─ protocols/
│  │  ├─ ethernet/
│  │  ├─ arp/
│  │  ├─ ipv4/
│  │  ├─ icmp/
│  │  ├─ tcp/
│  │  ├─ udp/
│  │  ├─ dns/
│  │  ├─ tls/
│  │  ├─ http/
│  │  └─ ssh/
│  └─ validation/
│
├─ stages/
│  ├─ loader/
│  ├─ schema/
│  └─ repository/
│
├─ store/
│  ├─ game-store.ts
│  ├─ progress-store.ts
│  └─ settings-store.ts
│
└─ shared/
   ├─ types/
   ├─ components/
   └─ utils/

public/
├─ stages/
├─ sprites/
├─ textures/
├─ particles/
├─ audio/
└─ fonts/
```

---

## 18. 상태 관리

### 18.1 상태 소유권

| 상태 | 소유자 |
|---|---|
| 네트워크 월드 정답 상태 | SimulationEngine |
| 캠페인 진행 | React store |
| 열린 패널과 선택 탭 | React store |
| Phaser 카메라 상태 | Phaser |
| 현재 재생 중인 연출 | PresentationDirector |
| 사운드 설정 | 공용 settings store |
| 스테이지 원본 데이터 | StageRepository |

### 18.2 Zustand 사용 범위

Zustand는 React와 Phaser 사이의 모든 프레임 상태를 공유하는 용도로 사용하지 않는다.

적합한 상태:

- 현재 스테이지 ID
- 선택된 장비 ID
- 목표와 증거
- Trace와 자원
- 패널 상태
- 설정

부적합한 상태:

- 매 프레임 패킷 좌표
- 파티클 위치
- 카메라 보간 값
- Sprite animation frame

실시간 렌더링 상태는 Phaser 내부에서 관리한다.

---

## 19. 에셋 제작 기준

### 19.1 필요한 에셋

- 라우터, 스위치, 서버, 방화벽, AP 장비 스프라이트
- 장비별 정상·경고·오류 상태
- 포트와 링크 텍스처
- 프로토콜별 패킷 아이콘
- 에너지, 전기, 데이터 파편 파티클
- 잠금, 인증서, 키, 세션 효과
- 배경 격자와 노이즈
- UI 아이콘
- 효과음과 BGM

### 19.2 초기 스타일

초기에는 고해상도 일러스트보다 다음 스타일이 현실적이다.

- 2D 탑다운 또는 약한 아이소메트릭
- 어두운 청회색 배경
- 계층별 포인트 컬러
- 단순하지만 명확한 장비 실루엣
- 상태 변화가 잘 보이는 발광 포트
- 벡터 기반 UI와 래스터 게임 에셋 혼합

### 19.3 에셋 아틀라스

작은 이미지를 개별 파일로 과도하게 로드하지 않고 Phaser Texture Atlas로 묶는다.

```text
network-devices.png
network-devices.json

packet-effects.png
packet-effects.json
```

---

## 20. 성능 기준

### 20.1 목표

- 일반적인 노트북 브라우저에서 60FPS 목표
- 최소 30FPS 이하로 장시간 떨어지지 않음
- 스테이지 진입 후 반복 로딩 최소화
- 동시에 화면에 보이는 활성 패킷 수를 제한

### 20.2 최적화 원칙

- 패킷과 파티클 오브젝트 풀링
- 화면 밖 장비 효과 정지
- 정적 링크는 별도 레이어에 캐시
- 텍스트 오브젝트 수 제한
- 강한 후처리는 필요한 컨테이너에만 적용
- Phaser 상태를 React에 매 프레임 전달하지 않음
- 스테이지별 필요한 에셋만 선로딩

---

## 21. 접근성과 연출 설정

게임 연출이 정보 이해를 방해하면 안 된다.

- 카메라 흔들림 강도: 끄기/낮음/기본
- 화면 플래시: 감소 옵션
- 글리치와 색수차: 감소 옵션
- 색약 모드
- 패킷 속도: 0.75/1.0/1.5/2.0배
- 자막과 사운드 이벤트 텍스트
- 효과음·음악·환경음 개별 볼륨
- 키보드 조작
- 연출 스킵
- 모션 감소 모드

`prefers-reduced-motion` 브라우저 설정도 초기 기본값에 반영한다.

---

## 22. 테스트 전략

### 22.1 시뮬레이션 테스트

Phaser 없이 실행되는 단위 테스트로 네트워크 결과를 검증한다.

```ts
it("blocks a TCP SYN at the firewall", () => {
  const result = engine.execute(tcpConnectAction);

  expect(result.success).toBe(false);
  expect(result.reason).toBe("FIREWALL_BLOCKED");
  expect(result.presentationEvents).toContainEqual(
    expect.objectContaining({ type: "PACKET_BLOCKED" }),
  );
});
```

### 22.2 연출 테스트

- 각 `PresentationEvent`가 등록된 Clip을 가짐
- Clip 완료 후 오브젝트와 입력 잠금이 정상 복구됨
- 스킵 시 최종 상태가 정상 적용됨
- 화면 크기 변경 후 카메라 포커스가 맞음
- 후처리를 꺼도 상태 구분 가능

### 22.3 통합 테스트

- React에서 스킬 선택
- Phaser에서 대상 선택
- 시뮬레이션 실행
- Phaser 연출 재생
- React 증거와 목표 갱신

이 전체 흐름을 대표 행동별로 검증한다.

---

## 23. 개발 단계

### Phase 1. 게임 느낌 검증 프로토타입

Stage 5의 TCP 포트 퍼즐 한 개만 만든다.

필수 구현:

- PC, 라우터, 방화벽, 서버
- 카메라 이동과 줌
- TCP 스킬 선택과 대상 조준
- SYN 패킷 조립과 발사
- 열린 포트 성공
- 닫힌 포트 RST 실패
- 방화벽 차단 실패
- 소목표 성공 연출

이 단계에서는 완전한 네트워크 엔진보다 연출과 조작의 감각을 먼저 검증한다.

완료 질문:

> 설명 문구를 제거해도 플레이어가 패킷이 어디에서 왜 실패했는지 대략 느낄 수 있는가?

### Phase 2. 기술 골격

- React 라우팅과 아웃게임
- Phaser GameHost
- React–Phaser Bridge
- SimulationEngine
- PresentationDirector
- Stage JSON
- 기본 저장

### Phase 3. 공통 연출 라이브러리

- 장비 선택
- 패킷 조립
- 링크 이동
- 장비 처리
- 12종 실패 연출
- 계층 돌파
- 최종 성공
- 카메라·사운드·파티클 프리셋

### Phase 4. Stage 1~5

- L1~L4 규칙
- 각 스테이지 전용 연출
- Trace와 자원
- 증거와 힌트

### Phase 5. Stage 6~10

- DNS, HTTP, TLS, SSH
- 종합 스테이지
- 랭크와 결과 리포트

### Phase 6. 품질 개선

- 성능 최적화
- 접근성
- 사운드 믹싱
- 에셋 교체
- 브라우저 테스트
- PWA와 배포

---

## 24. 첫 프로토타입 범위

처음부터 전체 게임을 만들지 않는다. 다음 장면 하나를 완성한다.

### 프로토타입 장면

```text
Player PC
  └─ Router
      └─ Firewall
          └─ Web Server
```

플레이어 행동:

1. TCP Probe 선택
2. 서버 조준
3. 포트 80, 443, 8080 중 선택
4. 패킷 조립
5. SYN 발사
6. 경로 관찰
7. 결과 해석

결과:

- 80: 포트 닫힘, RST 반환
- 443: 방화벽 차단
- 8080: SYN-ACK와 연결 성공

필수 연출:

- 조준선
- 링크 충전
- 패킷 잔상
- 라우터 처리
- 방화벽 충돌
- RST 반사
- 성공 시 경로 전체 점등
- 성공·실패 사운드

이 프로토타입이 재미있고 읽기 쉬우면 전체 스테이지로 확장한다.

---

## 25. 기술 선택 요약

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript |
| 빌드 | Vite |
| 아웃게임 | React |
| 인게임 | Phaser 3 WebGL |
| 상태 관리 | Zustand |
| 시뮬레이션 | 프레임워크 비종속 TypeScript |
| 스테이지 | JSON + Schema validation |
| 테스트 | Vitest + Playwright |
| 스타일 | CSS/Tailwind 또는 shadcn/ui |
| 배포 | 정적 웹/PWA |
| 데스크톱 확장 | 필요 시 Tauri |
| 스테이지 에디터 | 추후 React Flow 검토 |

---

## 26. 구현 의사결정

1. 중앙 인게임은 Phaser로 구현한다.
2. React Flow는 플레이 화면에 사용하지 않는다.
3. 복잡한 폼과 데이터 패널은 React로 구현한다.
4. 네트워크 판정은 순수 TypeScript 엔진에서만 수행한다.
5. 엔진은 결과와 함께 연출 이벤트를 반환한다.
6. Phaser는 연출 이벤트를 순서대로 재생한다.
7. 모든 실패 원인은 고유한 월드 연출을 가진다.
8. 최종 성공은 최소 3초의 단계적 피날레를 가진다.
9. 반복 연출은 가속하거나 스킵할 수 있다.
10. 효과보다 상태 전달과 조작 반응을 우선한다.

---

## 27. 참고 자료

- Phaser 공식 사이트: [Phaser](https://phaser.io/)
- Phaser React·TypeScript 템플릿: [Project Templates](https://docs.phaser.io/phaser/getting-started/project-templates)
- Phaser 후처리 효과: [FX](https://docs.phaser.io/phaser/concepts/fx)
- Phaser 파티클: [ParticleEmitter](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter)
- React 공식 문서: [React](https://react.dev/)
- PixiJS 비교 참고: [PixiJS](https://pixijs.com/)
- React Flow 스테이지 에디터 후보: [React Flow](https://reactflow.dev/)
