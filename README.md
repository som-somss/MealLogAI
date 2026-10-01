# MealLogAI v6.8

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
