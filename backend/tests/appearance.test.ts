import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext,Script} from 'node:vm';
import {appearanceScript} from '../src/web/appearance.js';
import {testDatabase} from './helpers.js';
import {buildApp} from '../src/app.js';

test('shared appearance initializes before page styles, persists across pages, and tolerates unavailable storage',()=>{
 new Script(appearanceScript);
 for(const choice of ['dark','light','unknown',undefined]){
  const root={dataset:{} as Record<string,string>,classList:{toggle(){}},style:{}};
  runInNewContext(appearanceScript,{document:{documentElement:root,readyState:'loading',addEventListener(){}},localStorage:{getItem:()=>choice}});
  assert.equal(root.dataset.theme,choice==='dark'?'dark':'light');
 }
 const root={dataset:{} as Record<string,string>,classList:{toggle(){}},style:{}};
 runInNewContext(appearanceScript,{document:{documentElement:root,readyState:'loading',addEventListener(){}},localStorage:{getItem(){throw Error('Storage unavailable');}}});assert.equal(root.dataset.theme,'light');
});

test('theme assets and switch bootstrap are available on existing application pages without new API routes',async t=>{
 const {db}=testDatabase(t),app=await buildApp(db);t.after(()=>app.close());
 for(const page of ['/','/projects/project-id','/proposal-imports','/owner-login']){
  const response=await app.inject(page);assert.equal(response.statusCode,200);assert.match(response.body,/<head><script src="\/appearance.js"><\/script>/);assert.match(response.body,/<link rel="stylesheet" href="\/appearance.css"><\/head>/);
 }
 assert.equal((await app.inject('/appearance.js')).statusCode,200);assert.match((await app.inject('/appearance.css')).body,/\[data-theme=dark\]/);
 assert.equal(db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),0);
});
