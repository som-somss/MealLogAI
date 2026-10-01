const $=s=>document.querySelector(s), mealsEl=$('#meals'); let photoData='', editingMealId=null;
let state=JSON.parse(localStorage.getItem('meallog-state')||'{"goal":1800,"meals":[],"weights":[]}');
state.meals=state.meals||[]; state.weights=state.weights||[]; state.goal=state.goal||1800; state.targetWeight=state.targetWeight||null; state.activity=state.activity||{}; state.stepsGoal=state.stepsGoal||8000; state.waterGoal=state.waterGoal||2000;
const FOOD_DB=[
{name:'흰쌀밥',aliases:['밥','쌀밥','공기밥'],calories:130,carbs:28.2,protein:2.7,fat:.3,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'잡곡밥',aliases:['현미밥','잡곡'],calories:145,carbs:30,protein:3.2,fat:1.2,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'현미밥',aliases:['현미'],calories:123,carbs:25.6,protein:2.7,fat:1,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'김치',aliases:['배추김치'],calories:25,carbs:4.2,protein:1.6,fat:.5,portions:[['작은 접시',50],['100g',100]]},
{name:'깍두기',aliases:[],calories:33,carbs:6.5,protein:1.3,fat:.3,portions:[['작은 접시',50],['100g',100]]},
{name:'삶은 계란',aliases:['계란','달걀','삶은 달걀'],calories:155,carbs:1.1,protein:12.6,fat:10.6,portions:[['1개',50],['2개',100],['100g',100]]},
{name:'계란후라이',aliases:['계란 프라이','달걀후라이','후라이'],calories:196,carbs:.8,protein:13.6,fat:15,portions:[['1개',50],['2개',100],['100g',100]]},
{name:'스크램블에그',aliases:['스크램블'],calories:149,carbs:1.6,protein:10,fat:11,portions:[['계란 2개 분량',100],['100g',100]]},
{name:'닭가슴살',aliases:['치킨브레스트'],calories:165,carbs:0,protein:31,fat:3.6,portions:[['1팩/1조각',100],['150g',150],['100g',100]]},
{name:'닭다리살 구이',aliases:['닭다리살'],calories:209,carbs:0,protein:26,fat:11,portions:[['100g',100],['150g',150]]},
{name:'소고기 구이',aliases:['소고기','쇠고기'],calories:250,carbs:0,protein:26,fat:15,portions:[['100g',100],['150g',150]]},
{name:'돼지고기 삼겹살',aliases:['삼겹살'],calories:518,carbs:0,protein:17,fat:53,portions:[['100g',100],['1인분 150g',150]]},
{name:'돼지고기 목살',aliases:['목살'],calories:242,carbs:0,protein:27,fat:14,portions:[['100g',100],['1인분 150g',150]]},
{name:'연어',aliases:['연어구이'],calories:208,carbs:0,protein:20,fat:13,portions:[['100g',100],['150g',150]]},
{name:'고등어 구이',aliases:['고등어'],calories:205,carbs:0,protein:23,fat:12,portions:[['한 토막',100],['100g',100]]},
{name:'참치회',aliases:['참치'],calories:132,carbs:0,protein:28,fat:1.3,portions:[['100g',100],['150g',150]]},
{name:'광어회',aliases:['광어'],calories:103,carbs:0,protein:21,fat:1.7,portions:[['100g',100],['150g',150]]},
{name:'두부',aliases:[],calories:84,carbs:2,protein:9.3,fat:4.2,portions:[['1/4모',75],['반모',150],['100g',100]]},
{name:'김',aliases:['구운김'],calories:306,carbs:44,protein:36,fat:5,portions:[['1봉(약 5g)',5],['10g',10]]},
{name:'미역국',aliases:['소고기미역국'],calories:45,carbs:3,protein:4,fat:2,portions:[['1그릇',300],['100g',100]]},
{name:'된장찌개',aliases:['된장찌게'],calories:65,carbs:7,protein:5,fat:2.5,portions:[['1그릇',300],['100g',100]]},
{name:'김치찌개',aliases:['김치찌게'],calories:75,carbs:5,protein:6,fat:4,portions:[['1그릇',300],['100g',100]]},
{name:'순두부찌개',aliases:['순두부'],calories:78,carbs:4,protein:6,fat:4.5,portions:[['1그릇',350],['100g',100]]},
{name:'불고기',aliases:['소불고기'],calories:170,carbs:9,protein:17,fat:7,portions:[['1인분',200],['100g',100]]},
{name:'제육볶음',aliases:['제육'],calories:230,carbs:12,protein:17,fat:13,portions:[['1인분',200],['100g',100]]},
{name:'비빔밥',aliases:[],calories:140,carbs:23,protein:5,fat:3.5,portions:[['1그릇',450],['100g',100]]},
{name:'김밥',aliases:['일반김밥'],calories:170,carbs:28,protein:5.5,fat:4.5,portions:[['1줄',250],['반줄',125],['100g',100]]},
{name:'떡볶이',aliases:[],calories:180,carbs:36,protein:4,fat:2,portions:[['1인분',300],['100g',100]]},
{name:'라면',aliases:['라면 끓인것'],calories:140,carbs:21,protein:4,fat:4.5,portions:[['1봉 조리 후',500],['100g',100]]},
{name:'우동',aliases:[],calories:105,carbs:20,protein:3.5,fat:1,portions:[['1그릇',500],['100g',100]]},
{name:'냉면',aliases:[],calories:110,carbs:22,protein:3.5,fat:1,portions:[['1그릇',500],['100g',100]]},
{name:'칼국수',aliases:[],calories:100,carbs:19,protein:3.5,fat:1,portions:[['1그릇',550],['100g',100]]},
{name:'만두',aliases:['고기만두'],calories:200,carbs:25,protein:8,fat:8,portions:[['1개',30],['5개',150],['100g',100]]},
{name:'고구마',aliases:['찐고구마'],calories:128,carbs:30,protein:1.4,fat:.2,portions:[['중간 1개',150],['작은 1개',100],['100g',100]]},
{name:'감자',aliases:['삶은감자','찐감자'],calories:87,carbs:20,protein:1.9,fat:.1,portions:[['중간 1개',150],['100g',100]]},
{name:'바나나',aliases:[],calories:89,carbs:22.8,protein:1.1,fat:.3,portions:[['중간 1개',100],['반개',50],['100g',100]]},
{name:'사과',aliases:[],calories:52,carbs:13.8,protein:.3,fat:.2,portions:[['중간 1개',200],['반개',100],['100g',100]]},
{name:'딸기',aliases:[],calories:32,carbs:7.7,protein:.7,fat:.3,portions:[['5개 정도',100],['100g',100]]},
{name:'블루베리',aliases:[],calories:57,carbs:14.5,protein:.7,fat:.3,portions:[['한 줌',80],['100g',100]]},
{name:'포도',aliases:[],calories:69,carbs:18,protein:.7,fat:.2,portions:[['한 줌',100],['100g',100]]},
{name:'수박',aliases:[],calories:30,carbs:7.6,protein:.6,fat:.2,portions:[['한 조각',200],['100g',100]]},
{name:'귤',aliases:['감귤'],calories:47,carbs:12,protein:.9,fat:.1,portions:[['1개',100],['100g',100]]},
{name:'오렌지',aliases:[],calories:47,carbs:12,protein:.9,fat:.1,portions:[['1개',150],['100g',100]]},
{name:'키위',aliases:[],calories:61,carbs:14.7,protein:1.1,fat:.5,portions:[['1개',80],['100g',100]]},
{name:'아보카도',aliases:[],calories:160,carbs:8.5,protein:2,fat:14.7,portions:[['반개',100],['1개',200],['100g',100]]},
{name:'방울토마토',aliases:['토마토'],calories:18,carbs:3.9,protein:.9,fat:.2,portions:[['10개 정도',150],['100g',100]]},
{name:'오이',aliases:[],calories:15,carbs:3.6,protein:.7,fat:.1,portions:[['1개',200],['100g',100]]},
{name:'양상추',aliases:['샐러드채소'],calories:15,carbs:2.9,protein:1.4,fat:.2,portions:[['한 접시',100],['100g',100]]},
{name:'우유',aliases:['흰우유'],calories:61,carbs:4.8,protein:3.2,fat:3.3,portions:[['1잔',200],['1팩',200],['100ml',100]]},
{name:'저지방 우유',aliases:['저지방우유'],calories:42,carbs:5,protein:3.4,fat:1,portions:[['1잔',200],['100ml',100]]},
{name:'무가당 두유',aliases:['두유'],calories:40,carbs:3,protein:3.5,fat:2,portions:[['1팩',190],['100ml',100]]},
{name:'그릭요거트 플레인',aliases:['그릭요거트','그릭 요거트'],calories:97,carbs:3.9,protein:9,fat:5,portions:[['1컵',100],['150g',150]]},
{name:'플레인 요거트',aliases:['요거트','요구르트'],calories:63,carbs:7,protein:5.3,fat:1.6,portions:[['1컵',100],['150g',150]]},
{name:'체다치즈',aliases:['치즈'],calories:403,carbs:1.3,protein:25,fat:33,portions:[['1장',20],['2장',40],['100g',100]]},
{name:'아몬드',aliases:[],calories:579,carbs:21.6,protein:21.2,fat:49.9,portions:[['한 줌',25],['10알',12],['100g',100]]},
{name:'호두',aliases:[],calories:654,carbs:13.7,protein:15.2,fat:65.2,portions:[['한 줌',25],['100g',100]]},
{name:'식빵',aliases:['빵','토스트'],calories:265,carbs:49,protein:9,fat:3.2,portions:[['1장',35],['2장',70],['100g',100]]},
{name:'베이글',aliases:[],calories:250,carbs:49,protein:10,fat:1.5,portions:[['1개',100],['반개',50]]},
{name:'크루아상',aliases:[],calories:406,carbs:46,protein:8,fat:21,portions:[['1개',60],['100g',100]]},
{name:'오트밀',aliases:['귀리'],calories:379,carbs:67.7,protein:13.2,fat:6.5,portions:[['마른 것 40g',40],['100g',100]]},
{name:'아메리카노',aliases:['커피','아이스아메리카노','아아'],calories:2,carbs:.3,protein:.1,fat:0,portions:[['1잔',350]]},
{name:'카페라떼',aliases:['라떼'],calories:55,carbs:5,protein:3.2,fat:2.5,portions:[['1잔',350],['100ml',100]]},
{name:'콜라',aliases:['탄산음료'],calories:42,carbs:10.6,protein:0,fat:0,portions:[['1캔',355],['100ml',100]]},
{name:'제로콜라',aliases:['제로 콜라','제로음료'],calories:0,carbs:0,protein:0,fat:0,portions:[['1캔',355],['100ml',100]]},
{name:'삼계탕',aliases:['삼계탕 한그릇','영계백숙','닭백숙'],calories:102,carbs:5.0,protein:10.0,fat:4.5,portions:[['1그릇',900],['반그릇',450],['100g',100]]},
{name:'갈비탕',aliases:['소갈비탕'],calories:85,carbs:3.5,protein:8.5,fat:4,portions:[['1그릇',700],['반그릇',350],['100g',100]]},
{name:'설렁탕',aliases:['설농탕'],calories:75,carbs:2,protein:7,fat:4.5,portions:[['1그릇',700],['100g',100]]},
{name:'곰탕',aliases:['소곰탕'],calories:70,carbs:1.5,protein:7,fat:4,portions:[['1그릇',700],['100g',100]]},
{name:'육개장',aliases:[],calories:82,carbs:5,protein:7, fat:4.5,portions:[['1그릇',600],['100g',100]]},
{name:'감자탕',aliases:['뼈해장국'],calories:105,carbs:6,protein:9,fat:5.5,portions:[['1그릇',700],['100g',100]]},
{name:'부대찌개',aliases:[],calories:120,carbs:8,protein:7,fat:7,portions:[['1인분',400],['100g',100]]},
{name:'청국장찌개',aliases:['청국장'],calories:90,carbs:8,protein:7,fat:4,portions:[['1그릇',350],['100g',100]]},
{name:'닭볶음탕',aliases:['닭도리탕'],calories:135,carbs:8,protein:13,fat:6,portions:[['1인분',400],['100g',100]]},
{name:'찜닭',aliases:['안동찜닭'],calories:160,carbs:15,protein:14,fat:6,portions:[['1인분',400],['100g',100]]},
{name:'보쌈',aliases:['수육'],calories:260,carbs:2,protein:25,fat:17,portions:[['1인분',150],['100g',100]]},
{name:'족발',aliases:[],calories:240,carbs:4,protein:22,fat:15,portions:[['1인분',150],['100g',100]]},
{name:'돈까스',aliases:['돈가스'],calories:280,carbs:24,protein:15,fat:14,portions:[['1장',180],['100g',100]]},
{name:'오징어볶음',aliases:[],calories:125,carbs:12,protein:13,fat:3,portions:[['1인분',250],['100g',100]]},
{name:'낙지볶음',aliases:[],calories:120,carbs:12,protein:12,fat:3,portions:[['1인분',250],['100g',100]]},
{name:'잡채',aliases:[],calories:150,carbs:25,protein:4,fat:4.5,portions:[['1접시',200],['100g',100]]},
{name:'파전',aliases:['해물파전'],calories:210,carbs:24,protein:8,fat:9,portions:[['1장',250],['반장',125],['100g',100]]},
{name:'김치전',aliases:[],calories:190,carbs:27,protein:5,fat:7,portions:[['1장',200],['100g',100]]},
{name:'순대',aliases:[],calories:180,carbs:30,protein:7,fat:4,portions:[['1인분',250],['100g',100]]},
{name:'어묵',aliases:['오뎅'],calories:145,carbs:15,protein:10,fat:5,portions:[['1꼬치',50],['100g',100]]},
{name:'닭갈비',aliases:[],calories:155,carbs:10,protein:15,fat:6,portions:[['1인분',300],['100g',100]]},
{name:'쭈꾸미볶음',aliases:['주꾸미볶음'],calories:120,carbs:11,protein:13,fat:3,portions:[['1인분',250],['100g',100]]},
{name:'콩나물국밥',aliases:[],calories:85,carbs:14,protein:4, fat:1.5,portions:[['1그릇',600],['100g',100]]},
{name:'돼지국밥',aliases:[],calories:105,carbs:8,protein:10,fat:4,portions:[['1그릇',700],['100g',100]]},
{name:'순대국',aliases:['순댓국'],calories:115,carbs:8,protein:10,fat:5,portions:[['1그릇',700],['100g',100]]},
{name:'메밀국수',aliases:['모밀','메밀소바'],calories:105,carbs:20,protein:4,fat:1,portions:[['1그릇',500],['100g',100]]},
{name:'잔치국수',aliases:[],calories:95,carbs:18,protein:3.5,fat:1,portions:[['1그릇',550],['100g',100]]},
{name:'짜장면',aliases:['자장면'],calories:140,carbs:24,protein:5,fat:3,portions:[['1그릇',600],['100g',100]]},
{name:'짬뽕',aliases:[],calories:95,carbs:13,protein:7,fat:2,portions:[['1그릇',700],['100g',100]]},
{name:'탕수육',aliases:[],calories:270,carbs:30,protein:12,fat:11,portions:[['1인분',200],['100g',100]]},
{name:'닭강정',aliases:[],calories:300,carbs:32,protein:16,fat:12,portions:[['1인분',200],['100g',100]]},
{name:'후라이드치킨',aliases:['치킨','후라이드'],calories:290,carbs:10,protein:24,fat:18,portions:[['1조각',100],['100g',100]]},
{name:'양념치킨',aliases:[],calories:310,carbs:24,protein:20,fat:15,portions:[['1조각',100],['100g',100]]}
,
{name:"참치김밥",aliases:["참치 김밥"],calories:190,carbs:27,protein:7.5,fat:6.5,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"치즈김밥",aliases:["치즈 김밥"],calories:195,carbs:27,protein:7,fat:7,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"야채김밥",aliases:["채소김밥", "야채 김밥"],calories:160,carbs:29,protein:5,fat:3.5,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"소고기김밥",aliases:["불고기김밥", "소고기 김밥"],calories:205,carbs:27,protein:8.5,fat:7,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"돈까스김밥",aliases:["돈가스김밥"],calories:220,carbs:29,protein:7.5,fat:8.5,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"계란김밥",aliases:["달걀김밥"],calories:180,carbs:25,protein:7.5,fat:5.5,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"묵은지김밥",aliases:["묵은지 김밥"],calories:165,carbs:28,protein:5,fat:4,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"멸치김밥",aliases:["멸치 김밥"],calories:185,carbs:28,protein:7,fat:5,portions:[["1줄", 250], ["반줄", 125], ["100g", 100]]},
{name:"충무김밥",aliases:["충무 김밥"],calories:170,carbs:34,protein:4,fat:2,portions:[["1인분", 300], ["100g", 100]]},
{name:"꼬마김밥",aliases:["미니김밥"],calories:175,carbs:30,protein:5,fat:4,portions:[["5개", 200], ["1개", 40], ["100g", 100]]},
{name:"김치볶음밥",aliases:["김치 볶음밥"],calories:175,carbs:28,protein:5,fat:5,portions:[["1인분", 400], ["100g", 100]]},
{name:"새우볶음밥",aliases:["새우 볶음밥"],calories:180,carbs:27,protein:7,fat:5,portions:[["1인분", 400], ["100g", 100]]},
{name:"계란볶음밥",aliases:["달걀볶음밥"],calories:185,carbs:27,protein:6.5,fat:6,portions:[["1인분", 400], ["100g", 100]]},
{name:"소고기볶음밥",aliases:["쇠고기볶음밥"],calories:190,carbs:26,protein:8,fat:6,portions:[["1인분", 400], ["100g", 100]]},
{name:"오므라이스",aliases:["오믈렛라이스"],calories:170,carbs:25,protein:6,fat:5,portions:[["1인분", 450], ["100g", 100]]},
{name:"카레라이스",aliases:["카레밥", "카레"],calories:150,carbs:24,protein:5,fat:4,portions:[["1인분", 500], ["100g", 100]]},
{name:"알밥",aliases:[],calories:165,carbs:28,protein:6,fat:3.5,portions:[["1그릇", 400], ["100g", 100]]},
{name:"돌솥비빔밥",aliases:["돌솥 비빔밥"],calories:155,carbs:25,protein:5,fat:4,portions:[["1그릇", 450], ["100g", 100]]},
{name:"참치비빔밥",aliases:["참치 비빔밥"],calories:145,carbs:23,protein:7,fat:3.5,portions:[["1그릇", 450], ["100g", 100]]},
{name:"회덮밥",aliases:["회 덮밥"],calories:135,carbs:22,protein:7,fat:2.5,portions:[["1그릇", 500], ["100g", 100]]},
{name:"김치국",aliases:[],calories:35,carbs:5,protein:2,fat:1,portions:[["1그릇", 300], ["100g", 100]]},
{name:"콩나물국",aliases:[],calories:30,carbs:4,protein:2.5,fat:0.7,portions:[["1그릇", 300], ["100g", 100]]},
{name:"북엇국",aliases:["북어국", "황태국"],calories:45,carbs:3,protein:6,fat:1,portions:[["1그릇", 300], ["100g", 100]]},
{name:"떡국",aliases:[],calories:105,carbs:20,protein:4,fat:1.5,portions:[["1그릇", 500], ["100g", 100]]},
{name:"만둣국",aliases:["만두국"],calories:110,carbs:15,protein:6,fat:3,portions:[["1그릇", 500], ["100g", 100]]},
{name:"소고기무국",aliases:["무국"],calories:50,carbs:3,protein:6,fat:1.5,portions:[["1그릇", 300], ["100g", 100]]},
{name:"시래기국",aliases:["시래깃국"],calories:40,carbs:5,protein:3,fat:1,portions:[["1그릇", 300], ["100g", 100]]},
{name:"김치찜",aliases:[],calories:115,carbs:7,protein:9,fat:6,portions:[["1인분", 300], ["100g", 100]]},
{name:"동태찌개",aliases:["동태탕"],calories:70,carbs:5,protein:9,fat:2,portions:[["1그릇", 400], ["100g", 100]]},
{name:"참치김치찌개",aliases:[],calories:85,carbs:5,protein:8,fat:4,portions:[["1그릇", 350], ["100g", 100]]},
{name:"돼지고기김치찌개",aliases:[],calories:95,carbs:5,protein:8,fat:5,portions:[["1그릇", 350], ["100g", 100]]},
{name:"고추장찌개",aliases:[],calories:90,carbs:7,protein:7,fat:4,portions:[["1그릇", 350], ["100g", 100]]},
{name:"갈비찜",aliases:["소갈비찜"],calories:225,carbs:10,protein:18,fat:13,portions:[["1인분", 250], ["100g", 100]]},
{name:"돼지갈비",aliases:["돼지갈비구이"],calories:260,carbs:10,protein:20,fat:16,portions:[["1인분", 200], ["100g", 100]]},
{name:"LA갈비",aliases:["엘에이갈비"],calories:270,carbs:9,protein:21,fat:17,portions:[["1인분", 200], ["100g", 100]]},
{name:"소갈비구이",aliases:[],calories:285,carbs:4,protein:24,fat:20,portions:[["1인분", 180], ["100g", 100]]},
{name:"소고기장조림",aliases:["장조림"],calories:180,carbs:7,protein:24,fat:6,portions:[["작은 접시", 80], ["100g", 100]]},
{name:"닭꼬치",aliases:[],calories:190,carbs:12,protein:18,fat:8,portions:[["1꼬치", 100], ["100g", 100]]},
{name:"닭발",aliases:["매운닭발"],calories:185,carbs:12,protein:20,fat:6,portions:[["1인분", 200], ["100g", 100]]},
{name:"훈제오리",aliases:["오리훈제"],calories:310,carbs:2,protein:19,fat:25,portions:[["1인분", 150], ["100g", 100]]},
{name:"오리주물럭",aliases:[],calories:240,carbs:9,protein:18,fat:15,portions:[["1인분", 200], ["100g", 100]]},
{name:"연어회",aliases:["생연어"],calories:205,carbs:0,protein:20,fat:13,portions:[["10점", 150], ["100g", 100]]},
{name:"새우구이",aliases:["구운새우"],calories:110,carbs:1,protein:22,fat:2,portions:[["10마리", 150], ["100g", 100]]},
{name:"새우튀김",aliases:[],calories:240,carbs:20,protein:12,fat:12,portions:[["1개", 35], ["5개", 175], ["100g", 100]]},
{name:"오징어숙회",aliases:["오징어회"],calories:90,carbs:3,protein:16,fat:1.5,portions:[["1접시", 150], ["100g", 100]]},
{name:"물회",aliases:[],calories:75,carbs:10,protein:7,fat:1.5,portions:[["1그릇", 500], ["100g", 100]]},
{name:"초밥",aliases:["스시"],calories:155,carbs:27,protein:6,fat:2.5,portions:[["10개", 300], ["1개", 30], ["100g", 100]]},
{name:"연어초밥",aliases:[],calories:165,carbs:25,protein:8,fat:4,portions:[["10개", 300], ["1개", 30], ["100g", 100]]},
{name:"광어초밥",aliases:[],calories:150,carbs:26,protein:7,fat:2,portions:[["10개", 300], ["1개", 30], ["100g", 100]]},
{name:"유부초밥",aliases:[],calories:180,carbs:30,protein:6,fat:4,portions:[["5개", 200], ["1개", 40], ["100g", 100]]},
{name:"비빔국수",aliases:[],calories:125,carbs:24,protein:4,fat:2,portions:[["1그릇", 500], ["100g", 100]]},
{name:"쫄면",aliases:[],calories:135,carbs:27,protein:4,fat:1.5,portions:[["1그릇", 500], ["100g", 100]]},
{name:"라볶이",aliases:[],calories:175,carbs:33,protein:4,fat:3,portions:[["1인분", 350], ["100g", 100]]},
{name:"로제떡볶이",aliases:["로제 떡볶이"],calories:220,carbs:30,protein:5,fat:9,portions:[["1인분", 300], ["100g", 100]]},
{name:"짜파게티",aliases:["짜장라면"],calories:155,carbs:23,protein:4,fat:5,portions:[["1봉 조리 후", 500], ["100g", 100]]},
{name:"비빔면",aliases:[],calories:150,carbs:27,protein:4,fat:3,portions:[["1봉 조리 후", 450], ["100g", 100]]},
{name:"컵라면",aliases:[],calories:145,carbs:21,protein:4,fat:5,portions:[["1개 조리 후", 350], ["100g", 100]]},
{name:"김말이튀김",aliases:["김말이"],calories:245,carbs:31,protein:5,fat:11,portions:[["1개", 35], ["5개", 175], ["100g", 100]]},
{name:"고구마튀김",aliases:[],calories:250,carbs:34,protein:3,fat:11,portions:[["1개", 60], ["100g", 100]]},
{name:"야채튀김",aliases:["채소튀김"],calories:260,carbs:28,protein:4,fat:14,portions:[["1개", 80], ["100g", 100]]},
{name:"핫도그",aliases:["콘도그"],calories:280,carbs:28,protein:10,fat:14,portions:[["1개", 120], ["100g", 100]]},
{name:"토스트",aliases:["길거리토스트"],calories:230,carbs:28,protein:8,fat:10,portions:[["1개", 180], ["100g", 100]]},
{name:"햄버거",aliases:["버거"],calories:250,carbs:25,protein:13,fat:11,portions:[["1개", 220], ["100g", 100]]},
{name:"치즈버거",aliases:[],calories:270,carbs:24,protein:15,fat:13,portions:[["1개", 220], ["100g", 100]]},
{name:"불고기버거",aliases:[],calories:245,carbs:27,protein:12,fat:10,portions:[["1개", 220], ["100g", 100]]},
{name:"감자튀김",aliases:["프렌치프라이"],calories:310,carbs:41,protein:3.5,fat:15,portions:[["소", 80], ["중", 120], ["100g", 100]]},
{name:"피자",aliases:[],calories:265,carbs:33,protein:11,fat:10,portions:[["1조각", 120], ["2조각", 240], ["100g", 100]]},
{name:"페퍼로니피자",aliases:[],calories:290,carbs:32,protein:13,fat:13,portions:[["1조각", 120], ["100g", 100]]},
{name:"고구마피자",aliases:[],calories:280,carbs:36,protein:9,fat:11,portions:[["1조각", 120], ["100g", 100]]},
{name:"샌드위치",aliases:[],calories:220,carbs:25,protein:10,fat:9,portions:[["1개", 180], ["100g", 100]]},
{name:"에그샌드위치",aliases:["계란샌드위치"],calories:235,carbs:23,protein:11,fat:11,portions:[["1개", 180], ["100g", 100]]},
{name:"참치샌드위치",aliases:[],calories:225,carbs:22,protein:13,fat:9,portions:[["1개", 180], ["100g", 100]]},
{name:"닭가슴살샐러드",aliases:["치킨샐러드"],calories:115,carbs:7,protein:13,fat:4,portions:[["1팩", 250], ["100g", 100]]},
{name:"연어샐러드",aliases:[],calories:125,carbs:6,protein:10,fat:7,portions:[["1팩", 250], ["100g", 100]]},
{name:"시저샐러드",aliases:[],calories:145,carbs:8,protein:8,fat:9,portions:[["1팩", 250], ["100g", 100]]},
{name:"마카로니샐러드",aliases:[],calories:180,carbs:20,protein:4,fat:9,portions:[["작은 접시", 100], ["100g", 100]]},
{name:"고구마샐러드",aliases:[],calories:160,carbs:25,protein:2,fat:6,portions:[["작은 접시", 100], ["100g", 100]]},
{name:"단호박샐러드",aliases:[],calories:145,carbs:20,protein:3,fat:6,portions:[["작은 접시", 100], ["100g", 100]]},
{name:"김자반",aliases:["김가루"],calories:430,carbs:35,protein:20,fat:25,portions:[["1회", 10], ["20g", 20], ["100g", 100]]},
{name:"멸치볶음",aliases:[],calories:300,carbs:20,protein:35,fat:9,portions:[["작은 접시", 30], ["100g", 100]]},
{name:"진미채볶음",aliases:["오징어채볶음"],calories:280,carbs:28,protein:30,fat:6,portions:[["작은 접시", 40], ["100g", 100]]},
{name:"콩자반",aliases:[],calories:210,carbs:30,protein:12,fat:5,portions:[["작은 접시", 40], ["100g", 100]]},
{name:"시금치나물",aliases:[],calories:55,carbs:5,protein:4,fat:2,portions:[["작은 접시", 50], ["100g", 100]]},
{name:"콩나물무침",aliases:[],calories:45,carbs:5,protein:4,fat:1.5,portions:[["작은 접시", 50], ["100g", 100]]},
{name:"무생채",aliases:[],calories:45,carbs:8,protein:1.5,fat:0.8,portions:[["작은 접시", 50], ["100g", 100]]},
{name:"감자조림",aliases:[],calories:120,carbs:20,protein:2.5,fat:3.5,portions:[["작은 접시", 80], ["100g", 100]]},
{name:"계란말이",aliases:["달걀말이"],calories:160,carbs:3,protein:11,fat:11,portions:[["4조각", 100], ["100g", 100]]},
{name:"계란찜",aliases:["달걀찜"],calories:110,carbs:3,protein:10,fat:6,portions:[["1그릇", 200], ["100g", 100]]},
{name:"두부조림",aliases:[],calories:120,carbs:6,protein:9,fat:7,portions:[["작은 접시", 120], ["100g", 100]]},
{name:"두부김치",aliases:[],calories:155,carbs:8,protein:10,fat:9,portions:[["1접시", 250], ["100g", 100]]},
{name:"떡갈비",aliases:[],calories:230,carbs:12,protein:16,fat:13,portions:[["1장", 100], ["100g", 100]]},
{name:"동그랑땡",aliases:[],calories:220,carbs:14,protein:14,fat:12,portions:[["5개", 125], ["1개", 25], ["100g", 100]]},
{name:"김치만두",aliases:[],calories:190,carbs:27,protein:7,fat:6,portions:[["1개", 30], ["5개", 150], ["100g", 100]]},
{name:"군만두",aliases:[],calories:250,carbs:29,protein:8,fat:11,portions:[["1개", 30], ["5개", 150], ["100g", 100]]},
{name:"찐만두",aliases:[],calories:195,carbs:26,protein:8,fat:7,portions:[["1개", 30], ["5개", 150], ["100g", 100]]},
{name:"마라탕",aliases:[],calories:105,carbs:8,protein:8,fat:5,portions:[["1그릇", 700], ["100g", 100]]},
{name:"마라샹궈",aliases:[],calories:210,carbs:12,protein:12,fat:13,portions:[["1인분", 400], ["100g", 100]]},
{name:"쌀국수",aliases:["베트남쌀국수"],calories:85,carbs:14,protein:5,fat:1.5,portions:[["1그릇", 650], ["100g", 100]]},
{name:"팟타이",aliases:[],calories:180,carbs:27,protein:7,fat:5,portions:[["1인분", 400], ["100g", 100]]},
{name:"돈코츠라멘",aliases:["일본라멘", "라멘"],calories:135,carbs:15,protein:7,fat:5,portions:[["1그릇", 650], ["100g", 100]]},
{name:"메밀소바",aliases:["냉모밀", "소바"],calories:100,carbs:19,protein:4,fat:1,portions:[["1그릇", 500], ["100g", 100]]},
{name:"규동",aliases:["소고기덮밥"],calories:170,carbs:25,protein:8,fat:4,portions:[["1그릇", 450], ["100g", 100]]},
{name:"가츠동",aliases:["돈까스덮밥"],calories:205,carbs:26,protein:9,fat:7,portions:[["1그릇", 450], ["100g", 100]]},
{name:"연어덮밥",aliases:["사케동"],calories:175,carbs:23,protein:9,fat:5,portions:[["1그릇", 450], ["100g", 100]]},
{name:"크림파스타",aliases:[],calories:190,carbs:22,protein:6,fat:9,portions:[["1접시", 450], ["100g", 100]]},
{name:"토마토파스타",aliases:[],calories:135,carbs:22,protein:5,fat:3,portions:[["1접시", 450], ["100g", 100]]},
{name:"알리오올리오",aliases:[],calories:210,carbs:25,protein:5,fat:10,portions:[["1접시", 400], ["100g", 100]]},
{name:"로제파스타",aliases:[],calories:175,carbs:23,protein:6,fat:7,portions:[["1접시", 450], ["100g", 100]]},
{name:"리조또",aliases:[],calories:170,carbs:24,protein:6,fat:6,portions:[["1접시", 400], ["100g", 100]]},
{name:"콘푸로스트",aliases:["콘플레이크", "시리얼"],calories:370,carbs:84,protein:7,fat:1,portions:[["1회", 30], ["100g", 100]]},
{name:"그래놀라",aliases:[],calories:450,carbs:64,protein:10,fat:17,portions:[["1회", 40], ["100g", 100]]},
{name:"프로틴쉐이크",aliases:["단백질쉐이크"],calories:90,carbs:5,protein:15,fat:1.5,portions:[["1잔", 250], ["100ml", 100]]},
{name:"딸기우유",aliases:[],calories:75,carbs:12,protein:3,fat:2,portions:[["1팩", 200], ["100ml", 100]]},
{name:"초코우유",aliases:["초콜릿우유"],calories:80,carbs:12,protein:3.2,fat:2.3,portions:[["1팩", 200], ["100ml", 100]]},
{name:"바나나우유",aliases:[],calories:78,carbs:12,protein:3,fat:2.2,portions:[["1병", 240], ["100ml", 100]]},
{name:"아이스카페라떼",aliases:["아이스라떼"],calories:50,carbs:5,protein:3,fat:2,portions:[["1잔", 400], ["100ml", 100]]},
{name:"바닐라라떼",aliases:[],calories:85,carbs:12,protein:3,fat:3,portions:[["1잔", 400], ["100ml", 100]]},
{name:"카페모카",aliases:["모카"],calories:95,carbs:14,protein:3,fat:3,portions:[["1잔", 400], ["100ml", 100]]},
{name:"카라멜마끼아또",aliases:["카라멜마키아토"],calories:105,carbs:16,protein:3,fat:3.5,portions:[["1잔", 400], ["100ml", 100]]},
{name:"녹차라떼",aliases:["말차라떼"],calories:80,carbs:12,protein:3,fat:2.5,portions:[["1잔", 400], ["100ml", 100]]},
{name:"밀크티",aliases:[],calories:75,carbs:12,protein:2,fat:2,portions:[["1잔", 400], ["100ml", 100]]},
{name:"오렌지주스",aliases:["오렌지 주스"],calories:45,carbs:10.5,protein:0.7,fat:0.2,portions:[["1잔", 250], ["100ml", 100]]},
{name:"사과주스",aliases:["사과 주스"],calories:46,carbs:11,protein:0.1,fat:0.1,portions:[["1잔", 250], ["100ml", 100]]},
{name:"이온음료",aliases:["스포츠음료"],calories:25,carbs:6,protein:0,fat:0,portions:[["1병", 500], ["100ml", 100]]},
{name:"에너지드링크",aliases:["에너지음료"],calories:45,carbs:11,protein:0,fat:0,portions:[["1캔", 250], ["100ml", 100]]},
{name:"맥주",aliases:[],calories:43,carbs:3.6,protein:0.5,fat:0,portions:[["1캔", 355], ["500ml", 500], ["100ml", 100]]},
{name:"소주",aliases:[],calories:127,carbs:0,protein:0,fat:0,portions:[["1잔", 50], ["1병", 360], ["100ml", 100]]},
{name:"와인",aliases:["레드와인", "화이트와인"],calories:83,carbs:2.6,protein:0.1,fat:0,portions:[["1잔", 150], ["100ml", 100]]},
{name:"초코케이크",aliases:["초콜릿케이크"],calories:370,carbs:50,protein:5,fat:17,portions:[["1조각", 100], ["100g", 100]]},
{name:"치즈케이크",aliases:[],calories:320,carbs:26,protein:6,fat:22,portions:[["1조각", 100], ["100g", 100]]},
{name:"생크림케이크",aliases:[],calories:300,carbs:40,protein:4,fat:14,portions:[["1조각", 100], ["100g", 100]]},
{name:"마카롱",aliases:[],calories:430,carbs:58,protein:6,fat:19,portions:[["1개", 25], ["100g", 100]]},
{name:"도넛",aliases:["도너츠"],calories:400,carbs:50,protein:5,fat:20,portions:[["1개", 70], ["100g", 100]]},
{name:"붕어빵",aliases:[],calories:230,carbs:43,protein:5,fat:4,portions:[["1개", 80], ["100g", 100]]},
{name:"호떡",aliases:[],calories:320,carbs:52,protein:5,fat:11,portions:[["1개", 100], ["100g", 100]]},
{name:"약과",aliases:[],calories:430,carbs:65,protein:4,fat:17,portions:[["1개", 30], ["100g", 100]]},
{name:"인절미",aliases:[],calories:220,carbs:47,protein:5,fat:1.5,portions:[["5개", 100], ["100g", 100]]},
{name:"송편",aliases:[],calories:220,carbs:45,protein:4,fat:3,portions:[["5개", 100], ["100g", 100]]},
{name:"팥빙수",aliases:["빙수"],calories:145,carbs:28,protein:4,fat:2,portions:[["1그릇", 500], ["100g", 100]]},
{name:"아이스크림",aliases:[],calories:210,carbs:24,protein:3.5,fat:11,portions:[["1스쿱", 70], ["100g", 100]]},
{name:"초콜릿",aliases:[],calories:535,carbs:59,protein:8,fat:30,portions:[["1회", 30], ["100g", 100]]},
{name:"감자칩",aliases:["포테이토칩"],calories:535,carbs:53,protein:6,fat:34,portions:[["1봉", 60], ["30g", 30], ["100g", 100]]},
{name:"새우깡",aliases:[],calories:490,carbs:65,protein:6,fat:23,portions:[["1봉", 90], ["30g", 30], ["100g", 100]]},
{name:"팝콘",aliases:[],calories:390,carbs:65,protein:12,fat:10,portions:[["1컵", 25], ["100g", 100]]}
];

