import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {overviewScript} from '../src/web/overview.js';

test('the seven-day cash chart sums recorded receipts by local date and excludes other money',()=>{
 const {weeklyReceipts}=runInNewContext(overviewScript+'\n({weeklyReceipts})');
 const entries=[
  {kind:'receipt',paid_on:'2026-12-27',amount_cents:5000},
  {kind:'receipt',paid_on:'2026-12-28',amount_cents:1100},
  {kind:'receipt',paid_on:'2027-01-03',amount_cents:2500},
  {kind:'receipt',paid_on:'2027-01-03',amount_cents:500},
  {kind:'expense',paid_on:'2027-01-03',amount_cents:2000},
  {kind:'receipt',paid_on:'2027-01-04',amount_cents:2000}
 ];
 const days=weeklyReceipts(entries,new Date(2027,0,3,12));
 assert.deepEqual(Array.from(days,(day:any)=>day.key),
  ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.deepEqual(Array.from(days,(day:any)=>day.cents),[1100,0,0,0,0,0,3000]);
});
