# 변경 이력 관리

이 폴더는 주요 구현 커밋의 목적, 설계 판단, 변경 파일, 검증 결과를 장기 보관한다.

## 파일 이름

```text
docs/history/<full-commit-sha>.md
```

문서 이름의 SHA는 문서가 설명하는 **구현 커밋**의 전체 SHA를 사용한다.

Git 커밋 SHA는 커밋 내용과 메시지가 확정된 뒤 생성되므로 동일 커밋 안에 자기 SHA 이름의 파일을 포함할 수 없다. 따라서 다음 두 단계로 관리한다.

1. 구현 변경을 커밋한다.
2. 생성된 구현 커밋 SHA로 이력 문서를 작성하고 별도 문서 커밋으로 추가한다.

## 구현 커밋 메시지

주요 구현 커밋에는 다음 트레일러를 넣는다.

```text
History-Index: docs/history/README.md
```

이력 문서를 추가하는 후속 커밋에는 정확한 파일을 넣는다.

```text
History-File: docs/history/<full-commit-sha>.md
Source-Commit: <full-commit-sha>
```

## 문서 작성 기준

이력 문서는 다음 내용을 포함한다.

- 작업 배경과 목표
- 사용자 요구사항
- 주요 설계 결정
- 코드와 UI 변경 내용
- 데이터·게임 규칙 변경
- 주요 변경 파일
- 테스트·빌드·수동 검증 결과
- 알려진 제한사항과 후속 작업

새 문서는 [_template.md](./_template.md)를 복사해 작성한다.

## 등록된 변경 이력

- [`76d61d65a31548d418f878e00d1a81f97c11a454`](./76d61d65a31548d418f878e00d1a81f97c11a454.md) — 서비스 도메인 캠페인 전환과 Stage 1 구현
- [`a88de50eb225069a9026a8ca133c8796721910b5`](./a88de50eb225069a9026a8ca133c8796721910b5.md) — 장비 포트와 링크 용량 제약
- [`2bf6603a299e5bdb2a5e5cd45052d4dab6e1a849`](./2bf6603a299e5bdb2a5e5cd45052d4dab6e1a849.md) — 하단 보유 장비 Dock과 상점 가독성 개선
- [`afd5980ee157a595abd2e71e9c6b9df375c4b4b9`](./afd5980ee157a595abd2e71e9c6b9df375c4b4b9.md) — 상단 요청·응답 I/O와 유료 보드 확장

## 이력 조회

현재 브랜치의 구현 커밋 SHA를 확인한다.

```powershell
git log --oneline
```

해당 SHA와 같은 이름의 문서를 찾는다.

```powershell
Get-ChildItem docs/history
```

특정 구현 커밋과 문서를 함께 확인한다.

```powershell
git show <commit-sha>
Get-Content docs/history/<full-commit-sha>.md
```