let selectedDate=localDateKey(new Date()),calendarMonth=new Date(selectedDate+"T12:00:00");
function localDateKey(d){let z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
function localISO(d=new Date()){let z=n=>String(n).padStart(2,'0');return `${localDateKey(d)}T${z(d.getHours())}:${z(d.getMinutes())}`}
function save(){localStorage.setItem('meallog-state',JSON.stringify(state));render();if(!$('#statsView').hidden)renderStats();if(!$('#weightView').hidden)renderWeights()}
function dateText(k){let d=new Date(k+"T12:00:00");return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(d)}
function stampText(t){let d=new Date(t);return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function defaultTimeForDate(k){let now=new Date(), today=localDateKey(now); if(k===today)return localISO(now); return `${k}T12:00`}
function render(){
 let day=state.meals.filter(m=>m.time&&m.time.slice(0,10)===selectedDate).sort((a,b)=>a.time.localeCompare(b.time));
 let sum=k=>day.flatMap(m=>m.foods||[]).reduce((a,f)=>a+(+f[k]||0),0),cal=Math.round(sum('calories'));
 $('#totalCal').textContent=cal;$('#remainCal').textContent=Math.max(0,state.goal-cal);$('#carbs').textContent=Math.round(sum('carbs'));$('#protein').textContent=Math.round(sum('protein'));$('#fat').textContent=Math.round(sum('fat'));
 $('#todayLabel').textContent=selectedDate===localDateKey(new Date())?'오늘의 식사 다이어리':'지난 식사 다이어리';
 $('#selectedDateLabel').textContent=dateText(selectedDate);$('#recordDateHint').textContent=selectedDate===localDateKey(new Date())?'':'';
 mealsEl.innerHTML=day.length?'':'<div class="empty">이 날짜에는 아직 기록이 없어요.<br>아래 버튼으로 식사를 추가해보세요.</div>';
 day.forEach(m=>{let c=(m.foods||[]).reduce((a,f)=>a+(+f.calories||0),0),names=(m.foods||[]).map(f=>f.name).join(', '),photo=m.photo?`<div class="mealPhoto"><img src="${m.photo}"></div>`:`<div class="mealNoPhoto"><span class="plateIcon"></span></div>`;let el=document.createElement('article');el.className='meal';el.innerHTML=`${photo}<div><h3>${m.type} · ${new Date(m.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</h3><p>${names||'음식 기록'}</p><p><b>${Math.round(c)} kcal</b></p></div><button class="delete">×</button>`;el.onclick=e=>{if(!e.target.closest('.delete'))openMealEditor(m)};el.querySelector('.delete').onclick=e=>{e.stopPropagation();if(confirm('이 기록을 삭제할까요?')){state.meals=state.meals.filter(x=>x.id!==m.id);save()}};mealsEl.appendChild(el)});
 renderCalendar();renderActivity()
}
function activityFor(k){if(!state.activity[k])state.activity[k]={steps:0,water:0,waterHistory:[]};state.activity[k].waterHistory=state.activity[k].waterHistory||[];return state.activity[k]}
function renderActivity(){
 let a=activityFor(selectedDate),sg=state.stepsGoal||8000,wg=state.waterGoal||2000,sp=Math.min(100,Math.round((a.steps||0)/sg*100)),wp=Math.min(100,Math.round((a.water||0)/wg*100));
 $('#stepsToday').textContent=(a.steps||0).toLocaleString();$('#waterToday').textContent=(a.water||0).toLocaleString();$('#stepsGoalText').textContent=sg.toLocaleString();$('#waterGoalText').textContent=wg.toLocaleString();
 $('#stepsPercent').textContent=`${sp}%`;$('#waterPercent').textContent=`${wp}%`;$('#stepsProgress').style.width=`${sp}%`;$('#waterProgress').style.width=`${wp}%`;$('#activityDateLabel').textContent=selectedDate===localDateKey(new Date())?'오늘':dateText(selectedDate);
}
function setSteps(){
 let a=activityFor(selectedDate),v=prompt('걸음 수를 입력하세요.',a.steps||'');if(v===null)return;v=Math.max(0,Math.round(+v||0));a.steps=v;save();renderActivity()
}
function addWater(ml){let a=activityFor(selectedDate);a.waterHistory.push(ml);a.water=(a.water||0)+ml;save();renderActivity()}
function undoWater(){let a=activityFor(selectedDate),last=a.waterHistory.pop();if(last){a.water=Math.max(0,(a.water||0)-last);save();renderActivity()}}
function changeDay(n){let d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+n);selectedDate=localDateKey(d);calendarMonth=new Date(d);render()}
$('#prevDay').onclick=()=>changeDay(-1);$('#nextDay').onclick=()=>changeDay(1);
$('#dateBtn').onclick=()=>{calendarMonth=new Date(selectedDate+"T12:00:00");$('#calendarPanel').hidden=!$('#calendarPanel').hidden;renderCalendar()};
$('#todayBtn').onclick=()=>{selectedDate=localDateKey(new Date());calendarMonth=new Date();$('#calendarPanel').hidden=true;render()};
$('#prevMonth').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar()};$('#nextMonth').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar()};
function renderCalendar(){let y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();$('#monthLabel').textContent=`${y}년 ${m+1}월`;let grid=$('#calendarGrid');grid.innerHTML='';let first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let mealDays=new Set(state.meals.filter(x=>x.time).map(x=>x.time.slice(0,10)));for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let k=localDateKey(d),b=document.createElement('button');b.type='button';b.className='day';b.textContent=d.getDate();if(d.getMonth()!=m)b.classList.add('other');if(k===selectedDate)b.classList.add('selected');if(k===localDateKey(new Date()))b.classList.add('today');if(mealDays.has(k))b.classList.add('hasMeal');b.onclick=()=>{selectedDate=k;calendarMonth=new Date(k+"T12:00:00");$('#calendarPanel').hidden=true;render()};grid.appendChild(b)}}
function norm(s){return(s||'').toLowerCase().replace(/\s/g,'')}function findFoods(q){q=norm(q);if(!q)return[];return FOOD_DB.filter(f=>norm(f.name).includes(q)||(f.aliases||[]).some(a=>norm(a).includes(q))).slice(0,20)}
function calcRow(row){const idx=+row.dataset.dbIndex;if(!Number.isInteger(idx)||!FOOD_DB[idx])return;const f=FOOD_DB[idx],g=Math.max(0,+row.querySelector('.grams').value||0),r=g/100;row.querySelector('.calories').value=Math.round(f.calories*r);row.querySelector('.carbs').value=(f.carbs*r).toFixed(1);row.querySelector('.protein').value=(f.protein*r).toFixed(1);row.querySelector('.fat').value=(f.fat*r).toFixed(1)}
function chooseFood(row,f){const idx=FOOD_DB.indexOf(f);row.dataset.dbIndex=idx;row.querySelector('.name').value=f.name;const p=row.querySelector('.portion');p.innerHTML='';(f.portions||[['100g',100]]).forEach(([n,g])=>{let o=document.createElement('option');o.value=g;o.textContent=`${n} (${g}g)`;p.appendChild(o)});p.hidden=false;row.querySelector('.dbBadge').hidden=false;row.querySelector('.grams').value=(f.portions?.[0]?.[1]||100);row.querySelector('.suggestions').hidden=true;calcRow(row)}
function showSuggestions(row,q){let box=row.querySelector('.suggestions'),ms=findFoods(q);box.innerHTML='';if(!q||!ms.length){box.hidden=true;return}ms.forEach(f=>{let b=document.createElement('button');b.type='button';b.className='suggestion';b.innerHTML=`<b>${f.name}</b><small>100g 기준 ${f.calories} kcal · 탄 ${f.carbs}g · 단 ${f.protein}g · 지 ${f.fat}g</small>`;b.onclick=()=>chooseFood(row,f);box.appendChild(b)});box.hidden=false}
function addFood(f={}){let d=document.createElement('div');d.className='foodRow';d.innerHTML=`<button type="button" class="removeFood">×</button><div class="foodTop"><div class="foodNameWrap"><input class="name" placeholder="음식명 또는 메뉴를 검색하세요" autocomplete="off" value="${f.name||''}"><div class="suggestions" hidden></div></div><input class="grams" type="number" min="0" placeholder="g" value="${f.grams||''}"></div><div class="portionBar"><select class="portion" hidden></select><span class="dbBadge" hidden>영양 자동 계산</span></div><div class="nutrition"><label class="nutriField"><span>칼로리</span><div><input class="calories" type="number" min="0" step="1" placeholder="0" value="${f.calories??''}"><em>kcal</em></div></label><label class="nutriField"><span>탄수화물</span><div><input class="carbs" type="number" min="0" step="0.1" placeholder="0.0" value="${f.carbs??''}"><em>g</em></div></label><label class="nutriField"><span>단백질</span><div><input class="protein" type="number" min="0" step="0.1" placeholder="0.0" value="${f.protein??''}"><em>g</em></div></label><label class="nutriField"><span>지방</span><div><input class="fat" type="number" min="0" step="0.1" placeholder="0.0" value="${f.fat??''}"><em>g</em></div></label></div>`;$('#foods').appendChild(d);let name=d.querySelector('.name'),g=d.querySelector('.grams'),p=d.querySelector('.portion');name.oninput=()=>{delete d.dataset.dbIndex;p.hidden=true;d.querySelector('.dbBadge').hidden=true;showSuggestions(d,name.value)};name.onfocus=()=>showSuggestions(d,name.value);g.oninput=()=>calcRow(d);p.onchange=()=>{g.value=p.value;calcRow(d)};d.querySelector('.removeFood').onclick=()=>document.querySelectorAll('.foodRow').length>1?d.remove():null;if(f.name){let ex=FOOD_DB.find(x=>norm(x.name)===norm(f.name));if(ex&&!f.calories)chooseFood(d,ex)}}
document.addEventListener('click',e=>{if(!e.target.closest('.foodNameWrap'))document.querySelectorAll('.suggestions').forEach(x=>x.hidden=true)});
let photoPreviewUrl='';
function setPhotoUI(previewSrc=''){
  const img=$('#preview'), text=$('#photoText');
  const src=previewSrc||photoData||'';
  const has=!!src;
  img.hidden=!has;
  img.style.display=has?'block':'none';
  text.hidden=has;
  text.style.display=has?'none':'';
  $('#removePhoto').hidden=!has;
  $('#analyzeBtn').disabled=!photoData;
  if(has) img.src=src; else img.removeAttribute('src');
}
function clearPreviewUrl(){ if(photoPreviewUrl){try{URL.revokeObjectURL(photoPreviewUrl)}catch(_){ } photoPreviewUrl='';} }
function showMealModal(){const d=$('#mealDialog');d.hidden=false;d.classList.add('isOpen');document.documentElement.classList.add('mealModalOpen');document.body.classList.add('mealModalOpen');setTimeout(()=>$('#cancelBtn')?.focus({preventScroll:true}),0)}
function hideMealModal(){const d=$('#mealDialog');d.classList.remove('isOpen');d.hidden=true;document.documentElement.classList.remove('mealModalOpen');document.body.classList.remove('mealModalOpen')}
function openNewMeal(){editingMealId=null;photoData='';$('#dialogTitle').textContent='음식 기록';$('#saveTop').textContent='저장';$('#photo').value='';$('#mealType').value='아침';$('#mealTime').value=defaultTimeForDate(selectedDate);$('#foods').innerHTML='';addFood();let ni=document.querySelector('.foodRow .name');if(ni)ni.placeholder='아침 식사로 무엇을 드셨나요?';$('#memo').value='';$('#status').textContent='';setPhotoUI();showMealModal()}
function openMealEditor(m){editingMealId=m.id;photoData=m.photo||'';$('#dialogTitle').textContent='식사 기록 수정';$('#saveTop').textContent='수정 저장';$('#photo').value='';$('#mealType').value=m.type||'아침';$('#mealTime').value=m.time||defaultTimeForDate(selectedDate);$('#foods').innerHTML='';(m.foods&&m.foods.length?m.foods:[{}]).forEach(addFood);$('#memo').value=m.memo||'';$('#status').textContent='사진과 식사 내용을 수정할 수 있어요.';setPhotoUI();showMealModal()}
$('#addBtn').onclick=openNewMeal;
// v6.1: clicking the backdrop must NOT close the meal editor.
// This prevents accidental loss of a meal while scrolling/tapping on mobile.
// v6.4: the meal editor is a normal fixed overlay instead of <dialog> for iPhone Safari stability.
$('#mealDialog').addEventListener('click',e=>{ if(e.target===$('#mealDialog')) e.preventDefault(); });

