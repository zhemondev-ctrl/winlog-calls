import {createFileRoute} from '@tanstack/react-router';
import {SupportInbox} from '@/components/support/inbox';
import {supportHead} from '@/lib/support/rules';
import {supportBootstrapQuery} from '@/lib/support/queries';
export const Route=createFileRoute('/_authenticated/support')({head:()=>supportHead('Support inbox','Private support cases, call follow-ups and customer inquiries.'),loader:async({context})=>{await context.queryClient.ensureQueryData(supportBootstrapQuery);},component:Page});
function Page(){return <SupportInbox/>;}
