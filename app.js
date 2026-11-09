const $=s=>document.querySelector(s), mealsEl=$('#meals'); let photoData='', editingMealId=null,selectedMealType=null;
let state=JSON.parse(localStorage.getItem('meallog-state')||'{"goal":1200,"meals":[],"weights":[]}');
state.meals=state.meals||[]; state.weights=state.weights||[]; state.goal=state.goal||1200; state.targetWeight=state.targetWeight||null; state.activity=state.activity||{}; state.stepsGoal=state.stepsGoal||8000; state.waterGoal=state.waterGoal||2000;
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
 $('#totalCal').textContent=cal;$('#remainCal').textContent=Math.max(0,state.goal-cal);window.MealLogCalories.render(cal,state.goal);$('#carbs').textContent=Math.round(sum('carbs'));$('#protein').textContent=Math.round(sum('protein'));$('#fat').textContent=Math.round(sum('fat'));
 {const today=localDateKey(new Date());const mode=selectedDate===today?'today':selectedDate>today?'future':'past';$('#todayLabel').textContent=mode==='today'?'오늘의 식사 다이어리':mode==='future'?'예정 식사 다이어리':'지난 식사 다이어리';const title=document.querySelector('header h1');if(title)title.textContent=mode==='today'?'오늘 뭐 먹었지?':mode==='future'?'뭐 먹을까?':'그날 뭐 먹었지?';}
 $('#selectedDateLabel').textContent=dateText(selectedDate);$('#recordDateHint').textContent=selectedDate===localDateKey(new Date())?'':'';
 const listedDay=selectedMealType?day.filter(m=>selectedMealType==='기타'?!['아침','점심','저녁','간식'].includes(m.type):m.type===selectedMealType):[];
 $('#mealDetails').hidden=!selectedMealType;$('#mealDetailsTitle').textContent=selectedMealType?dateText(selectedDate)+' · '+selectedMealType+' 음식 목록':'';
 mealsEl.replaceChildren();
 if(selectedMealType&&!listedDay.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 '+selectedMealType+' 기록이 없어요. 카드의 ＋ 버튼으로 추가해 주세요.';mealsEl.append(empty);}
 listedDay.forEach(m=>{
  const card=document.createElement('article');card.className='meal';card.dataset.mealId=m.id;
  const photo=document.createElement('div');photo.className=m.photo?'mealPhoto':'mealNoPhoto';
  if(m.photo){const img=document.createElement('img');img.src=m.photo;img.alt=(m.type||'식사')+' 사진';photo.append(img);}else{const icon=document.createElement('span');icon.className='plateIcon';photo.append(icon);}
  const content=document.createElement('div'),title=document.createElement('h3'),foods=document.createElement('ul'),sum=document.createElement('b');foods.className='mealFoodList';
  title.textContent=(m.type||'기타')+' · '+new Date(m.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  for(const f of m.foods||[]){const line=document.createElement('li'),name=document.createElement('span'),detail=document.createElement('small');name.textContent=f.name||'음식';detail.textContent=(f.grams!=null?f.grams+(f.unit||f.barcodeProduct?.unit||'g')+' · ':'')+(MealLogQuality.unknown(f)?'영양정보 미입력':Math.round(Number(f.calories)||0)+' kcal');line.append(name,detail);foods.append(line);}
  sum.textContent=MealLogQuality.label(m.foods||[]);content.append(title,foods,sum);
  const actions=document.createElement('div');actions.className='mealActions';const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='수정';edit.setAttribute('aria-label',(m.type||'식사')+' '+m.time.slice(11,16)+' 기록 수정');edit.onclick=()=>openMealEditor(m);
  const remove=document.createElement('button');remove.type='button';remove.className='delete';remove.textContent='×';remove.setAttribute('aria-label',(m.type||'식사')+' '+m.time.slice(11,16)+' 기록 삭제');remove.onclick=()=>{if(confirm('이 기록을 삭제할까요?')){state.meals=state.meals.filter(x=>x.id!==m.id);save();}};
  actions.append(edit,remove);card.onclick=e=>{if(!e.target.closest('button'))openMealEditor(m);};card.append(photo,content,actions);mealsEl.append(card);
 });
 window.MealLogQualityUI?.nutritionNotice(day);document.querySelectorAll('#meals .empty').forEach(box=>box.prepend(MealLogIcons.peach()));window.MealLogStreak?.render(state);renderCalendar();renderActivity();window.MealLogHome?.render();window.MealLogExercise?.render();window.MealLogWeekly?.render();window.MealLogNutritionGoals?.render()
}
function activityFor(k){if(!state.activity[k])state.activity[k]={steps:0,water:0,waterHistory:[]};state.activity[k].waterHistory=state.activity[k].waterHistory||[];return state.activity[k]}
function renderActivity(){
 let a=activityFor(selectedDate),sg=state.stepsGoal||8000,wg=state.waterGoal||2000,sp=Math.min(100,Math.round((a.steps||0)/sg*100)),wp=Math.min(100,Math.round((a.water||0)/wg*100));
 $('#undoWater').disabled=!(a.waterHistoryV2&&a.waterHistory.length&&a.water>0);
 $('#stepsToday').textContent=(a.steps||0).toLocaleString();$('#waterToday').textContent=(a.water||0).toLocaleString();$('#stepsGoalText').textContent=sg.toLocaleString();$('#waterGoalText').textContent=wg.toLocaleString();
 $('#stepsPercent').textContent=`${sp}%`;$('#waterPercent').textContent=`${wp}%`;$('#stepsProgress').style.width=`${sp}%`;$('#waterProgress').style.width=`${wp}%`;$('#activityDateLabel').textContent=selectedDate===localDateKey(new Date())?'오늘':dateText(selectedDate);
}
function setSteps(){
 const dialog=$('#stepsDialog');dialog.dataset.date=selectedDate;$('#stepsDialogDate').textContent=dateText(selectedDate);$('#stepsInput').value=activityFor(selectedDate).steps||'';$('#stepsInputError').textContent='';dialog.showModal();$('#stepsInput').focus();
}
function addWater(ml){
 if(!Number.isInteger(ml)||ml<=0)return;
 if(window.mealRecordWater?.(selectedDate,ml)===false)return;
 const a=activityFor(selectedDate);if(!a.waterHistoryV2){a.waterHistory=[];a.waterHistoryV2=true;}
 a.waterHistory.push(ml);a.water=Math.max(0,Number(a.water)||0)+ml;save();renderActivity();
 $('#waterStatus').textContent=ml+'mL를 추가했어요.';
}
function undoWater(){
 const a=activityFor(selectedDate);if(!a.waterHistoryV2||!a.waterHistory.length)return;
 const last=Math.min(Number(a.waterHistory[a.waterHistory.length-1])||0,Number(a.water)||0);if(!last)return;
 if(window.mealRecordWater?.(selectedDate,-last)===false)return;
 a.waterHistory.pop();a.water=Math.max(0,a.water-last);save();renderActivity();$('#waterStatus').textContent=last+'mL 추가를 취소했어요.';
}

function changeDay(n){let d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+n);selectedDate=localDateKey(d);calendarMonth=new Date(d);render()}
$('#prevDay').onclick=()=>changeDay(-1);$('#nextDay').onclick=()=>changeDay(1);
$('#dateBtn').onclick=()=>{calendarMonth=new Date(selectedDate+"T12:00:00");$('#calendarPanel').hidden=!$('#calendarPanel').hidden;renderCalendar()};
$('#todayBtn').onclick=()=>{selectedDate=localDateKey(new Date());calendarMonth=new Date();$('#calendarPanel').hidden=true;render()};
$('#prevMonth').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar()};$('#nextMonth').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar()};
function renderCalendar(){let y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();$('#monthLabel').textContent=`${y}년 ${m+1}월`;let grid=$('#calendarGrid');grid.innerHTML='';let first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let mealDays=new Set(state.meals.filter(x=>x.time).map(x=>x.time.slice(0,10)));for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let k=localDateKey(d),b=document.createElement('button');b.type='button';b.className='day';b.textContent=d.getDate();if(d.getMonth()!=m)b.classList.add('other');if(k===selectedDate)b.classList.add('selected');if(k===localDateKey(new Date()))b.classList.add('today');if(mealDays.has(k))b.classList.add('hasMeal');b.onclick=()=>{selectedDate=k;calendarMonth=new Date(k+"T12:00:00");$('#calendarPanel').hidden=true;render()};grid.appendChild(b)}}
function norm(s){return(s||'').toLowerCase().replace(/\s/g,'')}function findFoods(q){if(!norm(q))return[];return MealLogFoodQuery.search(q,FOOD_DB).slice(0,20)}
function captureRecordNutrition(row){const amount=Number(row.querySelector('.grams').value),fields=['calories','carbs','protein','fat'];if(row.querySelector('.nutritionLater')?.checked||!(amount>0)||fields.some(k=>row.querySelector('.'+k).value===''||!Number.isFinite(Number(row.querySelector('.'+k).value))||Number(row.querySelector('.'+k).value)<0)){delete row.dataset.recordNutrition;return;}row.dataset.recordNutrition=JSON.stringify({amount,unit:readFoodUnit(row),...Object.fromEntries(fields.map(k=>[k,Number(row.querySelector('.'+k).value)]))});}
function calcRecordNutrition(row){let basis;try{basis=JSON.parse(row.dataset.recordNutrition||'null');}catch{return;}const amount=Number(row.querySelector('.grams').value);if(!basis||!(basis.amount>0)||!Number.isFinite(amount)||amount<0)return;const ratio=amount/basis.amount;for(const k of ['calories','carbs','protein','fat'])row.querySelector('.'+k).value=k==='calories'?String(Math.round(basis[k]*ratio)):(basis[k]*ratio).toFixed(1);const badge=row.querySelector('.dbBadge');badge.hidden=false;badge.textContent='저장된 '+basis.amount+basis.unit+' 영양정보 기준 · 양에 맞춰 재계산';}
function calcRow(row){const idx=+row.dataset.dbIndex;if(!Number.isInteger(idx)||!FOOD_DB[idx])return;const f=FOOD_DB[idx],g=Math.max(0,+row.querySelector('.grams').value||0),r=g/100;row.querySelector('.calories').value=Math.round(f.calories*r);row.querySelector('.carbs').value=(f.carbs*r).toFixed(1);row.querySelector('.protein').value=(f.protein*r).toFixed(1);row.querySelector('.fat').value=(f.fat*r).toFixed(1)}
function chooseFood(row,f){delete row.dataset.useSavedNutrition;delete row.dataset.recordNutrition;const later=row.querySelector('.nutritionLater');if(later){later.checked=false;row.querySelectorAll('.nutrition input').forEach(i=>i.disabled=false);}row.dataset.publicFoodSeq=Number(row.dataset.publicFoodSeq||0)+1;clearTimeout(publicFoodTimer);delete row.dataset.externalFood;const foodUnit=MealLogFoodCore.foodUnit(f);setFoodUnit(row,foodUnit);showFoodBarcode(row);const idx=FOOD_DB.indexOf(f);row.dataset.dbIndex=idx;row.querySelector('.name').value=f.name;const p=row.querySelector('.portion');p.innerHTML='';(f.portions||[['100'+foodUnit,100]]).forEach(([n,g])=>{let o=document.createElement('option');o.value=g;o.textContent=`${n} (${g}${foodUnit})`;p.appendChild(o)});p.hidden=false;row.querySelector('.dbBadge').hidden=false;row.querySelector('.grams').value=(f.portions?.[0]?.[1]||100);row.querySelector('.suggestions').hidden=true;calcRow(row)}
let publicFoodTimer=0,publicFoodSeq=0;
const BARCODE_CACHE_KEY='mealLogAI_barcode_products_v4';
const BARCODE_LINK_KEY='mealLogAI_barcode_official_links_v1';
const BARCODE_USER_KEY='mealLogAI_barcode_user_products_v1';
function barcodeUserProducts(){try{return JSON.parse(localStorage.getItem(BARCODE_USER_KEY)||'{}')}catch(_){return {}}}
function userBarcodeProduct(code){const p=barcodeUserProducts()[String(code||'').replace(/\D/g,'')];return p?.deleted?null:(p||null)}
function storeUserBarcodeProduct(f){const code=String(f?.code||'').replace(/\D/g,'');if(!code)return;const all=barcodeUserProducts();all[code]=canonicalProduct({...f,code,source:'user-verified'});localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(all));rememberBarcodeProduct(all[code])}