function setEntryMode(mode){
  document.querySelectorAll('.entryMode').forEach(b=>b.classList.remove('active'));
  if(mode==='search'){
    $('#modeSearch')?.classList.add('active');
    setTimeout(()=>document.querySelector('.foodRow .name')?.focus(),80);
  }else if(mode==='photo'){
    $('#modePhoto')?.classList.add('active');
    $('#photo')?.click();
  }else if(mode==='ai'){
    $('#modeAI')?.classList.add('active');
    if(!photoData){ $('#status').textContent='AI 분석을 사용하려면 먼저 음식 사진을 선택해주세요.'; $('#photo')?.click(); }
    else $('#analyzeBtn')?.click();
  }
}
$('#modeSearch').onclick=()=>setEntryMode('search');
$('#modePhoto').onclick=()=>setEntryMode('photo');
$('#modeAI').onclick=()=>setEntryMode('ai');$('#editSteps').onclick=setSteps;document.querySelectorAll('[data-water]').forEach(b=>b.onclick=()=>addWater(+b.dataset.water));$('#undoWater').onclick=undoWater;
function mealDraftHasContent(){
  if(editingMealId) return true;
  if(photoData || ($('#memo').value||'').trim()) return true;
  return [...document.querySelectorAll('#foods .foodRow')].some(row=>{
    const name=(row.querySelector('.name')?.value||'').trim();
    const grams=+(row.querySelector('.grams')?.value||0);
    const calories=+(row.querySelector('.calories')?.value||0);
    return !!name || grams>0 || calories>0;
  });
}
function closeMealEditor(){
  // Mobile: Cancel must always work immediately. Nothing is saved until Save is pressed.
  editingMealId=null; photoData=''; clearPreviewUrl();
  document.querySelectorAll('.suggestions').forEach(x=>x.hidden=true);
  hideMealModal();
}

