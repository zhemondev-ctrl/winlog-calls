import {it,expect} from 'vitest';
import {callAiEvidence,classifyCallAiFailure} from './call-ai';
it('credit failures pause without replay',()=>expect(classifyCallAiFailure(402)).toMatchObject({state:'failed',pause:true}));
it('access denials pause without substitution',()=>expect(classifyCallAiFailure(403)).toMatchObject({state:'failed',pause:true}));
it('unknown outcomes are not automatically retried',()=>expect(classifyCallAiFailure(500,'unknown')).toMatchObject({state:'unknown',pause:true}));
it('rate limits preserve pending work and pause',()=>expect(classifyCallAiFailure(429)).toMatchObject({state:'pending',pause:true}));
it('SIM metadata is evidence not conversation content',()=>expect(callAiEvidence({source:'sim',direction:'incoming',duration_seconds:10,started_at:'2026-11-15',created_at:'2026-11-15'})).toMatchObject({evidence:'Server read-back of device CallLog report',reported_seconds:10}));
it('WhatsApp metadata is explicitly notification inference',()=>expect(callAiEvidence({source:'whatsapp',direction:'missed',duration_seconds:0,started_at:'2026-11-15',created_at:'2026-11-15'}).evidence).toContain('notification inference'));
