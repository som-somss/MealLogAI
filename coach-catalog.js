import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// Reuse the exact public food datasets already shipped to the site's food search.
// The sandbox evaluates these trusted, local data modules without DOM, network or credentials.
const scripts=[
 readFileSync(new URL('./korean-foods.js',import.meta.url),'utf8'),
 readFileSync(new URL('./nobrand-foods.js',import.meta.url),'utf8'),
 readFileSync(new URL('./chicken-foods.js',import.meta.url),'utf8'),
 readFileSync(new URL('./convenience-foods.js',import.meta.url),'utf8'),
 readFileSync(new URL('./variety-foods.js',import.meta.url),'utf8')
];
const scope={MealLogFoodQuery:{search:(_q,foods)=>foods,matches:()=>true}};
for(const script of scripts)runInNewContext(script,scope,{timeout:1000});
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=app.indexOf('const FOOD_DB='),end=app.indexOf('];',start)+2;
if(start<0||end<=start)throw Error('Site food database not found');
const base={};runInNewContext(app.slice(start,end)+';globalThis.foods=FOOD_DB;',base,{timeout:1000});
const seen=new Set();
export const siteFoods=[...scope.MealLogKoreanFoods.search(''),...base.foods.map(f=>({...f,nutritionBase:100,unit:'g',source:'site-reference'}))].filter(f=>{
 if(!f?.name||!['g','mL','개','인분'].includes(f.unit)||!Number.isFinite(Number(f.nutritionBase))||Number(f.nutritionBase)<=0||['calories','carbs','protein','fat'].some(k=>typeof f[k]!=='number'||!Number.isFinite(f[k])||f[k]<0))return false;
 const id=[f.name,f.brand||f.maker||'',f.unit,f.nutritionBase,...['calories','carbs','protein','fat'].map(k=>f[k])].join('|');
 if(seen.has(id))return false;seen.add(id);return true;
});
