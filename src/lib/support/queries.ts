import { queryOptions } from '@tanstack/react-query';
import { getSupportBootstrap, getSupportInbox, getSupportTicket, getSupportCustomers, getSupportCustomer, getSupportKnowledge, getSupportAdmin, getSupportAnalytics, getCustomerMessages } from './workspace.functions';
export const supportBootstrapQuery=queryOptions({queryKey:['support','bootstrap'],queryFn:()=>getSupportBootstrap()});
export interface InboxFilter {teamId:string;status?:string;priority?:string;channel?:string;assignee?:string;search?:string;page?:number;sla?:boolean}
export const inboxQuery=(filter:InboxFilter)=>queryOptions({queryKey:['support','inbox',filter],queryFn:()=>getSupportInbox({data:filter})});
export const ticketQuery=(teamId:string,id:string)=>queryOptions({queryKey:['support','ticket',teamId,id],queryFn:()=>getSupportTicket({data:{teamId,id}}),refetchInterval:15000,refetchIntervalInBackground:false});
export const customersQuery=(teamId:string,search='')=>queryOptions({queryKey:['support','customers',teamId,search],queryFn:()=>getSupportCustomers({data:{teamId,search}})});
export const customerQuery=(teamId:string,id:string)=>queryOptions({queryKey:['support','customer',teamId,id],queryFn:()=>getSupportCustomer({data:{teamId,id}})});
export const knowledgeQuery=(teamId:string)=>queryOptions({queryKey:['support','knowledge',teamId],queryFn:()=>getSupportKnowledge({data:{teamId}})});
export const adminQuery=(teamId:string)=>queryOptions({queryKey:['support','admin',teamId],queryFn:()=>getSupportAdmin({data:{teamId}})});
export const analyticsQuery=(teamId:string)=>queryOptions({queryKey:['support','analytics',teamId],queryFn:()=>getSupportAnalytics({data:{teamId}})});
export const customerMessagesQuery=queryOptions({queryKey:['support','customer-messages'],queryFn:()=>getCustomerMessages(),refetchInterval:15000,refetchIntervalInBackground:false});
