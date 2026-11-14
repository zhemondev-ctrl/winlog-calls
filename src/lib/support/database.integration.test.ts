import {describe,it,expect} from 'vitest';
const url=process.env['SUPPORT_TEST_URL'];const key=process.env['SUPPORT_TEST_PUBLIC_KEY'];const token=process.env['SUPPORT_TEST_TOKEN'];
const enabled=Boolean(url&&key&&token);
describe.skipIf(!enabled)('Live support database authorization and idempotency',()=>{
 async function query(path:string,authenticated=true){const headers=new Headers({apikey:key??''});if(authenticated)headers.set('Authorization',`Bearer ${token}`);const response=await fetch(`${url}/rest/v1/${path}`,{headers});return {response,data:await response.json()};}
 async function mutate(team:string,action:string,payload:Record<string,unknown>){return fetch(`${url}/rest/v1/rpc/support_mutate`,{method:'POST',headers:{apikey:key??'',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({_team:team,_action:action,_payload:payload})});}
 it('anonymous callers cannot read support cases',async()=>{const r=await query('support_tickets?select=id',false);expect(r.data).toEqual([]);});
 it('unrelated team rejects authenticated mutations',async()=>{const response=await mutate(crypto.randomUUID(),'ticket',{subject:'No record should be created',request_key:crypto.randomUUID()});expect(response.ok).toBe(false);});
 it('a repeated case creation returns the existing case',async()=>{const result=await query('support_tickets?select=id,team_id,request_key&subject=eq.QA%20validation%20%E2%80%94%20support%20console');const rows=result.data as {id:string;team_id:string;request_key:string}[];const t=rows[0];expect(t).toBeDefined();if(!t)throw new Error('Validation case required');const response=await mutate(t.team_id,'ticket',{subject:'QA validation — support console',request_key:t.request_key});expect(response.ok).toBe(true);expect(await response.json()).toBe(t.id);});
});