function barcodeLinks(){try{return JSON.parse(localStorage.getItem(BARCODE_LINK_KEY)||'{}')}catch(_){return{}}}
function linkedBarcodeProduct(code){
  const verified=userBarcodeProduct(code);if(verified)return canonicalProduct(verified);
  if(barcodeUserProducts()[String(code||'').replace(/\D/g,'')]?.deleted)return null;
  const x=barcodeLinks()[String(code||'')];
  return x?canonicalProduct(x):null;
}
function saveBarcodeOfficialLink(barcodeProduct,officialFood){
  const code=String(barcodeProduct?.code||'').replace(/\D/g,'');
  if(!code||officialFood?.source!=='mfds')return null;
  const bp=canonicalProduct(barcodeProduct), of=canonicalProduct(officialFood);
  // 실제 포장 용량/단위는 바코드 제품을 유지하고 영양 기준/값만 식약처에서 가져옵니다.
  const linked=canonicalProduct({
    ...of,
    code,
    name:bp.name||of.name,
    maker:of.maker||bp.maker,
    barcodeName:bp.barcodeName||bp.name,
    barcodeMaker:bp.barcodeMaker||bp.maker,
    quantity:bp.quantity,
    productAmount:bp.productAmount,
    displayAmount:bp.displayAmount,
    unit:bp.unit,
    nutritionBase:of.nutritionBase,
    nutritionUnit:of.nutritionUnit,
    calories:of.calories,
    carbs:of.carbs,
    protein:of.protein,
    fat:of.fat,
    source:'mfds+linked',
    matchedOfficial:true,
    matchConfidence:'user-linked'
  });
  const all=barcodeLinks();all[code]=linked;
  localStorage.setItem(BARCODE_LINK_KEY,JSON.stringify(all));
  rememberBarcodeProduct(linked);
  return linked;
}

function barcodeCache(){try{return JSON.parse(localStorage.getItem(BARCODE_CACHE_KEY)||'[]')}catch(_){return[]}}
function canonicalProduct(f={}){if(f.nutritionStatus==='unknown')return {...f,code:String(f.code||f.barcode||''),unit:publicUnit(f),productAmount:Number(f.displayAmount)||100,displayAmount:Number(f.displayAmount)||100,nutritionBase:Number(f.nutritionBase)||100,calories:null,carbs:null,protein:null,fat:null};const unit=publicUnit(f),amount=Math.max(1,num(f.productAmount)||num(f.displayAmount)||num(f.foodSize)||num(f.weight)||100),base=Math.max(0.000001,num(f.nutritionBase)||num(f.weight)||100);return {...f,code:String(f.code||f.barcode||''),name:cleanPublicText(f.name)||'제품',maker:cleanMaker(f.maker),unit,productAmount:amount,displayAmount:amount,nutritionBase:base,nutritionUnit:f.nutritionUnit||unit,calories:num(f.calories),carbs:num(f.carbs),protein:num(f.protein),fat:num(f.fat)}}
function rememberBarcodeProduct(f){f=canonicalProduct(f);if(!f?.name)return;let a=barcodeCache(),i=a.findIndex(x=>f.code?String(x.code||x.barcode||'')===f.code:!x.code&&norm(x.name)===norm(f.name));if(i>=0)f={...a[i],...f};a=a.filter((x,j)=>j!==i);a.unshift(f);localStorage.setItem(BARCODE_CACHE_KEY,JSON.stringify(a.slice(0,80)))}
function previousBarcodeProduct(code){
 if(barcodeUserProducts()[code]?.deleted)return null;
 const f=barcodeCache().find(x=>String(x.code||x.barcode||'').replace(/\D/g,'')===code&&x.name&&x.nutritionComplete!==false&&['calories','carbs','protein','fat'].every(k=>x[k]!=null&&x[k]!==''&&Number.isFinite(Number(x[k]))));
 return f?canonicalProduct({...f,source:'cached',cachedSource:f.source,matchedOfficial:false}):null;
}

