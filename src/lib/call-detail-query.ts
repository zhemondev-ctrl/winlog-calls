import { queryOptions } from "@tanstack/react-query";
import { getCallDetail } from "./call-detail.functions";
export const callDetailQuery = (id: string) => queryOptions({ queryKey: ["call-detail", id], queryFn: () => getCallDetail({ data: { id } }) });