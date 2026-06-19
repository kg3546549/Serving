# STACK//BREACH 문서 목차

문서는 현재 코드, 향후 확장 기획, 이전 컨셉 보관안으로 구분합니다. 실제 동작을 확인할 때는 현재 구현 문서를 우선합니다.

## 변경 이력

- [커밋 SHA 기반 변경 이력 관리](./history/README.md)
- [변경 이력 문서 템플릿](./history/_template.md)

## 1. 현재 구현 기준

### [서비스 도메인 캠페인과 Stage 1 구현 아키텍처](./service-domain-campaign-architecture-ko.md)

- 구현 난이도 순으로 정렬한 8개 서비스 도메인
- Stage 1의 10개 HTTPS 웨이브
- 요청 → 서버 → DB → 응답 생명주기
- 적, 장비, DB 병목 설계

### [현재 구현 상세](./current-implementation-ko.md)

- 2026년 6월 19일 코드 기준
- Stage 1의 10개 웨이브
- 요청 → 서버 → DB → 응답 판정
- 7×4에서 확장되는 보드와 링크 용량
- React, Phaser, Zustand, 시뮬레이션 역할 분리
- 현재 화면과 점검 시스템

### [장비 티어·레벨·합성·증강 구현 명세](./device-upgrade-spec-ko.md)

- 20종 장비의 5개 티어와 가격
- 레벨 1~10 상점 확률과 XP 표
- 8칸 인벤토리와 3개 자동 합성
- 역할별 증강과 레어 확률
- 긴급·연장·추가점검 패시브

### [게임형 UI와 Phaser VFX 구현 구조](./game-feel-and-vfx-architecture-ko.md)

- 상시 정보와 우클릭 상세정보 분리
- 제한된 보드 카메라 이동
- Tween, Particle, Glow 기반 게임 피드백
- 클릭, 배치, 링크, 패킷 입력·연출 규칙

### [게임 한눈에 보기](./game-overview-summary-ko.md)

- 현재 게임의 한 줄 정의
- 실제 플레이 순서
- 화면 구성과 시각 스타일
- 클리어에 필요한 경로

## 2. 아키텍처 디펜스 확장 기획

아래 문서는 현재 프로토타입을 확장하기 위한 설계안입니다. 문서에 등장하는 모든 장비와 시스템이 구현된 것은 아닙니다.

- [아키텍처 디펜스 전환 기획](./architecture-defense-pivot-ko.md)
- [트래픽 웨이브·서버 캐릭터 상세 설계](./traffic-wave-and-server-design-ko.md)
- [레벨 디자인과 해금 요소](./level-design-and-unlocks-ko.md)
- [트래픽 경제와 보스 요청 설계](./traffic-economy-and-boss-design-ko.md)
- [오토배틀러 상점·레벨·장비 합성 설계](./autobattler-shop-and-merge-design-ko.md)

주요 확장 후보:

- Firewall, Cache, CDN, Queue, Worker, Read Replica
- 장비 업그레이드와 유지 비용
- 다양한 요청 유형과 보스 트래픽
- 10개 캠페인, 상점, 리롤, 장비 합성

## 3. 이전 네트워크 침투 퍼즐 컨셉 보관

아래 문서는 아키텍처 디펜스로 전환하기 전의 컨셉입니다. 현재 게임 규칙이나 화면을 설명하지 않으며, 네트워크 학습 아이디어와 기술 설계 참고용으로만 보관합니다.

- [이전 네트워크 퍼즐 상세 기획](./network-game-plan-ko.md)
- [이전 캠페인 스테이지 1~10](./campaign-stage-design-01-10-ko.md)
- [이전 웹 게임 기술 구조와 연출](./web-game-architecture-and-direction-ko.md)

## 확정 기술 구성

```text
React 19 + TypeScript
├─ 메뉴, HUD, Build Dock, 결과 UI
├─ Phaser 3 WebGL 게임 월드
├─ Zustand 진행 상태
├─ 순수 TypeScript 트래픽 시뮬레이션
├─ Vitest 단위 테스트
└─ Vite 빌드
```

React Flow는 현재 플레이 화면에 사용하지 않습니다. 추후 스테이지 제작 도구가 필요할 때만 후보로 검토합니다.
