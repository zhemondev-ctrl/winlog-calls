import {createFileRoute} from '@tanstack/react-router';
import {SupportMessages} from '@/components/support/messages';
import {supportHead} from '@/lib/support/rules';
import {supportBootstrapQuery,customerMessagesQuery} from '@/lib/support/queries';
export const Route=createFileRoute('/_authenticated/support-messages')({head:()=>supportHead('Customer messages','Private in-app customer ticket conversations.'),loader:async({context})=>{await context.queryClient.ensureQueryData(supportBootstrapQuery);await context.queryClient.ensureQueryData(customerMessagesQuery);},component:Page});
function Page(){return <SupportMessages/>;}
