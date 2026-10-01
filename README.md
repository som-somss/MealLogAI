# MealLog AI PWA

아이폰 Safari에서 홈 화면에 추가해 사용하는 개인용 식사 기록 PWA입니다.

## Vercel 배포 (Windows)
1. 이 폴더를 GitHub 저장소에 업로드합니다.
2. Vercel에서 Add New > Project > 해당 GitHub 저장소 Import.
3. Framework Preset은 Other, 나머지는 기본값으로 Deploy.
4. 배포가 끝나면 `https://...vercel.app` 주소가 발급됩니다.
5. AI 분석을 쓰려면 Vercel 프로젝트 > Settings > Environment Variables에서 `OPENAI_API_KEY`를 Secret으로 추가한 뒤 Redeploy 합니다.
6. iPhone Safari에서 발급 주소를 열고 공유 > 홈 화면에 추가.

## 주의
사진 기반 칼로리/중량은 AI 추정치입니다. 저장 전 사용자가 수정할 수 있습니다.
기록 및 사진은 현재 브라우저 localStorage에 저장되므로 Safari 사이트 데이터 삭제 시 함께 삭제될 수 있습니다.

## v6.5
PC/iPhone 음식 기록 모달 레이아웃, 취소 버튼, 사진 미리보기, 서비스워커 캐시를 안정화했습니다.