// v6.3: dedicated mobile-safe Cancel handler. Do not rely on pointerdown.
const cancelBtn=$('#cancelBtn');
const cancelMeal=e=>{e.preventDefault();e.stopPropagation();closeMealEditor();};
cancelBtn.addEventListener('click',cancelMeal,{capture:true});
$('#addFood').onclick=()=>addFood();$('#removePhoto').onclick=()=>{photoData='';clearPreviewUrl();$('#photo').value='';setPhotoUI();$('#status').textContent='사진을 삭제했어요. 저장하면 기록에서 제거돼요.'};
$('#photo').onchange=async e=>{
  const f=e.target.files&&e.target.files[0]; if(!f)return;
  $('#status').textContent='사진을 불러오는 중이에요…';
  clearPreviewUrl();
  try{
    // FileReader works more reliably than blob URLs in the iPhone in-app browser.
    const original=await fileToDataURL(f);
    photoData=original;
    setPhotoUI(original);
    $('#status').textContent='사진이 추가됐어요.';
    // Compress when Safari can decode the image. If not, keep the original data URL.
    try{ const compressed=await resizeDataURL(original,1200,.78); if(compressed){photoData=compressed;setPhotoUI(compressed);} }catch(_){ }
    const body=document.querySelector('#mealDialog .mealDialogBody'); if(body) body.scrollTop=0;
  }catch(err){
    photoData=''; setPhotoUI();
    $('#status').textContent='사진을 불러오지 못했어요. 사진 앱에서 JPG/PNG 사진을 선택해 다시 시도해주세요.';
  }
};
function fileToDataURL(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error||new Error('파일 읽기 실패'));fr.readAsDataURL(file)})}
async function resizeDataURL(original,max,q){
  return await new Promise(resolve=>{
    const im=new Image();
    im.onload=()=>{
      try{
        const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
        const scale=Math.min(1,max/Math.max(w,h));
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',q));
      }catch(_){resolve(original)}
    };
    im.onerror=()=>resolve(original);im.src=original;
  });
}
async function resize(file,max,q){return resizeDataURL(await fileToDataURL(file),max,q)}
$('#analyzeBtn').onclick=async()=>{let b=$('#analyzeBtn');b.disabled=true;$('#status').textContent='AI가 음식을 분석하고 있어요…';try{let res=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:photoData})}),data=await res.json();if(!res.ok)throw Error(data.error||'분석 실패');$('#foods').innerHTML='';(data.foods||[]).forEach(addFood);if(!(data.foods||[]).length)addFood();$('#status').textContent='AI 추정 결과예요. 음식과 양을 확인한 뒤 저장하세요.'}catch(e){$('#status').textContent=`AI 분석을 사용할 수 없어요: ${e.message} · 음식 검색은 계속 사용할 수 있어요.`}finally{b.disabled=false}};
$('#mealForm').onsubmit=e=>{e.preventDefault();let foods=[...document.querySelectorAll('.foodRow')].map(d=>({name:d.querySelector('.name').value||'음식',grams:+d.querySelector('.grams').value||0,calories:+d.querySelector('.calories').value||0,carbs:+d.querySelector('.carbs').value||0,protein:+d.querySelector('.protein').value||0,fat:+d.querySelector('.fat').value||0})).filter(f=>f.name!=='음식'||f.calories||f.grams);let time=$('#mealTime').value||defaultTimeForDate(selectedDate);let meal={id:editingMealId||crypto.randomUUID(),type:$('#mealType').value,time,photo:photoData,foods,memo:$('#memo').value};if(editingMealId){let i=state.meals.findIndex(x=>x.id===editingMealId);if(i>=0)state.meals[i]=meal;else state.meals.push(meal)}else state.meals.push(meal);editingMealId=null;selectedDate=time.slice(0,10);save();hideMealModal()};
$('#settingsBtn').onclick=()=>{$('#goalInput').value=state.goal;$('#targetWeightInput').value=state.targetWeight||'';$('#stepsGoalInput').value=state.stepsGoal||8000;$('#waterGoalInput').value=state.waterGoal||2000;$('#settingsDialog').showModal()};$('#settingsClose').onclick=()=>$('#settingsDialog').close();$('#saveSettings').onclick=()=>{state.goal=+$('#goalInput').value||1800;let tw=+$('#targetWeightInput').value;state.targetWeight=tw>0?tw:null;state.stepsGoal=+$('#stepsGoalInput').value||8000;state.waterGoal=+$('#waterGoalInput').value||2000;save();$('#settingsDialog').close()};
let statsDays=7;
function dayKeyOffset(n){let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return localDateKey(d)}
function renderStats(){
 let keys=Array.from({length:statsDays},(_,i)=>dayKeyOffset(i-(statsDays-1)));
 let totals=keys.map(k=>{let fs=state.meals.filter(m=>m.time?.slice(0,10)===k).flatMap(m=>m.foods||[]);let sum=n=>fs.reduce((a,f)=>a+(+f[n]||0),0);return {k,cal:sum('calories'),carbs:sum('carbs'),protein:sum('protein'),fat:sum('fat')}});
 let logged=totals.filter(x=>x.cal>0), average=n=>logged.length?logged.reduce((a,x)=>a+x[n],0)/logged.length:0;
 $('#avgCalories').textContent=`${Math.round(average('cal'))} kcal`;$('#loggedDays').textContent=`${logged.length}일`;$('#avgCarbs').textContent=`${Math.round(average('carbs'))}g`;$('#avgProtein').textContent=`${Math.round(average('protein'))}g`;$('#avgFat').textContent=`${Math.round(average('fat'))}g`;
 $('#statsPeriodLabel').textContent=`최근 ${statsDays}일`;
 let max=Math.max(state.goal,...totals.map(x=>x.cal),1),chart=$('#calorieChart');chart.innerHTML='';
 totals.forEach((x,i)=>{let col=document.createElement('div');col.className='barCol';let h=x.cal?Math.max(3,Math.round(x.cal/max*100)):0;let label=statsDays===7?new Date(x.k+'T12:00').toLocaleDateString('ko-KR',{weekday:'short'}):((i%5===0||i===totals.length-1)?new Date(x.k+'T12:00').getDate():'');col.innerHTML=`<div class="barValue">${x.cal?Math.round(x.cal):''}</div><div class="barTrack">${x.cal?`<i style="height:${h}%"></i>`:'<span class="zeroMark"></span>'}</div><small>${label}</small>`;chart.appendChild(col)});
 let goal=document.createElement('div');goal.className='calorieGoalLine';goal.style.bottom=`calc(20px + ${(state.goal/max)*148}px)`;goal.innerHTML=`<span>목표 ${state.goal.toLocaleString()} kcal</span>`;chart.appendChild(goal);
 let counts={};state.meals.filter(m=>keys.includes(m.time?.slice(0,10))).flatMap(m=>m.foods||[]).forEach(f=>{let n=f.name||'음식';counts[n]=(counts[n]||0)+1});
 let top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);$('#topFoods').innerHTML=top.length?top.map(([n,c],i)=>`<div><span><b>${i+1}</b>${n}</span><em>${c}회</em></div>`).join(''):'<p class="muted">아직 충분한 식사 기록이 없어요.</p>';
}
function signedKg(v){return `${v>0?'+':''}${v.toFixed(1)} kg`}
function renderWeights(){
 let arr=[...(state.weights||[])].sort((a,b)=>a.date.localeCompare(b.date)),recent=arr.slice(-12),box=$('#weightChart');box.innerHTML='';
 let cur=arr.at(-1),first=arr[0],prev=arr.length>1?arr.at(-2):null;
 $('#currentWeight').textContent=cur?`${(+cur.value).toFixed(1)} kg`:'-';
 $('#fromFirstWeight').textContent=cur&&arr.length>1?signedKg(+cur.value-+first.value):'-';
 $('#fromPrevWeight').textContent=cur&&prev?signedKg(+cur.value-+prev.value):'-';
 $('#toGoalWeight').textContent=cur&&state.targetWeight?`${Math.abs(+cur.value-state.targetWeight).toFixed(1)} kg`:'-';
 [['#fromFirstWeight',cur&&arr.length>1?+cur.value-+first.value:null],['#fromPrevWeight',cur&&prev?+cur.value-+prev.value:null]].forEach(([s,v])=>{let e=$(s);e.classList.remove('up','down');if(v!==null)e.classList.add(v<=0?'down':'up')});
 let change=arr.length>1?(+arr.at(-1).value-+arr[0].value):0;$('#weightChange').textContent=arr.length>1?`첫 기록 대비 ${signedKg(change)}`:'';
 if(!recent.length)box.innerHTML='<p class="muted">첫 체중을 기록해보세요.</p>';
 else if(recent.length===1){
  let p=recent[0],goal=state.targetWeight?`<div class="singleGoal"><span>목표 체중</span><b>${(+state.targetWeight).toFixed(1)} kg</b></div>`:'';
  box.innerHTML=`<div class="singleWeight"><small>${p.date}</small><strong>${(+p.value).toFixed(1)} kg</strong><p>체중을 한 번 더 기록하면 변화 그래프가 시작돼요.</p>${goal}</div>`;
 } else{
  let vals=recent.map(x=>+x.value);if(state.targetWeight)vals.push(+state.targetWeight);let min=Math.min(...vals),max=Math.max(...vals);if(max-min<1){min-=.5;max+=.5}else{let pad=(max-min)*.18;min-=pad;max+=pad}
  const W=560,H=220,L=42,R=14,T=18,B=34,pw=W-L-R,ph=H-T-B,x=i=>L+(recent.length===1?pw/2:i*pw/(recent.length-1)),y=v=>T+(max-v)/(max-min)*ph;
  let grid='';for(let i=0;i<4;i++){let yy=T+i*ph/3,val=max-i*(max-min)/3;grid+=`<line class="gridLine" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="axisText" x="${L-6}" y="${yy+3}" text-anchor="end">${val.toFixed(1)}</text>`}
  let pts=recent.map((p,i)=>`${x(i)},${y(+p.value)}`).join(' '),area=recent.length>1?`<polygon class="trendArea" points="${L},${T+ph} ${pts} ${x(recent.length-1)},${T+ph}"/>`:'',goal='';
  if(state.targetWeight){let gy=y(+state.targetWeight);goal=`<line class="goalWeightLine" x1="${L}" y1="${gy}" x2="${W-R}" y2="${gy}"/><text class="goalText" x="${W-R}" y="${gy-5}" text-anchor="end">목표 ${(+state.targetWeight).toFixed(1)}kg</text>`}
  let dots=recent.map((p,i)=>`<circle class="point" cx="${x(i)}" cy="${y(+p.value)}" r="4"/><text class="axisText" x="${x(i)}" y="${H-10}" text-anchor="middle">${p.date.slice(5).replace('-','.')}</text><text class="axisText" x="${x(i)}" y="${y(+p.value)-9}" text-anchor="middle">${(+p.value).toFixed(1)}</text>`).join('');
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 체중 변화 그래프">${grid}${area}${goal}${recent.length>1?`<polyline class="trendLine" points="${pts}"/>`:''}${dots}</svg>`;
 }
 $('#weightList').innerHTML=arr.length?[...arr].reverse().map(x=>`<div><span>${x.date}</span><b>${(+x.value).toFixed(1)} kg</b><button data-date="${x.date}">×</button></div>`).join(''):'<p class="muted">저장된 체중이 없어요.</p>';
 $('#weightList').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.weights=state.weights.filter(x=>x.date!==b.dataset.date);save();renderWeights()});
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.appView').forEach(v=>v.hidden=true);$('#'+b.dataset.view+'View').hidden=false; if(b.dataset.view==='stats')renderStats(); if(b.dataset.view==='weight')renderWeights()});
document.querySelectorAll('.periodSwitch button').forEach(b=>b.onclick=()=>{statsDays=+b.dataset.days;document.querySelectorAll('.periodSwitch button').forEach(x=>x.classList.toggle('active',x===b));renderStats()});
$('#weightDate').value=localDateKey(new Date());
$('#saveWeight').onclick=()=>{let date=$('#weightDate').value,val=+$ ('#weightValue').value;if(!date||!val)return alert('날짜와 체중을 입력해주세요.');let ex=state.weights.find(x=>x.date===date);if(ex)ex.value=val;else state.weights.push({date,value:val});save();$('#weightValue').value='';renderWeights()};
$('#exportData').onclick=()=>{let blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MealLogAI-backup-${localDateKey(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#importData').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let data=JSON.parse(await f.text());if(!Array.isArray(data.meals))throw Error();if(confirm('현재 기록을 백업 파일의 내용으로 바꿀까요?')){state={goal:data.goal||1800,targetWeight:data.targetWeight||null,meals:data.meals||[],weights:data.weights||[],activity:data.activity||{},stepsGoal:data.stepsGoal||8000,waterGoal:data.waterGoal||2000};save();alert('백업을 불러왔어요.')}}catch{alert('올바른 MealLogAI 백업 파일이 아니에요.')}e.target.value=''};

if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');render();
