import {createFileRoute} from '@tanstack/react-router';
import {SupportKnowledge} from '@/components/support/knowledge';
import {supportHead} from '@/lib/support/rules';
import {supportBootstrapQuery} from '@/lib/support/queries';
export const Route=createFileRoute('/_authenticated/support-knowledge')({head:()=>supportHead('Knowledge base','Approved articles, FAQs and version history.'),loader:async({context})=>{await context.queryClient.ensureQueryData(supportBootstrapQuery);},component:Page});
function Page(){return <SupportKnowledge/>;}