function cachedBarcodeFoods(q){if(!norm(q))return[];return MealLogFoodQuery.search(q,barcodeCache()).slice(0,8)}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function cleanPublicText(v){return String(v||'').replace(/^\s*[?？·•|]+\s*/,'').replace(/\s+/g,' ').trim()}
function cleanMaker(v){let parts=cleanPublicText(v).split(/[,/·|]+/).map(x=>x.trim()).filter(Boolean),out=[];for(const x of parts){if(!out.some(y=>norm(y)===norm(x)))out.push(x)}return out.slice(0,2).join(' · ')}
function publicUnit(f){if(f.source==='recipe-reference'&&f.unit==='인분')return '인분';if((f.unitCorrected||f.source==='user-verified')&&['g','mL','kg','인분'].includes(f.unit))return f.unit;const t=`${f.unit||''} ${f.foodSize||''} ${f.quantity||''} ${f.basis||''}`.toLowerCase();if(/ml|㎖|밀리리터/.test(t))return 'mL';if(/kg|킬로그램/.test(t))return 'kg';return 'g'}

function readFoodUnit(row){return ['g','mL','kg','인분'].includes(row.querySelector('.amountUnit')?.value)?row.querySelector('.amountUnit').value:'g'}
function setFoodUnit(row,unit){const input=row.querySelector('.amountUnit');if(!input)return;const serving=input.querySelector('option[value="인분"]');if(unit==='인분'&&!serving){const option=document.createElement('option');option.value='인분';option.textContent='인분';input.append(option);}else if(unit!=='인분'&&serving)serving.remove();input.value=['g','mL','kg','인분'].includes(unit)?unit:'g'}
function correctFoodUnit(row){
 const unit=readFoodUnit(row);let previous={};try{previous=JSON.parse(row.dataset.externalFood||'{}')}catch(_){}
 const amount=Math.max(0,Number(row.querySelector('.grams').value)||0),base=amount>0?amount:100;
 const food={...previous,name:row.querySelector('.name').value,unit,nutritionUnit:unit,nutritionBase:base,weight:base,displayAmount:base,productAmount:base,unitCorrected:true,source:previous.source||'record'};
 for(const field of ['calories','carbs','protein','fat'])food[field]=Math.max(0,Number(row.querySelector('.'+field).value)||0);
 row.dataset.externalFood=JSON.stringify(food);delete row.dataset.dbIndex;row.querySelector('.portion').hidden=true;
 const badge=row.querySelector('.dbBadge');badge.hidden=false;badge.textContent='단위 수정 · '+amount+unit+' 입력 · 영양 '+base+unit+' 기준';
 row.querySelector('.grams').title='섭취량: '+amount+unit+' · 영양 기준: '+base+unit;
 if(row.dataset.useSavedNutrition==='true')captureRecordNutrition(row);$('#status').textContent='단위를 바꿨어요. 양과 영양정보는 그대로예요. 포장지와 비교한 뒤 저장해 주세요.';
}

function calcExternalRow(row){let f;try{f=JSON.parse(row.dataset.externalFood||'null')}catch(_){f=null}if(!f)return;if(f.nutritionStatus==='unknown'){const later=row.querySelector('.nutritionLater');if(later){later.checked=true;row.querySelectorAll('.nutrition input').forEach(i=>{i.value='';i.disabled=true;});}return;}const amount=Math.max(0,num(row.querySelector('.grams').value)),base=Math.max(1,num(f.nutritionBase)||num(f.weight)||100),r=amount/base;const amountField=row.querySelector('.grams');amountField.title=`섭취량: ${amount}${f.unit||'g'} · 영양 기준: ${base}${f.nutritionUnit||f.unit||'g'}`;const badge=row.querySelector('.dbBadge');badge.textContent=badge.textContent.replace(/\d+(?:\.\d+)?(?:mL|kg|g|인분) 입력/,`${amount}${f.unit||'g'} 입력`);row.querySelector('.calories').value=Math.round(num(f.calories)*r);row.querySelector('.carbs').value=(num(f.carbs)*r).toFixed(1);row.querySelector('.protein').value=(num(f.protein)*r).toFixed(1);row.querySelector('.fat').value=(num(f.fat)*r).toFixed(1)}
function showFoodBarcode(row,food){const label=row.querySelector('.barcodeNumber');if(!label)return;const code=String(food?.code||food?.barcode||'').replace(/\D/g,'');label.textContent=code?'바코드 '+code:'';label.hidden=!code;}
function chooseExternalFood(row,f){delete row.dataset.useSavedNutrition;delete row.dataset.recordNutrition;const later=row.querySelector('.nutritionLater');if(later){later.checked=false;row.querySelectorAll('.nutrition input').forEach(i=>i.disabled=false);}row.dataset.publicFoodSeq=Number(row.dataset.publicFoodSeq||0)+1;clearTimeout(publicFoodTimer);delete row.dataset.dbIndex;f=canonicalProduct(f);if(currentBarcodeProduct&&f.source==='mfds'&&currentBarcodeProduct.code){const linked=saveBarcodeOfficialLink(currentBarcodeProduct,f);if(linked){f=linked;currentBarcodeProduct=null}}const name=f.name,maker=f.maker;row.querySelector('.name').value=name+(maker?` · ${maker}`:'');const unitName=f.unit,amount=f.displayAmount,base=f.nutritionBase,nutUnit=f.nutritionUnit||unitName;row.dataset.externalFood=JSON.stringify(f);showFoodBarcode(row,f);row.querySelector('.grams').value=amount;row.querySelector('.grams').title=`섭취량: ${amount}${unitName} · 영양 기준: ${base}${nutUnit}`;const unit=row.querySelector('.amountUnit');setFoodUnit(row,unitName);calcExternalRow(row);row.querySelector('.portion').hidden=true;const badge=row.querySelector('.dbBadge');badge.hidden=false;const src=f.source==='official-product-label'?'공식 판매페이지 표시':f.source==='recipe-reference'?'레시피 참고':f.source==='mfds-snapshot'?'식약처 공개 음식':f.source==='mfds'?'식약처 DB':f.source==='mfds+linked'?'식약처 DB · 바코드 연결':f.source==='mfds+off'?'식약처+바코드 DB':f.source==='user-verified'?'내가 확인한 제품':f.source==='cached'?'이전 조회 정보':'제품 DB';badge.textContent=`${src} · ${amount}${unitName} 입력 · 영양 ${base}${nutUnit} 기준`;if(f.source==='recipe-reference')$('#status').textContent='레시피의 1인분 참고값이에요. 조리법과 먹은 양에 맞게 수정해 주세요.';row.querySelector('.suggestions').hidden=true;window.MealLogBarcodeEntry?.portions(row,f);}
// v6.9.3 replacement block: replace appendPublicSuggestions + showSuggestions in app.js
async function appendPublicSuggestions(row,q,seq,page=1,seen=new Set()){
  const box=row.querySelector('.suggestions');
  try{
    const r=await fetch('/api/food-search?q='+encodeURIComponent(q)+'&page='+page,{cache:'no-store'});
    if(!r.ok)throw Error('SEARCH_HTTP');
    const d=await r.json();
    if(seq!==Number(row.dataset.publicFoodSeq||0)||!document.body.contains(row))return;
    box.querySelectorAll('.publicLoading,.publicMore').forEach(x=>x.remove());
    const items=(d.items||[]).filter(f=>{const key=MealLogFoodQuery.key(f);if(seen.has(key))return false;seen.add(key);return true;});
    let offset=0;
    function more(){
      box.querySelector('.publicMore')?.remove();
      items.slice(offset,offset+12).forEach(f=>{
        const b=document.createElement('button');b.type='button';b.className='suggestion remoteSuggestion';
        const text=document.createElement('span');text.className='suggestionText';
        const title=document.createElement('b');title.textContent=cleanPublicText(f.name);
        const detail=document.createElement('small');
        detail.textContent=(cleanMaker(f.maker)?cleanMaker(f.maker)+' · ':'')+MealLogQuality.candidateDetails(f);
        text.append(title,detail);const plus=document.createElement('span');plus.className='suggestionPlus';plus.textContent='+';b.append(text,plus);
        b.onclick=()=>chooseExternalFood(row,f);box.appendChild(b);
      });
      offset+=12;
      if(offset<items.length||d.nextPage){
        const b=document.createElement('button');b.type='button';b.className='suggestion publicMore';b.textContent='검색 결과 더 보기';
        b.onclick=e=>{e.stopPropagation();if(offset<items.length)more();else{b.disabled=true;b.textContent='더 찾고 있어요…';appendPublicSuggestions(row,q,seq,d.nextPage,seen);}};box.appendChild(b);
      }
      box.hidden=!box.children.length;
    }
    more();
    if(!box.children.length){const empty=document.createElement('div');empty.className='suggestion';empty.textContent='찾는 제품이 없으면 바코드를 스캔하거나 직접 입력해 주세요.';box.appendChild(empty);box.hidden=false;}
    const st=$('#publicDbState');if(st)st.textContent=d.errors?.length?'일부 제품 DB 연결 지연':'식품·제품 DB 연결됨';
  }catch(_){
    if(seq!==Number(row.dataset.publicFoodSeq||0))return;
    box.querySelectorAll('.publicLoading,.publicMore').forEach(x=>x.remove());box.hidden=!box.children.length;
    const st=$('#publicDbState');if(st)st.textContent='제품 DB 연결 확인 필요';
  }
}

