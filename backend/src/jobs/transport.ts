export interface DispatchRequest {
  readonly jobId: string;
  readonly correlationId: string;
  readonly intakeHash: string;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly clientName?: string;
  readonly brief?: string;
  readonly revenueCents?: number;
  readonly currency?: string;
  readonly intakeRevision?: number;
}
export interface TransportEvent {
  readonly key: string;
  readonly state: 'running' | 'collecting' | 'validating' | 'needs_attention' | 'failed' | 'imported';
  readonly code?: string;
  readonly diagnostic?: string;
}
export interface JobTransport {
  readonly type: 'mock' | 'discord';
  dispatch(request: DispatchRequest): Promise<{ correlationId: string; messageId?: string }>;
  events(request: DispatchRequest): AsyncIterable<TransportEvent>;
}
export class DispatchFailure extends Error { constructor(readonly certain: boolean, message = 'Dispatch failed.', readonly diagnostic: string | null = null) { super(message); } }
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
