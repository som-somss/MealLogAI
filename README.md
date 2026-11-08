# MealLog AI

2026-11-07에 기존 GitHub 코드보다 최신인 Vercel 운영 소스 77개를 복구했습니다.
각 파일의 SHA-1을 배포 파일 목록과 대조했으며, 원본 목록은
[`docs/production-source.json`](docs/production-source.json)에 있습니다.
복구 기준 배포: `dpl_9Sibbh8EunMMUng8P6wCKgd5sU69`.

## 현재 작업

- 실제 식사에서 조합을 저장하고 음식 양 수정·추가·빼기·교체를 식사와 조합에 함께 반영합니다. 여러 음식의 변경을 한 번에 최대 10개까지 처리합니다.
- 동기화 중 코치를 열면 완료를 기다려 자동 연결합니다. 응답 대기 중 작성한 다음 질문을 보존하며, 창을 닫았다 다시 열 때 이전 요청이 새 화면을 덮어쓰지 않습니다.
- AI 코치가 같은 대화의 음식, 사용자가 지정한 양, 분석 날짜를 기억합니다.
- `과메기 100g 먹으면?` → `그럼 반만 먹으면?` → `그러면 반만?`은 100g → 50g → 25g으로 계산합니다.
- 기준 양이 없으면 먼저 확인합니다. 추천량이나 열량 상한을 임의로 기준 양으로 삼지 않습니다.
- 새 대화, 다른 선택 날짜, 다른 주제로 넘어간 뒤에는 예전 음식의 양을 재사용하지 않습니다.
- 기존 `ai_coach_messages.metadata`에 문맥을 저장합니다. DB 스키마 변경은 없습니다.
- 생성형 AI를 끈 경우나 공급자 장애 시에도 명확한 양 비교는 기록 기반으로 처리합니다.
- AI 설명문에 숫자가 섞이면 해당 문장을 제외하고 검증된 계산표를 유지합니다. 설명이 남지 않을 때만 한 번 다시 작성합니다.
- 식사 기록 누락 등 주의사항도 AI 설명에 전달하며, 실패 진단에는 원문·API 키를 남기지 않습니다.

## 로컬 검증

Node.js 24에서 별도 패키지 설치 없이 실행합니다.

```sh
node --test
node scripts/check.mjs
```

테스트는 합성 식단·영양정보와 모의 Supabase/OpenAI 응답을 사용합니다.
실제 사용자 데이터에 쓰거나 유료 AI를 호출하지 않습니다.
로그인한 실제 계정에서 생성형 답변, 후속 질문, 대화 저장·재열기와 기준 양 누락 안내도 검증했습니다.

## 배포

기존 Vercel 프로젝트 `meallogai`의 정적 파일과 `api/` 서버 함수를 사용하는 앱입니다.
운영 주소는 https://meallogai.vercel.app 입니다.
고정 검증 주소는 https://meallogai-coach-preview-som-7f03.vercel.app 입니다.
배포 상태와 검증한 버전은 아래 배포 검증 문서에 기록합니다.
`OPENAI_API_KEY` 등 비밀값은 기존 Vercel 환경변수에 유지하며 저장소나 ZIP에 넣지 않습니다.
`supabase-config.js`에는 브라우저용 publishable key가 들어 있습니다.

복구·검증 내역은 [`docs/recovery-and-coach.md`](docs/recovery-and-coach.md)를 참고하세요.
최신 안정화 검증은 [`docs/coach-ui-verification.md`](docs/coach-ui-verification.md), 여러 음식 편집은 [`docs/coach-batch-verification.md`](docs/coach-batch-verification.md)에 있습니다.
최초 코치 배포 검증과 운영 관측 사항은 [`docs/release-verification.md`](docs/release-verification.md)에 있습니다.

## 이전 GitHub 버전 기록 (v6.8 이후)

v6.7 안정판을 기준으로 날짜 문구, 식약처 공공 영양DB 검색, 바코드 제품 조회 기능을 추가했습니다.

## 배포 전 1회 설정
Vercel 프로젝트 Settings → Environment Variables에 `FOOD_API_KEY`를 추가하고 공공데이터포털에서 발급받은 일반 인증키를 값으로 저장하세요. 인증키를 GitHub 파일에 직접 넣지 마세요.

환경변수 저장 후 새 배포가 필요합니다.

## 바코드
가능한 브라우저에서는 후면 카메라로 EAN/UPC 바코드를 읽습니다. 자동 스캔을 지원하지 않는 iPhone/브라우저에서는 바코드 아래 숫자를 직접 입력할 수 있습니다. 제품 조회는 Open Food Facts를 사용하며, 등록되지 않은 제품은 제품명으로 식약처 공공DB를 검색해 기록할 수 있습니다.


## v6.8.3
- 식약처 표준 camelCase 필드명(foodNm, companyNm, enerc, chocdf, prot, fatce, foodSize, nutConSrtrQua) 우선 지원
- 공공DB 제품명 앞의 불필요한 기호 정리 및 업체명 중복 축약
- 제품 기준량/단위(g, mL)를 음식 입력란과 배지에 표시
- 기존 v6.8.1 기능 유지, 서비스워커 캐시 v6.8.3로 갱신


## v6.8.4
Barcode product data normalization and serving-unit handling.


## v6.8.5
음식 검색창을 통합 자동검색으로 변경했습니다. 2글자 이상 입력 후 잠시 멈추면 로컬DB/최근 바코드/식약처/Open Food Facts 결과를 함께 표시합니다.

## v6.9
바코드/식약처/제품DB 데이터를 하나의 제품 레코드로 통합합니다. 제품 용량과 영양성분 기준량을 분리하여 음료 mL 계산을 안정화했고, 바코드 캐시를 v3로 갱신했습니다.
