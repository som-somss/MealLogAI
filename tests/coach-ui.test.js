import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';

const source=readFileSync(new URL('../ai-coach.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const pendingSync=()=>Object.assign(Error('먼저 기존 기록 동기화를 마친 뒤 다시 열어 주세요.'),{code:'MEALLOG_SYNC_PENDING'});

// Exercise the actual browser script with controllable DOM, network and timers.
function harness({prepare=async()=>{},query,fetcher}={}){
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.value='';this.disabled=false;this.hidden=false;this.open=false;this.textContent='';}
  append(...children){this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  before(){}
  replaceChildren(...children){this.children=children;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  dispatch(name){for(const fn of this.events[name]||[])fn({});}
  focus(){}
  scrollIntoView(){}
  reportValidity(){return true;}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 let user={id:'owner'},now=0,sequence=0;const timers=new Map(),requests=[],queries=[];
 const body=new Element('body'),document={body,createElement:tag=>new Element(tag),querySelector:()=>new Element('div')};
 const window={};
 const client={auth:{getSession:async()=>({data:{session:{user,access_token:'test-token'}}})},from(table){
  const call={table,filters:{}};queries.push(call);
  const result=()=>query?query(call):Promise.resolve({data:table==='ai_coach_settings'?{use_food_memory:true,use_external_ai:false}:[],error:null});
  const chain={select(){return this;},eq(k,v){call.filters[k]=v;return this;},order(){return this;},limit(){return this;},maybeSingle(){return result();},then(a,b){return Promise.resolve(result()).then(a,b);}};
  return chain;
 }};
 class Clock extends Date {static now(){return now;}}
 runInNewContext(source,{window,document,Intl,Date:Clock,AbortController,crypto:{randomUUID},fetch:()=>{throw Error('unexpected fetch');},confirm:()=>true,
  setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const panel=window.MealLogCoach.mount({client,getUser:()=>user,getDay:()=>new Date().toISOString().slice(0,10),prepare,requestFetch:async(url,options)=>{
  requests.push(options);return fetcher?fetcher(url,options):Response.json({ok:true,conversation_id:'conversation',reply:'저장한 답변'});
 }});
 const all=()=>{const found=[];function visit(e){found.push(e);for(const c of e.children)visit(c);}visit(body);return found;};
 const find=(tag,text)=>all().find(e=>e.tag===tag&&(text==null||e.textContent===text));
 const input=find('textarea'),status=all().find(e=>e.attrs.role==='status'),send=find('button','보내기');
 return {panel,body,input,status,send,requests,queries,find,timers,
  type(value){input.value=value;input.dispatch('input');},submit(){find('form').onsubmit({preventDefault(){}});},close(){find('button','닫기').onclick();},
  setUser(value){user=value;panel.accountChanged();},
  async tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}await flush();},
  text(){return all().map(e=>e.textContent).join('\n');}
 };
}

test('coach opening waits for record sync and preserves a typed draft',async()=>{
 let ready=false,calls=0;
 const h=harness({prepare:async()=>{calls++;if(!ready)throw pendingSync();}});
 const opening=h.panel.open();await flush();
 assert.match(h.status.textContent,/동기화/);assert.equal(h.send.disabled,true);assert.equal(h.queries.length,0);
 h.type('다음에 물어볼 질문');ready=true;await h.tick(250);await opening;
 assert.equal(calls,2);assert.equal(h.input.value,'다음에 물어볼 질문');assert.equal(h.send.disabled,false);
 assert.equal(h.find('button','다시 연결').hidden,true);assert.equal(h.queries.length,2);
});

test('sync waiting is bounded and reconnect reloads settings without losing input',async()=>{
 let ready=false;
 const h=harness({prepare:async()=>{if(!ready)throw pendingSync();}});
 const opening=h.panel.open();await flush();h.type('작성한 질문');
 await h.tick(15000);await opening;
 assert.equal(h.send.disabled,false);assert.equal(h.find('button','다시 연결').hidden,false);
 assert.equal(h.input.value,'작성한 질문');assert.match(h.status.textContent,/다시 연결/);
 ready=true;h.find('button','다시 연결').onclick();await flush();
 assert.equal(h.find('button','다시 연결').hidden,true);assert.equal(h.input.value,'작성한 질문');
});

test('non-sync errors do not retry or send, and explicit submission never auto-retries',async()=>{
 let fail=false,calls=0;
 const h=harness({prepare:async()=>{calls++;if(fail)throw pendingSync();}});
 await h.panel.open();fail=true;h.type('오늘 점심 수정해줘');h.submit();await flush();await h.tick(15000);
 assert.equal(calls,2);assert.equal(h.requests.length,0);assert.equal(h.input.value,'오늘 점심 수정해줘');
 const invalid=harness({prepare:async()=>{throw Error('계정 또는 기록이 바뀌었어요.');}});
 await invalid.panel.open();assert.equal(invalid.timers.size,0);assert.equal(invalid.queries.length,0);
 assert.match(invalid.status.textContent,/계정 또는 기록/);
});

test('successful reply preserves text edited while waiting but clears unchanged submission',async()=>{
 const response=deferred(),h=harness({fetcher:()=>response.promise});await h.panel.open();
 h.type('첫 질문');h.submit();await flush();h.type('답변 기다리며 쓴 다음 질문');
 response.resolve(Response.json({ok:true,conversation_id:'conversation',reply:'첫 답변'}));await flush();
 assert.equal(h.input.value,'답변 기다리며 쓴 다음 질문');assert.match(h.text(),/첫 답변/);
 const ordinary=harness();await ordinary.panel.open();ordinary.type('전송한 질문');ordinary.submit();await flush();
 assert.equal(ordinary.input.value,'');assert.match(ordinary.text(),/저장한 답변/);
});

test('closing a pending initialization allows immediate reopen and ignores the old result',async()=>{
 const old=deferred(),next=deferred();let n=0;
 const h=harness({prepare:()=>++n===1?old.promise:next.promise});
 const opening=h.panel.open();await flush();h.close();
 const reopened=h.panel.open();await flush();assert.equal(n,2);assert.equal(h.find('dialog').open,true);
 old.resolve();await opening;assert.equal(h.send.disabled,true);assert.equal(h.queries.length,0);
 next.resolve();await reopened;assert.equal(h.send.disabled,false);assert.equal(h.queries.length,2);
});

test('closed request cannot clear a new draft or reset a new task; retry keeps its request id',async()=>{
 const old=deferred(),next=deferred();let n=0;
 const h=harness({fetcher:()=>++n===1?old.promise:next.promise});await h.panel.open();
 h.type('저장 요청');h.submit();await flush();const original=JSON.parse(h.requests[0].body);h.close();
 assert.equal(h.requests[0].signal.aborted,true);await h.panel.open();h.submit();await flush();
 assert.equal(h.requests.length,2);assert.equal(JSON.parse(h.requests[1].body).request_id,original.request_id);
 old.resolve(Response.json({ok:true,conversation_id:'old',reply:'닫힌 화면의 답변'}));await flush();
 assert.equal(h.send.disabled,true);assert.doesNotMatch(h.text(),/닫힌 화면의 답변/);assert.equal(h.requests[1].signal.aborted,false);
 h.type('새 초안');next.resolve(Response.json({ok:true,conversation_id:'next',reply:'재시도 완료'}));await flush();
 assert.equal(h.input.value,'새 초안');assert.match(h.text(),/재시도 완료/);assert.equal(h.send.disabled,false);
});

test('account change cancels pending work and does not leak old messages or drafts',async()=>{
 const response=deferred(),h=harness({fetcher:()=>response.promise});await h.panel.open();
 h.type('이전 계정 질문');h.submit();await flush();h.setUser({id:'other-owner'});
 assert.equal(h.input.value,'');assert.equal(h.requests[0].signal.aborted,true);
 await h.panel.open();response.resolve(Response.json({ok:true,conversation_id:'old',reply:'이전 계정 답변'}));await flush();
 assert.doesNotMatch(h.text(),/이전 계정 답변/);assert.equal(h.send.disabled,false);
});

test('closing a sync wait clears polling and an old response timer cannot abort a new request',async()=>{
 const waiting=harness({prepare:async()=>{throw pendingSync();}});
 const opening=waiting.panel.open();await flush();assert.equal(waiting.timers.size,1);
 waiting.close();await opening;assert.equal(waiting.timers.size,0);await waiting.tick(15000);
 assert.equal(waiting.queries.length,0);assert.equal(waiting.find('dialog').open,false);
 const old=deferred(),next=deferred();let n=0;
 const h=harness({fetcher:()=>++n===1?old.promise:next.promise});await h.panel.open();h.type('질문');h.submit();await flush();
 await h.tick(1000);h.close();await h.panel.open();h.submit();await flush();await h.tick(54000);
 assert.equal(h.requests[1].signal.aborted,false);assert.equal(h.send.disabled,true);
 next.resolve(Response.json({ok:true,conversation_id:'next',reply:'새 응답'}));old.resolve(Response.json({ok:true,conversation_id:'old',reply:'오래된 응답'}));await flush();
 assert.match(h.text(),/새 응답/);assert.doesNotMatch(h.text(),/오래된 응답/);
});

test('editing a draft back to the submitted text still preserves it after the reply',async()=>{
 const response=deferred(),h=harness({fetcher:()=>response.promise});await h.panel.open();
 h.type('원래 질문');h.submit();await flush();h.type('다른 질문');h.type('원래 질문');
 response.resolve(Response.json({ok:true,conversation_id:'conversation',reply:'답변'}));await flush();
 assert.equal(h.input.value,'원래 질문');
});
