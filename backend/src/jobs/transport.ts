export interface DispatchRequest {readonly jobId:string;readonly correlationId:string;readonly intakeHash:string}
export interface TransportEvent {readonly key:string;readonly state:'running'|'collecting'|'validating'|'needs_attention'|'failed';readonly code?:'artifact_import_deferred'|'mock_execution_failed'}
export interface JobTransport {
 readonly type:'mock';
 dispatch(request:DispatchRequest):Promise<{correlationId:string}>;
 events(request:DispatchRequest):AsyncIterable<TransportEvent>;
}
export class DispatchFailure extends Error {constructor(readonly certain:boolean){super('Mock dispatch failed.');}}
export type MockScenario='success'|'dispatch_failure'|'uncertain'|'execution_failure'|'duplicate';
// No network, generated artifacts, proposal imports or financial operations.
export class MockTransport implements JobTransport {
 readonly type='mock' as const;
 constructor(private readonly scenario:MockScenario='success'){}
 async dispatch(request:DispatchRequest){
  if(this.scenario==='dispatch_failure')throw new DispatchFailure(true);
  if(this.scenario==='uncertain')throw new DispatchFailure(false);
  return {correlationId:request.correlationId};
 }
 async *events(_request:DispatchRequest):AsyncIterable<TransportEvent>{
  yield {key:'mock-running',state:'running'};
  if(this.scenario==='duplicate')yield {key:'mock-running',state:'running'};
  if(this.scenario==='execution_failure'){yield {key:'mock-failed',state:'failed',code:'mock_execution_failed'};return;}
  yield {key:'mock-collecting',state:'collecting'};
  yield {key:'mock-validating',state:'validating'};
  yield {key:'mock-completed',state:'needs_attention',code:'artifact_import_deferred'};
 }
}