function rootKoreanFoods(q){return globalThis.MealLogKoreanFoods?.search(q)||[]}
function suggestionButton(name,detail,onChoose){const button=document.createElement('button');button.type='button';button.className='suggestion';const text=document.createElement('span');text.className='suggestionText';const title=document.createElement('b'),description=document.createElement('small'),plus=document.createElement('span');title.textContent=String(name??'');description.textContent=String(detail??'');plus.className='suggestionPlus';plus.textContent='+';text.append(title,description);button.append(text,plus);button.onclick=onChoose;return button;}
function showSuggestions(row,q){
  const box=row.querySelector('.suggestions'),ms=findFoods(q);box.innerHTML='';
  clearTimeout(publicFoodTimer);row.dataset.publicFoodSeq=Number(row.dataset.publicFoodSeq||0)+1;
  if(!q){box.hidden=true;return}
  ms.forEach(f=>box.append(suggestionButton(f.name,'앱 기본DB · 100'+MealLogFoodCore.foodUnit(f)+' 기준 '+f.calories+' kcal · 탄 '+f.carbs+'g · 단 '+f.protein+'g · 지 '+f.fat+'g',()=>chooseFood(row,f))));

  const korean=rootKoreanFoods(q),koreanMore=document.createElement('button');let koreanOffset=0;
  function appendKorean(){koreanMore.remove();korean.slice(koreanOffset,koreanOffset+12).forEach(f=>{
    const b=document.createElement('button');b.type='button';b.className='suggestion';const text=document.createElement('span');text.className='suggestionText';const title=document.createElement('b'),detail=document.createElement('small');title.textContent=f.name+(f.maker?' · '+f.maker:'');detail.textContent=MealLogQuality.candidateDetails(f);text.append(title,detail);const plus=document.createElement('span');plus.className='suggestionPlus';plus.textContent='+';b.append(text,plus);b.onclick=()=>chooseExternalFood(row,f);box.append(b);
  });koreanOffset+=12;if(koreanOffset<korean.length){koreanMore.type='button';koreanMore.className='suggestion koreanMore';koreanMore.textContent='음식 더 보기 ('+korean.length+'개)';koreanMore.onclick=e=>{e.stopPropagation();appendKorean()};box.append(koreanMore);}}
  appendKorean();

  cachedBarcodeFoods(q).forEach(f=>box.append(suggestionButton(cleanPublicText(f.name),'최근 바코드 제품'+(cleanMaker(f.maker)?' · '+cleanMaker(f.maker):'')+' · '+Math.round(num(f.calories))+' kcal',()=>chooseExternalFood(row,f))));
  box.hidden=!box.children.length;
  if(norm(q).length>=2){
    clearTimeout(publicFoodTimer);
    const seq=Number(row.dataset.publicFoodSeq||0)+1;row.dataset.publicFoodSeq=seq;const seen=new Set([...ms,...korean,...cachedBarcodeFoods(q)].map(MealLogFoodQuery.key));
    let loading=document.createElement('div');loading.className='suggestion publicLoading';loading.innerHTML='<span class="suggestionText"><b>공식 영양정보 검색 중…</b><small>식약처 공공데이터에서 확인하고 있어요.</small></span>';box.appendChild(loading);box.hidden=false;
    publicFoodTimer=setTimeout(()=>appendPublicSuggestions(row,q,seq,1,seen),300);
  }
}

