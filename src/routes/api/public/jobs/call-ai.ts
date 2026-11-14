import {createFileRoute} from '@tanstack/react-router';
import {authenticateCronRequest} from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/jobs/call-ai')({server:{handlers:{POST:async({request})=>{
 const denied=await authenticateCronRequest(request);if(denied)return denied;
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const {data:pending,error}=await db.from('support_call_ai_jobs').select('team_id').eq('state','pending').order('created_at').limit(20);if(error)return Response.json({error:'Queue unavailable'},{status:500});
 const teams=Array.from(new Set((pending??[]).map(j=>j.team_id))).slice(0,1);const {processCallAi}=await import('@/lib/support/call-ai.server');let processed=0;for(const team of teams){const result=await processCallAi(team);processed+=result.processed;}return Response.json({processed});
}}}});
