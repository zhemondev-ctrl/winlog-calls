import {createFileRoute} from '@tanstack/react-router';
import {SupportAdmin} from '@/components/support/admin';
import {supportHead} from '@/lib/support/rules';
import {supportBootstrapQuery} from '@/lib/support/queries';
export const Route=createFileRoute('/_authenticated/support-admin')({head:()=>supportHead('Support administration','Team access, policies, integrations and release-readiness evidence.'),loader:async({context})=>{await context.queryClient.ensureQueryData(supportBootstrapQuery);},component:Page});
function Page(){return <SupportAdmin/>;}