function addFood(f={}){f={...f,name:String(f.name||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};let d=document.createElement('div');d.className='foodRow';d.dataset.nutritionStatus=f.nutritionStatus||'complete';d.innerHTML=`<button type="button" class="removeFood">×</button><div class="foodTop"><div class="foodNameWrap"><input class="name" placeholder="무엇을 드셨나요?" autocomplete="off" value="${f.name||''}"><div class="suggestions" hidden></div></div><div class="amountInput"><input class="grams" type="number" min="0" step="any" placeholder="100" value="${f.grams||''}"><select class="amountUnit" aria-label="섭취량 단위"><option value="g">g</option><option value="mL">mL</option><option value="kg">kg</option></select></div></div><div class="barcodeNumber" hidden></div><div class="portionBar"><select class="portion" hidden></select><span class="dbBadge" hidden>영양 자동 계산</span></div><div class="nutrition"><label class="nutriField"><span>칼로리</span><div><input class="calories" type="number" min="0" step="any" placeholder="0" value="${f.calories??''}"><em>kcal</em></div></label><label class="nutriField"><span>탄수화물</span><div><input class="carbs" type="number" min="0" step="any" placeholder="0.0" value="${f.carbs??''}"><em>g</em></div></label><label class="nutriField"><span>단백질</span><div><input class="protein" type="number" min="0" step="any" placeholder="0.0" value="${f.protein??''}"><em>g</em></div></label><label class="nutriField"><span>지방</span><div><input class="fat" type="number" min="0" step="any" placeholder="0.0" value="${f.fat??''}"><em>g</em></div></label></div>`;$('#foods').appendChild(d);let name=d.querySelector('.name'),g=d.querySelector('.grams'),p=d.querySelector('.portion');name.oninput=()=>{delete d.dataset.useSavedNutrition;delete d.dataset.recordNutrition;delete d.dataset.dbIndex;delete d.dataset.externalFood;showFoodBarcode(d);p.hidden=true;d.querySelector('.dbBadge').hidden=true;showSuggestions(d,name.value)};name.onfocus=()=>showSuggestions(d,name.value);d.querySelector('.amountUnit').onchange=()=>correctFoodUnit(d);g.oninput=()=>{if(d.querySelector('.nutritionLater')?.checked)return;if(d.dataset.useSavedNutrition==='true')calcRecordNutrition(d);else if(d.dataset.externalFood)calcExternalRow(d);else calcRow(d);};g.onchange=g.oninput;for(const k of ['calories','carbs','protein','fat'])d.querySelector('.'+k).addEventListener('input',()=>{d.dataset.useSavedNutrition='true';captureRecordNutrition(d);});if(Number(f.grams)>0&&f.nutritionStatus!=='unknown'&&['calories','carbs','protein','fat'].every(k=>f[k]!=null&&f[k]!==''&&Number.isFinite(Number(f[k])))){d.dataset.useSavedNutrition='true';}p.onchange=()=>{g.value=p.value;calcRow(d)};d.querySelector('.removeFood').onclick=()=>document.querySelectorAll('.foodRow').length>1?d.remove():null;if(f.barcodeProduct){showFoodBarcode(d,f.barcodeProduct);d.dataset.externalFood=JSON.stringify(f.barcodeProduct);const unit=d.querySelector('.amountUnit');setFoodUnit(d,f.barcodeProduct.unit||'g');const badge=d.querySelector('.dbBadge');badge.hidden=false;badge.textContent=f.barcodeProduct.source==='record'?'이전 기록 · 저장된 영양정보':'바코드 제품 · 저장된 영양정보';}if(f.unit)setFoodUnit(d,f.unit);if(f.name){let ex=FOOD_DB.find(x=>norm(x.name)===norm(f.name));if(ex&&f.calories==null&&!f.barcodeProduct&&f.nutritionStatus!=='unknown')chooseFood(d,ex)}if(d.dataset.useSavedNutrition==='true')captureRecordNutrition(d);window.MealLogBarcodeEntry?.portions(d,f.barcodeProduct);}
document.addEventListener('click',e=>{if(!e.target.closest('.foodNameWrap'))document.querySelectorAll('.suggestions').forEach(x=>x.hidden=true)});
let photoPreviewUrl='',photoLoadVersion=0,photoLoading=false,photoRotationBase='',photoRotationTurns=0;
function cancelPhotoLoad(){photoLoadVersion++;photoLoading=false;photoRotationBase='';photoRotationTurns=0;$('#saveTop').disabled=false;photoRotationControls();}
function photoRotationControls(){for(const id of ['#rotatePhotoLeft','#rotatePhotoRight']){const b=$(id);if(b){b.hidden=!photoData;b.disabled=photoLoading||!photoData;}}}
async function rotateMealPhoto(direction){
 if(photoLoading||!photoData)return;
 const version=++photoLoadVersion,base=photoRotationBase||photoData,next=(photoRotationTurns+direction+4)%4;
 photoLoading=true;$('#saveTop').disabled=true;$('#analyzeBtn').disabled=true;photoRotationControls();$('#status').textContent='사진을 회전하고 있어요…';
 try{const result=await MealLogPhoto.rotate(await MealLogPhotoStorage.resolve(base),next);if(version!==photoLoadVersion)return;photoRotationBase=base;photoRotationTurns=next;photoData=result;clearPreviewUrl();setPhotoUI();$('#status').textContent='사진을 회전했어요. 저장하면 이 방향으로 남아요.';}
 catch(error){if(version===photoLoadVersion){setPhotoUI();$('#status').textContent='사진을 회전하지 못했어요. 원래 사진은 유지했으니 다시 시도하거나 사진을 새로 선택해 주세요.';}}
 finally{if(version===photoLoadVersion){photoLoading=false;$('#saveTop').disabled=false;$('#analyzeBtn').disabled=!photoData;photoRotationControls();}}
}
function setPhotoUI(previewSrc=''){
  const img=$('#preview'), text=$('#photoText');
  const src=previewSrc||photoData||'';
  const has=!!src;
  img.hidden=!has;
  img.style.display=has?'block':'none';
  text.hidden=has;
  text.style.display=has?'none':'';
  $('#removePhoto').hidden=!has;photoRotationControls();
  $('#analyzeBtn').disabled=!photoData;
  if(has) img.src=src; else img.removeAttribute('src');
}
function clearPreviewUrl(){ if(photoPreviewUrl){try{URL.revokeObjectURL(photoPreviewUrl)}catch(_){ } photoPreviewUrl='';} }
function showMealModal(){const d=$('#mealDialog');d.hidden=false;d.classList.add('isOpen');document.documentElement.classList.add('mealModalOpen');document.body.classList.add('mealModalOpen');setTimeout(()=>{if(!d.contains(document.activeElement))$('#cancelBtn')?.focus({preventScroll:true});},0)}
function hideMealModal(){cancelPhotoLoad();const d=$('#mealDialog');d.classList.remove('isOpen');d.hidden=true;document.documentElement.classList.remove('mealModalOpen');document.body.classList.remove('mealModalOpen')}
function updateMealSearchPlaceholder(){const text='무엇을 드셨나요?';document.querySelectorAll('#foods .foodRow .name').forEach(i=>{if(!i.value)i.placeholder=text})}

let repeatFoodMode='recent';
function renderRepeatFoods(){
 const box=$('#repeatFoods');if(!box)return;box.replaceChildren();
 const choices=MealLogRepeat.ranked(state.meals,'food',repeatFoodMode);
 for(const mode of ['recent','frequent'])$('#repeatFood'+(mode==='recent'?'Recent':'Frequent')).setAttribute('aria-pressed',String(mode===repeatFoodMode));
 if(!choices.length){const p=document.createElement('p');p.className='muted';p.textContent='음식을 기록하면 여기에 모아 드려요.';box.append(p);return;}
 for(const item of choices){const b=document.createElement('button');b.type='button';b.className='repeatChoice';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=item.value.name;detail.textContent=(Number(item.value.grams)||0)+(item.value.unit||item.value.barcodeProduct?.unit||'g')+' · '+Math.round(Number(item.value.calories)||0)+' kcal'+(repeatFoodMode==='frequent'?' · '+item.count+'번 기록':'');b.append(title,detail);b.onclick=()=>{
  const f=structuredClone(item.value);let row=[...document.querySelectorAll('#foods .foodRow')].find(r=>!r.querySelector('.name').value.trim()&&['grams','calories','carbs','protein','fat'].every(k=>!Number(r.querySelector('.'+k).value)));
  if(!row){addFood();row=document.querySelector('#foods .foodRow:last-child');}
  delete row.dataset.dbIndex;delete row.dataset.externalFood;row.querySelector('.portion').hidden=true;
  for(const k of ['name','grams','calories','carbs','protein','fat'])row.querySelector('.'+k).value=f[k]??'';
  const unit=f.unit||f.barcodeProduct?.unit||'g',amount=Number(f.grams)||0;setFoodUnit(row,unit);
  if(amount>0)row.dataset.externalFood=JSON.stringify({...f.barcodeProduct,source:f.barcodeProduct?.source||'record',name:f.name,unit,nutritionUnit:unit,nutritionBase:amount,weight:amount,calories:Number(f.calories)||0,carbs:Number(f.carbs)||0,protein:Number(f.protein)||0,fat:Number(f.fat)||0});
  row.querySelector('.suggestions').hidden=true;if(amount<=0)row.dataset.dbIndex='-1';showFoodBarcode(row,f.barcodeProduct);const badge=row.querySelector('.dbBadge');badge.hidden=false;badge.textContent='이전 기록 · '+amount+unit+' 입력';
  $('#status').textContent='이전 음식을 불러왔어요. 양을 확인한 뒤 저장해 주세요.';updateMealSearchPlaceholder();
 };box.append(b);}
}
$('#repeatFoodRecent').onclick=()=>{repeatFoodMode='recent';renderRepeatFoods()};
$('#repeatFoodFrequent').onclick=()=>{repeatFoodMode='frequent';renderRepeatFoods()};

function openNewMeal(){cancelPhotoLoad();editingMealId=null;photoData='';$('#dialogTitle').textContent='음식 기록';$('#saveTop').textContent='저장';$('#photo').value='';$('#mealType').value='아침';$('#mealTime').value=defaultTimeForDate(selectedDate);$('#foods').innerHTML='';addFood();updateMealSearchPlaceholder();$('#memo').value='';$('#status').textContent='';setPhotoUI();renderRepeatFoods();showMealModal()}
function openMealEditor(m){cancelPhotoLoad();editingMealId=m.id;photoData=m.photo||'';$('#dialogTitle').textContent='식사 기록 수정';$('#saveTop').textContent='수정 저장';$('#photo').value='';$('#mealType').value=m.type||'아침';$('#mealTime').value=m.time||defaultTimeForDate(selectedDate);$('#foods').innerHTML='';(m.foods&&m.foods.length?m.foods:[{}]).forEach(addFood);$('#memo').value=m.memo||'';updateMealSearchPlaceholder();$('#status').textContent='사진과 식사 내용을 수정할 수 있어요.';setPhotoUI();renderRepeatFoods();showMealModal()}
$('#closeMealDetails').onclick=()=>{selectedMealType=null;render();};
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
// v6.6: entry mode buttons are optional. Older layouts do not contain these elements.
// Never stop the rest of app.js when they are absent, because cancel/photo/save handlers are below.
const modeSearchBtn=$('#modeSearch'), modePhotoBtn=$('#modePhoto'), modeAIBtn=$('#modeAI');
if(modeSearchBtn) modeSearchBtn.onclick=()=>setEntryMode('search');
if(modePhotoBtn) modePhotoBtn.onclick=()=>setEntryMode('photo');
if(modeAIBtn) modeAIBtn.onclick=()=>setEntryMode('ai');
let barcodeLookupVersion=0,barcodeStream=null,barcodeLoop=0,currentBarcodeProduct=null,barcodeReader=null,barcodeDetected=false;
function stopBarcodeCamera(){barcodeLoop++;if(barcodeReader){try{barcodeReader.reset()}catch(_){}barcodeReader=null}if(barcodeStream){barcodeStream.getTracks().forEach(t=>t.stop());barcodeStream=null}const v=$('#barcodeVideo');if(v){v.pause();v.srcObject=null;v.hidden=true}}
function closeBarcode(){window.MealLogBarcodeEntry?.hide();barcodeLookupVersion++;stopBarcodeCamera();$('#barcodePanel').hidden=true}
async function autoLinkBarcodeFood(product){try{const raw=cleanPublicText(product?.name||'');const q=raw.replace(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|l)\b/ig,'').trim();if(!q)return null;const r=await fetch(`/api/food-search?q=${encodeURIComponent(q)}&t=${Date.now()}`,{cache:'no-store'});const d=await r.json();const key=s=>norm(cleanPublicText(s)).replace(/[^a-z0-9가-힣]/g,'').replace(/\d+(?:ml|g|kg|l)$/i,'');const target=key(q);const matches=(d.items||[]).filter(x=>x.source==='mfds').map(x=>({x,k:key(x.name)})).filter(v=>v.k&&(v.k===target||target.includes(v.k)||v.k.includes(target))).sort((a,b)=>Math.abs(a.k.length-target.length)-Math.abs(b.k.length-target.length));return matches[0]?.x||null}catch(_){return null}}
async function lookupBarcode(code){
 code=String(code||'').replace(/\D/g,'');
 if(!/^(?:\d{8}|\d{12,14})$/.test(code)){$('#barcodeStatus').textContent='바코드 번호를 확인해 주세요. 8·12·13·14자리 번호를 입력할 수 있어요.';return;}
 const ticket=++barcodeLookupVersion;window.MealLogBarcodeEntry?.hide();
 let row=document.querySelector('#foods .foodRow:last-child');if(!row){addFood();row=document.querySelector('#foods .foodRow:last-child');}
 $('#barcodeStatus').textContent='제품을 찾는 중이에요…';
 function restorePrevious(){
  if(ticket!==barcodeLookupVersion||!document.body.contains(row))return false;
  const previous=previousBarcodeProduct(code);if(!previous)return false;
  currentBarcodeProduct=previous;chooseExternalFood(row,previous);
  $('#barcodeStatus').textContent='이 기기에서 이전에 조회한 정보를 불러왔어요. 포장지의 제품명과 영양정보를 확인해 주세요.';
  setTimeout(()=>{if(ticket===barcodeLookupVersion)closeBarcode();},1200);return true;
 }
 try{
  const saved=linkedBarcodeProduct(code);
  let d=saved;
  if(!saved){const r=await fetch('/api/barcode?code='+encodeURIComponent(code),{cache:'no-store'});d=await r.json();if(!r.ok){if(restorePrevious())return;if(r.status===404&&ticket===barcodeLookupVersion)window.MealLogBarcodeEntry?.offer({code,row,valid:()=>ticket===barcodeLookupVersion&&document.body.contains(row)});if(ticket===barcodeLookupVersion)$('#barcodeStatus').textContent=r.status===404?'등록된 제품이 없어요. 음식명으로 검색하거나 직접 입력해 주세요.':'제품 조회에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';return;}}
  if(ticket!==barcodeLookupVersion||!document.body.contains(row))return;
  if(!d||d.found===false){window.MealLogBarcodeEntry?.offer({code,row,valid:()=>ticket===barcodeLookupVersion&&document.body.contains(row)});$('#barcodeStatus').textContent='등록된 제품이 없어요. 음식명으로 검색하거나 직접 입력해 주세요.';return;}
  if(d.nutritionComplete===false){if(restorePrevious())return;window.MealLogBarcodeEntry?.offer({code,row,product:d,valid:()=>ticket===barcodeLookupVersion&&document.body.contains(row)});currentBarcodeProduct=null;$('#barcodeStatus').textContent=(d.name||'제품')+'의 영양정보가 부족해요. 음식명으로 검색하거나 포장지의 값을 직접 입력해 주세요.';return;}
  const product=canonicalProduct({...d,code});currentBarcodeProduct=d.matchedOfficial||saved?null:product;
  rememberBarcodeProduct(product);chooseExternalFood(row,product);
  $('#barcodeStatus').textContent=(product.name||'제품')+'을 불러왔어요. 포장 용량과 영양정보를 확인해 주세요.';
  setTimeout(()=>{if(ticket===barcodeLookupVersion)closeBarcode();},700);
 }catch{if(restorePrevious())return;if(ticket===barcodeLookupVersion){currentBarcodeProduct=null;$('#barcodeStatus').textContent='제품 조회에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';}}
}

