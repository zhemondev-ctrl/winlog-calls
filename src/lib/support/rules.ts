import { z } from 'zod';
export const statuses = ['new','open','pending','escalated','resolved'] as const;
export const priorities = ['low','normal','high','urgent'] as const;
export const roles = ['admin','manager','agent','viewer'] as const;
export type SupportRole = typeof roles[number];
export const settingsSchema = z.object({categories:z.array(z.string().trim().min(1).max(60)).min(1).max(40),sla_hours:z.object({urgent:z.number().int().min(1).max(720),high:z.number().int().min(1).max(720),normal:z.number().int().min(1).max(720),low:z.number().int().min(1).max(720)}),ai_enabled:z.boolean()});
const uuid = z.string().uuid();
const optionalId = uuid.nullish();
const short = z.string().trim().min(1).max(200);
const body = z.string().trim().min(1).max(10000);
export const mutationSchema = z.discriminatedUnion('action',[
 z.object({action:z.literal('ticket'),teamId:uuid,payload:z.object({subject:short,description:z.string().max(10000).default(''),priority:z.enum(priorities).default('normal'),channel:z.enum(['manual','call','web_chat']).default('manual'),category:z.string().min(1).max(60).default('General'),customer_id:optionalId,call_id:optionalId,assignee_id:optionalId,request_key:uuid})}),
 z.object({action:z.literal('update_ticket'),teamId:uuid,payload:z.object({id:uuid,revision:z.number().int().positive(),status:z.enum(statuses),priority:z.enum(priorities),category:z.string().min(1).max(60),assignee_id:optionalId,tags:z.array(z.string().trim().min(1).max(30)).max(20)})}),
 z.object({action:z.literal('merge'),teamId:uuid,payload:z.object({id:uuid,target:uuid})}),
 z.object({action:z.literal('customer'),teamId:uuid,payload:z.object({id:optionalId,name:z.string().trim().min(1).max(120),phone:z.string().regex(/^[+\d ()-]{0,30}$/).default(''),email:z.union([z.literal(''),z.string().email()]).default(''),consent:z.boolean(),communication_preference:z.enum(['in_app','none']),notes:z.string().max(4000).default('')})}),
 z.object({action:z.literal('customer_link'),teamId:uuid,payload:z.object({id:uuid,user_id:uuid})}),
 z.object({action:z.literal('message'),teamId:uuid,payload:z.object({ticket_id:uuid,body,visibility:z.enum(['internal','customer']),request_key:uuid,ai_draft_id:optionalId})}),
 z.object({action:z.literal('customer_reply'),teamId:uuid,payload:z.object({ticket_id:uuid,body,request_key:uuid})}),
 z.object({action:z.literal('approve_draft'),teamId:uuid,payload:z.object({id:uuid,body})}),
 z.object({action:z.literal('article'),teamId:uuid,payload:z.object({id:optionalId,version:z.number().int().positive().optional(),title:short,body:z.string().trim().min(1).max(30000),category:z.string().min(1).max(60),state:z.enum(['draft','published']),source_url:z.union([z.literal(''),z.string().url().startsWith('https://')])})}),
 z.object({action:z.literal('member'),teamId:uuid,payload:z.object({user_id:uuid,role:z.enum(roles)})}),
 z.object({action:z.literal('settings'),teamId:uuid,payload:z.object({settings:settingsSchema})}),
 z.object({action:z.literal('attachment'),teamId:uuid,payload:z.object({ticket_id:uuid,name:z.string().min(1).max(160),mime:z.enum(['image/png','image/jpeg','application/pdf']),size_bytes:z.number().int().min(1).max(2097152),content_base64:z.string().max(2796204).regex(/^[A-Za-z0-9+/]+={0,2}$/)})}),
]);
export type SupportMutation = z.input<typeof mutationSchema>;
export function canMutate(role:SupportRole|null,action:string){if(!role||role==='viewer')return false;if(['member','settings','customer_link'].includes(action))return role==='admin';if(['article','merge'].includes(action))return role==='admin'||role==='manager';return true;}
export function validTransition(from:string,to:string){return statuses.includes(to as typeof statuses[number])&&(from!=='resolved'||to==='open'||to==='resolved');}
export function maySendAi(draft:{status:string;body:string;kind:string},text:string){return draft.status==='approved'&&draft.body===text&&['reply','follow_up'].includes(draft.kind);}
export function validateAttachment(mime:string,base64:string,size:number){const raw=atob(base64);if(raw.length!==size||size>2097152||size<1)throw new Error('Attachment size mismatch');const bytes=Array.from(raw.slice(0,8),c=>c.charCodeAt(0));const valid=mime==='application/pdf'?raw.startsWith('%PDF-'):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes.join(',')==='137,80,78,71,13,10,26,10':false;if(!valid)throw new Error('File content does not match its type');}
export interface MetricCase {status:string;channel:string;category:string;assignee_id:string|null;created_at:string;first_response_at:string|null;resolved_at:string|null;sla_due_at:string;reopen_count:number}
export function supportMetrics(rows:MetricCase[],now=Date.now()){
 const group=(key:'status'|'channel'|'category'|'assignee_id')=>rows.reduce<Record<string,number>>((a,r)=>{const k=r[key]??'Unassigned';a[k]=(a[k]??0)+1;return a;},{});
 const avg=(field:'first_response_at'|'resolved_at')=>{const vals=rows.filter(r=>r[field]).map(r=>Math.max(0,(Date.parse(r[field]??'')-Date.parse(r.created_at))/60000));return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
 return {total:rows.length,byStatus:group('status'),byChannel:group('channel'),byCategory:group('category'),workload:rows.filter(r=>r.status!=='resolved').reduce<Record<string,number>>((a,r)=>{const k=r.assignee_id??'Unassigned';a[k]=(a[k]??0)+1;return a;},{}),firstResponseMinutes:avg('first_response_at'),resolutionMinutes:avg('resolved_at'),slaBreaches:rows.filter(r=>Date.parse(r.sla_due_at)<(r.resolved_at?Date.parse(r.resolved_at):now)).length,reopenRate:rows.length?rows.filter(r=>r.reopen_count>0).length/rows.length:null,csat:null};
}
export const releaseReadiness=[['Package','com.winlog.app','Supplied audit'],['Version','1.0.10 / code 10','Supplied audit'],['APK v2 signature','Verifies','Supplied audit only'],['Signer fingerprint','Not independently approved','NOT VERIFIED'],['Source provenance','Unknown','NOT VERIFIED'],['Real-phone installation','Not tested','NOT VERIFIED'],['SIM call capture','Not tested on a real device','NOT VERIFIED'],['WhatsApp access','Notification inference; no history API','NOT VERIFIED'],['Closed-app background upload','No real-device acceptance evidence','NOT VERIFIED'],['Pulse CRM bridge','No verified private connection','NOT VERIFIED']] as const;
export function supportHead(title:string,description:string){return {meta:[{title:`${title} — Winlog Calls`},{name:'description',content:description},{property:'og:title',content:`${title} — Winlog Calls`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]};}
