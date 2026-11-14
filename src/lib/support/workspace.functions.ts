import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/integrations/supabase/types';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {canMutate,mutationSchema,settingsSchema,supportMetrics,validateAttachment,type SupportRole} from './rules';
const teamSchema=z.object({teamId:z.string().uuid()});
const detailSchema=teamSchema.extend({id:z.string().uuid()});
async function access(db:SupabaseClient<Database>,teamId:string,write=false){const {data,error}=await db.rpc('support_role',{_team:teamId});if(error||!data||(write&&data==='viewer'))throw new Error('This workspace is not available to your account.');return z.enum(['admin','manager','agent','viewer']).parse(data);}
function checked<T>(result:{data:T;error:unknown}):T{if(result.error)throw new Error('Could not load support records.');return result.data;}
export const getSupportBootstrap=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const teams=checked(await context.supabase.from('support_teams').select('*').order('created_at'))??[];
 const memberships=checked(await context.supabase.from('support_members').select('*').eq('user_id',context.userId))??[];
 return {teams,memberships,userId:context.userId};
});
export const getSupportInbox=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>teamSchema.extend({status:z.enum(['new','open','pending','escalated','resolved']).optional(),priority:z.enum(['low','normal','high','urgent']).optional(),channel:z.enum(['manual','call','web_chat']).optional(),assignee:z.string().optional(),search:z.string().max(120).default(''),page:z.number().int().min(0).default(0),sla:z.boolean().optional()}).parse(input)).handler(async({data,context})=>{
 const role=await access(context.supabase,data.teamId);
 let q=context.supabase.from('support_tickets').select('*',{count:'exact'}).eq('team_id',data.teamId).is('merged_into',null).order('created_at',{ascending:false});
 if(data.status)q=q.eq('status',data.status);if(data.priority)q=q.eq('priority',data.priority);if(data.channel)q=q.eq('channel',data.channel);if(data.assignee)q=data.assignee==='unassigned'?q.is('assignee_id',null):q.eq('assignee_id',z.string().uuid().parse(data.assignee));if(data.search)q=q.ilike('subject',`%${data.search.replace(/[%_]/g,'')}%`);if(data.sla)q=q.lt('sla_due_at',new Date().toISOString()).neq('status','resolved');
 const result=await q.range(data.page*25,data.page*25+24);checked(result);
 const [members,customers]=await Promise.all([context.supabase.from('support_members').select('*').eq('team_id',data.teamId),context.supabase.from('support_customers').select('id,name,phone_last4').eq('team_id',data.teamId).limit(1000)]);
 return {tickets:result.data??[],count:result.count??0,members:checked(members)??[],customers:checked(customers)??[],role};
});
export const getSupportTicket=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>detailSchema.parse(i)).handler(async({data,context})=>{
 const db=context.supabase;const role=await access(db,data.teamId);const ticket=checked(await db.from('support_tickets').select('*').eq('team_id',data.teamId).eq('id',data.id).single());if(!ticket)throw new Error('Case not found');
 const related=checked(await db.from('support_tickets').select('id,subject').eq('team_id',data.teamId).eq('merged_into',ticket.id))??[];const ids=[ticket.id,...related.map(t=>t.id)];
 const [messages,members,customer,attachments,drafts]=await Promise.all([db.from('support_messages').select('*').eq('team_id',data.teamId).in('ticket_id',ids).order('created_at'),db.from('support_members').select('*').eq('team_id',data.teamId),ticket.customer_id?db.from('support_customers').select('*').eq('id',ticket.customer_id).maybeSingle():Promise.resolve({data:null,error:null}),db.from('support_attachments').select('id,name,mime,size_bytes,created_at').eq('team_id',data.teamId).in('ticket_id',ids),db.from('support_ai_drafts').select('*').eq('team_id',data.teamId).eq('ticket_id',data.id).order('created_at',{ascending:false})]);
 let call=null;let note=null;if(ticket.call_id&&role!=='viewer'){call=checked(await db.from('call_logs').select('id,source,direction,started_at,created_at,duration_seconds,user_id').eq('id',ticket.call_id).maybeSingle());note=checked(await db.from('call_ai_notes').select('note,follow_up,resolved_at').eq('call_id',ticket.call_id).maybeSingle());}
 const audit=role==='admin'||role==='manager'?checked(await db.from('support_audit').select('*').eq('team_id',data.teamId).eq('entity_id',data.id).order('created_at',{ascending:false}).limit(100))??[]:[];
 return {ticket,related,messages:checked(messages)??[],members:checked(members)??[],customer:checked(customer),attachments:checked(attachments)??[],drafts:checked(drafts)??[],call,note,audit,role};
});
export const mutateSupport=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>mutationSchema.parse(i)).handler(async({data,context})=>{
 if(data.action!=='customer_reply'){const role=await access(context.supabase,data.teamId,true);if(!canMutate(role,data.action))throw new Error('Your role cannot perform this action.');}
 if(data.action==='attachment')validateAttachment(data.payload.mime,data.payload.content_base64,data.payload.size_bytes);
 const {data:id,error}=await context.supabase.rpc('support_mutate',{_team:data.teamId,_action:data.action,_payload:data.payload});
 if(error)throw new Error(error.message);return {id};
});
export const getSupportCustomers=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>teamSchema.extend({search:z.string().max(120).default('')}).parse(i)).handler(async({data,context})=>{const role=await access(context.supabase,data.teamId);return {role,customers:checked(await context.supabase.from('support_customers').select('*').eq('team_id',data.teamId).ilike('name',`%${data.search.replace(/[%_]/g,'')}%`).order('created_at',{ascending:false}).limit(500))??[]};});
export const getSupportCustomer=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>detailSchema.parse(i)).handler(async({data,context})=>{
 const db=context.supabase;const role=await access(db,data.teamId);const customer=checked(await db.from('support_customers').select('*').eq('team_id',data.teamId).eq('id',data.id).single());const contact=role==='viewer'?null:checked(await db.from('support_customer_contacts').select('*').eq('team_id',data.teamId).eq('customer_id',data.id).maybeSingle());
 const tickets=checked(await db.from('support_tickets').select('*').eq('team_id',data.teamId).eq('customer_id',data.id).order('created_at',{ascending:false}))??[];
 const calls=contact?.phone?checked(await db.from('call_logs').select('id,source,direction,started_at,created_at,duration_seconds,user_id').eq('phone_number',contact.phone).in('user_id',(checked(await db.from('support_members').select('user_id').eq('team_id',data.teamId))??[]).map(m=>m.user_id)).order('started_at',{ascending:false}).limit(200))??[]:[];
 const messages=tickets.length?checked(await db.from('support_messages').select('*').eq('team_id',data.teamId).in('ticket_id',tickets.map(t=>t.id)).order('created_at',{ascending:false}).limit(300))??[]:[];
 return {customer,contact,calls,tickets,messages,role};
});
export const getSupportKnowledge=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>teamSchema.parse(i)).handler(async({data,context})=>{const role=await access(context.supabase,data.teamId);return {role,articles:checked(await context.supabase.from('support_articles').select('*').eq('team_id',data.teamId).order('updated_at',{ascending:false}))??[],versions:role==='viewer'?[]:checked(await context.supabase.from('support_article_versions').select('*').eq('team_id',data.teamId).order('created_at',{ascending:false}).limit(500))??[]};});
export const getSupportAdmin=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>teamSchema.parse(i)).handler(async({data,context})=>{const role=await access(context.supabase,data.teamId);if(!['admin','manager'].includes(role))throw new Error('Manager access required');return {role,members:checked(await context.supabase.from('support_members').select('*').eq('team_id',data.teamId))??[],people:role==='admin'?checked(await context.supabase.rpc('support_available_people',{_team:data.teamId}))??[]:[],audit:checked(await context.supabase.from('support_audit').select('*').eq('team_id',data.teamId).order('created_at',{ascending:false}).limit(200))??[],settings:settingsSchema.parse(checked(await context.supabase.from('support_teams').select('settings').eq('id',data.teamId).single())?.settings),aiConfigured:Boolean(process.env['LOVABLE_API_KEY'])};});
export const getSupportAnalytics=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>teamSchema.parse(i)).handler(async({data,context})=>{await access(context.supabase,data.teamId);const rows=[];for(let page=0;page<100;page++){const batch=checked(await context.supabase.from('support_tickets').select('status,channel,category,assignee_id,created_at,first_response_at,resolved_at,sla_due_at,reopen_count').eq('team_id',data.teamId).is('merged_into',null).order('id').range(page*1000,page*1000+999))??[];rows.push(...batch);if(batch.length<1000)return {metrics:supportMetrics(rows),truncated:false};}return {metrics:supportMetrics(rows),truncated:true};});
export const getSupportAttachment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>detailSchema.parse(i)).handler(async({data,context})=>{await access(context.supabase,data.teamId,true);return checked(await context.supabase.from('support_attachments').select('*').eq('team_id',data.teamId).eq('id',data.id).single());});
export const getCustomerMessages=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const customers=checked(await context.supabase.from('support_customers').select('id,name').eq('user_id',context.userId))??[];if(!customers.length)return {tickets:[],messages:[]};
 const tickets=checked(await context.supabase.from('support_tickets').select('id,team_id,subject,status,created_at').in('customer_id',customers.map(c=>c.id)).order('created_at',{ascending:false}))??[];
 const messages=tickets.length?checked(await context.supabase.from('support_messages').select('id,ticket_id,body,author_id,created_at,delivery_state').eq('visibility','customer').in('ticket_id',tickets.map(t=>t.id)).order('created_at'))??[]:[];
 return {tickets,messages};
});