function loadBarcodeScannerLibrary(){
  if(window.ZXing?.BrowserMultiFormatReader)return Promise.resolve();
  if(window.mealBarcodeLibraryPromise)return window.mealBarcodeLibraryPromise;
  window.mealBarcodeLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    script.onload=()=>window.ZXing?.BrowserMultiFormatReader?resolve():reject(new Error('스캐너 라이브러리 로드 실패'));
    script.onerror=()=>reject(new Error('스캐너 라이브러리를 불러오지 못했어요'));
    document.head.appendChild(script);
  }).catch(e=>{window.mealBarcodeLibraryPromise=null;throw e});
  return window.mealBarcodeLibraryPromise;
}
async function barcodeScanned(raw){
  const code=String(raw||'').replace(/\D/g,'');
  if(barcodeDetected||code.length<8)return;
  barcodeDetected=true;
  $('#barcodeInput').value=code;
  $('#barcodeStatus').textContent='바코드 '+code+' 인식 완료! 제품을 찾고 있어요…';
  stopBarcodeCamera();
  await lookupBarcode(code);
}
async function openBarcode(){
  barcodeLookupVersion++;window.MealLogBarcodeEntry?.hide();
  const p=$('#barcodePanel');p.hidden=false;
  barcodeDetected=false;
  stopBarcodeCamera();
  const ticket=barcodeLoop;
  $('#barcodeStatus').textContent='카메라를 준비하고 있어요…';
  const v=$('#barcodeVideo');
  v.hidden=false;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('카메라를 사용할 수 없는 환경이에요');
    // iPhone Safari and older browsers: ZXing camera scanner fallback.
    // The native BarcodeDetector is used first where supported.
    if('BarcodeDetector' in window){
      try{
        const formats=await BarcodeDetector.getSupportedFormats();
        if(formats.includes('ean_13')||formats.includes('ean_8')){
          const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e'].filter(f=>formats.includes(f))});
          barcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
          if(ticket!==barcodeLoop){stopBarcodeCamera();return}
          v.srcObject=barcodeStream;await v.play();
          $('#barcodeStatus').textContent='제품 바코드를 카메라 가운데에 맞춰주세요.';
          const my=barcodeLoop;
          const scan=async()=>{if(my!==barcodeLoop||barcodeDetected)return;try{
            const codes=await detector.detect(v);
            if(codes[0]?.rawValue){await barcodeScanned(codes[0].rawValue);return}
          }catch(_){}if(my===barcodeLoop)requestAnimationFrame(scan)};
          scan();return;
        }
      }catch(e){console.warn('기본 바코드 스캐너 실패, 대체 스캐너 사용:',e);stopBarcodeCamera()}
    }
    await loadBarcodeScannerLibrary();
    if(!p.isConnected||p.hidden)return;
    barcodeReader=new window.ZXing.BrowserMultiFormatReader();
    $('#barcodeStatus').textContent='제품 바코드를 카메라 가운데에 맞춰주세요.';
    await barcodeReader.decodeFromVideoDevice(null,v,(result,error)=>{
      if(result&&!barcodeDetected)barcodeScanned(result.getText());
    });
  }catch(e){
    console.error('바코드 카메라 오류:',e);
    stopBarcodeCamera();
    v.hidden=true;
    $('#barcodeStatus').textContent='카메라 스캔을 시작하지 못했어요. Safari 카메라 권한과 인터넷 연결을 확인하거나 번호를 직접 입력해주세요.';
  }
}
$('#barcodeBtn').onclick=openBarcode;$('#barcodeClose').onclick=closeBarcode;$('#barcodeLookup').onclick=()=>lookupBarcode($('#barcodeInput').value);$('#barcodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupBarcode(e.target.value)}});
$('#mealType').addEventListener('change',updateMealSearchPlaceholder);
$('#stepsCancel').onclick=()=>$('#stepsDialog').close();
$('#stepsForm').onsubmit=async e=>{
 e.preventDefault();const input=$('#stepsInput'),v=Number(input.value),dialog=$('#stepsDialog'),day=dialog.dataset.date,button=$('#stepsApply');
 if(button.disabled)return;
 if(!input.value.trim()||!Number.isInteger(v)||v<0||v>100000){$('#stepsInputError').textContent='0~100,000 사이의 걸음 수를 입력해 주세요.';return;}
 if(day!==selectedDate){$('#stepsInputError').textContent='날짜가 변경됐어요. 창을 닫고 다시 입력해 주세요.';return;}
 button.disabled=true;button.textContent='저장 중…';input.disabled=true;$('#stepsCancel').disabled=true;
 document.querySelectorAll('[data-step-plus]').forEach(b=>b.disabled=true);$('#stepsInputError').textContent='';
 try{
  if(window.mealRecordSteps)await window.mealRecordSteps(day,v);
  else{activityFor(day).steps=v;save();renderActivity();}
  dialog.close();
 }catch(error){$('#stepsInputError').textContent=error.message||'저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';}
 finally{button.disabled=false;button.textContent='걸음 기록하기';input.disabled=false;$('#stepsCancel').disabled=false;document.querySelectorAll('[data-step-plus]').forEach(b=>b.disabled=false);}
};
document.querySelectorAll('[data-step-plus]').forEach(b=>b.onclick=()=>{$('#stepsInput').value=Math.min(100000,Math.max(0,Number($('#stepsInput').value)||0)+Number(b.dataset.stepPlus));$('#stepsInputError').textContent='';});
$('#editSteps').onclick=setSteps;document.querySelectorAll('[data-water]').forEach(b=>b.onclick=()=>addWater(+b.dataset.water));$('#undoWater').onclick=undoWater;
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
$('#addFood').onclick=()=>{addFood();updateMealSearchPlaceholder()};$('#removePhoto').onclick=()=>{cancelPhotoLoad();photoData='';clearPreviewUrl();$('#photo').value='';setPhotoUI();$('#status').textContent='사진을 삭제했어요. 저장하면 기록에서 제거돼요.'};
$('#rotatePhotoLeft').onclick=()=>rotateMealPhoto(-1);$('#rotatePhotoRight').onclick=()=>rotateMealPhoto(1);
$('#photo').onchange=async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const version=++photoLoadVersion;photoRotationBase='';photoRotationTurns=0;
  photoLoading=true;photoRotationControls();$('#saveTop').disabled=true;$('#analyzeBtn').disabled=true;
  $('#status').textContent='사진을 준비하고 있어요…';
  try{
    if(f.size>25*1024*1024)throw Error('TOO_LARGE');
    const original=await fileToDataURL(f);
    if(version!==photoLoadVersion)return;
    const compressed=await resizeDataURL(original,960,.68);
    if(version!==photoLoadVersion)return;
    photoData=compressed;photoRotationBase=compressed;photoRotationTurns=0;clearPreviewUrl();setPhotoUI();
    $('#status').textContent='사진이 준비됐어요. 음식과 양을 입력해 저장하세요.';
  }catch(err){
    if(version!==photoLoadVersion)return;
    setPhotoUI();
    $('#status').textContent=err.message==='TOO_LARGE'?'사진은 25MB 이하로 선택해 주세요.':'사진을 열지 못했어요. JPG 또는 PNG 사진으로 다시 선택해 주세요.';
  }finally{
    if(version===photoLoadVersion){photoLoading=false;$('#saveTop').disabled=false;$('#analyzeBtn').disabled=!photoData;photoRotationControls();e.target.value='';}
  }
};

