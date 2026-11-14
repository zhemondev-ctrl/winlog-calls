import {createFileRoute} from '@tanstack/react-router';
import {SupportCustomer} from '@/components/support/customers';
import {supportHead} from '@/lib/support/rules';
import {supportBootstrapQuery} from '@/lib/support/queries';
export const Route=createFileRoute('/_authenticated/support-customers_/$customerId')({head:()=>supportHead('Customer profile','Customer preferences, case timeline and call evidence.'),loader:async({context})=>{await context.queryClient.ensureQueryData(supportBootstrapQuery);},component:Page});
function Page(){const {customerId}=Route.useParams(); return <SupportCustomer id={customerId}/>;}
