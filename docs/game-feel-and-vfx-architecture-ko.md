# 게임형 UI와 Phaser VFX 구현 구조

> 기준: 2026년 6월 19일

## 목표

게임 화면에서 항상 보여 주는 정보는 전투 판단에 필요한 값으로 제한한다.

- Stage와 Wave
- Service HP
- 현재 요청 수
- Credits
- 플레이어 레벨과 XP
- 장비 이름, 티어, 가격, 상태
- BOARD와 LINK 사용량

장비 역할, 긴 설명, 증강, 판매 기능은 상점·보유 장비 우클릭 상세창으로 이동한다.

## Phaser 사용 범위

별도 DOM 애니메이션 라이브러리를 추가하지 않고 Phaser 3.90의 게임 엔진 기능을 사용한다.

### Camera Bounds

활성 보드 크기와 현재 Zoom을 기준으로 카메라 이동 경계를 다시 계산한다.

```text
활성 보드 크기
→ 현재 viewport / zoom 계산
→ 둘 중 큰 크기로 camera bounds 설정
→ scrollX, scrollY clamp
```

보드 밖의 빈 월드로 무제한 이동할 수 없으며, 확대할수록 활성 보드 주변의 제한된 범위만 이동할 수 있다.

### Tween Manager

- 장비 배치 시 Back.Out 스케일 팝
- 장비 클릭 시 짧은 선택 펄스
- 새 링크 생성 시 링크 방향을 따라 이동하는 광점
- 요청 패킷의 서버, DB, 응답 경로 이동
- 성공, 실패, Queue 상태 피드백

### Particle Emitter

런타임에 작은 원형 텍스처를 생성하고 다음 효과에 재사용한다.

- 장비 배치 스파크
- 장비 선택 파편
- 링크 연결 도착 효과
- 이동 패킷의 발광 트레일

### WebGL Post FX

패킷과 링크 광점에 Glow를 적용한다. 현재 게임 렌더러는 WebGL로 고정되어 있어 Phaser 내장 FX를 사용할 수 있다.

## 입력 규칙

| 입력 | 동작 |
|---|---|
| 장비 좌클릭 | 선택 VFX |
| 장비 좌클릭 드래그 | 빈 격자로 이동 |
| 장비 우클릭 | 상세정보 |
| 장비 우클릭 드래그 | 링크 연결 |
| 상점 좌클릭 | 구매 |
| 상점 우클릭 | 상세정보 |
| 보유 장비 좌클릭 | 배치 모드 |
| 보유 장비 우클릭 | 상세정보와 판매 |
| 빈 보드 드래그 | 제한된 범위 안에서 카메라 이동 |
| 휠 | 보드 확대·축소 |
| R | 활성 보드에 화면 맞춤 |

## 공식 참고 자료

- Phaser Camera `setBounds`: https://docs.phaser.io/api-documentation/class/cameras-scene2d-basecamera
- Phaser Particle Emitter: https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter
- Phaser Tweens: https://docs.phaser.io/phaser/concepts/tweens
- Phaser FX: https://docs.phaser.io/phaser/concepts/fx