function fileToDataURL(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error||new Error('파일 읽기 실패'));fr.readAsDataURL(file)})}
async function resizeDataURL(original,max,q){
  return await new Promise((resolve,reject)=>{
    const im=new Image();
    im.onload=()=>{
      try{
        const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
        const scale=Math.min(1,max/Math.max(w,h));
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
        const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',q));
      }catch(err){reject(err)}
    };
    im.onerror=()=>reject(new Error('IMAGE_DECODE'));im.src=original;
  });
}
async function photoForAnalysis(source){if(!MealLogPhotoStorage.isRef(source))return source;const response=await fetch(await MealLogPhotoStorage.resolve(source));if(!response.ok)throw Error('사진을 불러오지 못했어요.');return fileToDataURL(await response.blob());}
async function resize(file,max,q){return resizeDataURL(await fileToDataURL(file),max,q)}
$('#analyzeBtn').onclick=async()=>{let b=$('#analyzeBtn');b.disabled=true;$('#status').textContent='AI가 음식을 분석하고 있어요…';try{let res=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:await photoForAnalysis(photoData)})}),data=await res.json();if(!res.ok)throw Error(data.error||'분석 실패');document.querySelectorAll('#foods .foodRow').forEach(row=>{if(!row.querySelector('.name').value.trim())row.remove();});(data.foods||[]).forEach(addFood);if(!document.querySelector('#foods .foodRow'))addFood();$('#status').textContent='AI 추정 결과예요. 음식과 양을 확인한 뒤 저장하세요.'}catch(e){$('#status').textContent=`AI 분석을 사용할 수 없어요: ${e.message} · 음식 검색은 계속 사용할 수 있어요.`}finally{b.disabled=false}};
$('#mealForm').addEventListener('invalid',e=>{const field=e.target;$('#status').textContent='입력한 값과 먹은 시간을 확인해 주세요.';field.scrollIntoView({block:'center'});},true);
$('#mealForm').onsubmit=async e=>{e.preventDefault();const previousMeals=state.meals.slice(),previousDate=selectedDate,editorVersion=photoLoadVersion;let attemptedMeal=null;try{if(photoLoading){$('#status').textContent='사진 준비가 끝나면 저장해 주세요.';return;}document.querySelectorAll('#foods .foodRow').forEach(row=>{if(row.dataset.useSavedNutrition==='true'&&!row.querySelector('.nutritionLater')?.checked)calcRecordNutrition(row);});let foods=[...document.querySelectorAll('.foodRow')].map(d=>({name:d.querySelector('.name').value||'음식',grams:+d.querySelector('.grams').value||0,unit:readFoodUnit(d),calories:+d.querySelector('.calories').value||0,carbs:+d.querySelector('.carbs').value||0,protein:+d.querySelector('.protein').value||0,fat:+d.querySelector('.fat').value||0,barcodeProduct:(()=>{try{return JSON.parse(d.dataset.externalFood||'null')}catch(_){return null}})(),...MealLogQuality.readRow(d)})).filter(f=>f.name!=='음식'||f.calories||f.grams);foods.forEach(f=>{const bp=f.barcodeProduct;if(!bp?.code||f.nutritionStatus==='unknown')return;const amount=Number(f.grams)||0,base=Number(bp.nutritionBase)||100;if(amount<=0)return;const scale=base/amount;storeUserBarcodeProduct({...bp,productAmount:bp.productAmount,displayAmount:bp.displayAmount,calories:f.calories*scale,carbs:f.carbs*scale,protein:f.protein*scale,fat:f.fat*scale,nutritionBase:base,verifiedAt:new Date().toISOString()})});$('#saveTop').disabled=true;$('#status').textContent='사진과 식사 기록을 저장하고 있어요…';const savedPhoto=await window.mealPreparePhoto(photoData);if(editorVersion!==photoLoadVersion)return;let time=$('#mealTime').value||defaultTimeForDate(selectedDate);let meal={id:editingMealId||crypto.randomUUID(),type:$('#mealType').value,time,photo:savedPhoto,foods,memo:$('#memo').value};if(editingMealId){let i=state.meals.findIndex(x=>x.id===editingMealId);if(i>=0)state.meals[i]=meal;else state.meals.push(meal)}else state.meals.push(meal);attemptedMeal=meal;editingMealId=meal.id;selectedDate=time.slice(0,10);if(window.mealCommit)await window.mealCommit();else save();editingMealId=null;hideMealModal();}catch(error){if(attemptedMeal){const previous=previousMeals.find(m=>m.id===attemptedMeal.id);state.meals=state.meals.flatMap(m=>m===attemptedMeal?(previous?[previous]:[]):[m]);}selectedDate=previousDate;$('#status').textContent=error.name==='QuotaExceededError'?'앱의 임시 저장 공간이 부족해요. 사진과 입력 내용은 유지돼요. 로그인 후 기존 사진 이전이 끝나면 다시 저장해 주세요.':(error.message||'저장하지 못했어요. 입력 내용은 그대로 있으니 다시 시도해 주세요.');$('#status').setAttribute('role','alert');$('#status').scrollIntoView({block:'center'});}finally{$('#saveTop').disabled=false;}};
$('#settingsBtn').onclick=()=>{$('#goalInput').value=state.goal;$('#targetWeightInput').value=state.targetWeight||'';$('#stepsGoalInput').value=state.stepsGoal||8000;$('#waterGoalInput').value=state.waterGoal||2000;$('#settingsDialog').showModal()};$('#settingsClose').onclick=()=>$('#settingsDialog').close();$('#saveSettings').onclick=()=>{state.goal=+$('#goalInput').value||1200;let tw=+$('#targetWeightInput').value;state.targetWeight=tw>0?tw:null;state.stepsGoal=+$('#stepsGoalInput').value||8000;state.waterGoal=+$('#waterGoalInput').value||2000;save();$('#settingsDialog').close()};
let statsDays=7;
function dayKeyOffset(n){let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return localDateKey(d)}
function renderStats(){
 const report=MealLogStats.calculate(state.meals,statsDays,localDateKey(new Date())),totals=report.daily;
 const average=report.average,goalValue=Math.max(0,Number(state.goal)||1200);
 $('#avgCalories').textContent=Math.round(average.calories).toLocaleString()+' kcal';$('#loggedDays').textContent=report.loggedDays+'일';
 for(const key of ['carbs','protein','fat'])$('#avg'+key[0].toUpperCase()+key.slice(1)).textContent=Math.round(average[key])+'g';
 $('#totalCalories').textContent=Math.round(report.total.calories).toLocaleString()+' kcal';$('#totalMeals').textContent=report.total.meals+'회';
 $('#statsPeriodLabel').textContent=report.startDate.slice(5).replace('-','/')+' ~ '+report.endDate.slice(5).replace('-','/');
 $('#statsSummaryNote').textContent=report.unknownFoods?'영양 미입력 '+report.unknownFoods+'개가 있어요. 합계는 확인된 값만, 평균은 영양정보가 완전한 '+report.completeDays+'일만 반영해요.':report.loggedDays?'평균은 기록한 '+report.loggedDays+'일 기준이에요. 기록이 없는 날은 제외해요.':'아직 이 기간에 식사 기록이 없어요.';$('#statsSummaryNote').textContent+=' 같은 날짜의 아침·점심·저녁·간식은 각각 1회로 계산해요.';
 MealLogCalorieTrend.render({container:$('#calorieChart'),details:$('#calorieDayDetail'),days:totals,goal:goalValue,onOpen:date=>{selectedDate=date;document.querySelector('.tab[data-view="diary"]').click();render();}});
 const foods=$('#topFoods');foods.replaceChildren();
 report.topFoods.forEach(([name,count],i)=>{const row=document.createElement('div'),span=document.createElement('span'),rank=document.createElement('b'),label=document.createElement('em');rank.textContent=i+1;span.append(rank,document.createTextNode(name));label.textContent=count+'회';row.append(span,label);foods.append(row);});
 if(!report.topFoods.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='아직 음식 기록이 없어요.';foods.append(empty);}
 const body=$('#statsDailyBody');body.replaceChildren();
 [...totals].reverse().forEach(day=>{const row=document.createElement('tr');for(const value of [day.date.slice(5).replace('-','/'),day.meals?day.meals+'회':'기록 없음',day.unknownFoods?(day.knownFoods?'확인된 '+Math.round(day.calories)+' kcal · 미입력 '+day.unknownFoods+'개':'영양정보 미입력'):day.meals?Math.round(day.calories).toLocaleString()+' kcal':'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);});
}

function signedKg(v){return `${v>0?'+':''}${v.toFixed(1)} kg`}
function renderWeights(){
 window.MealLogHome?.render();
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
$('#saveWeight').onclick=()=>{let date=$('#weightDate').value,val=+$ ('#weightValue').value;if(!date||!val)return alert('날짜와 체중을 입력해주세요.');let ex=state.weights.find(x=>x.date===date);if(ex)ex.value=val;else state.weights.push({date,value:val});save();$('#weightValue').value='';$('#weightDate').value=localDateKey(new Date());renderWeights()};
$('#exportData').onclick=()=>{let blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MealLogAI-backup-${localDateKey(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#importData').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let data=JSON.parse(await f.text());if(!Array.isArray(data.meals))throw Error();if(confirm('현재 기록을 백업 파일의 내용으로 바꿀까요?')){state={goal:data.goal||1200,targetWeight:data.targetWeight||null,meals:data.meals||[],weights:data.weights||[],activity:data.activity||{},stepsGoal:data.stepsGoal||8000,waterGoal:data.waterGoal||2000};save();alert('백업을 불러왔어요.')}}catch{alert('올바른 MealLogAI 백업 파일이 아니에요.')}e.target.value=''};

if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');render();

