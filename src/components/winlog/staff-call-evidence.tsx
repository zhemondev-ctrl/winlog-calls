import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock3, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/calls";
import { staffCallEvidence } from "@/lib/staff-call-evidence";
import { useNativeSyncContext } from "./native-sync-context";

const time = (value: string | number | null) => value ? new Date(value).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" }) : "এখনো পাওয়া যায়নি";

export function StaffCallEvidence({ userId, name, currentUserId }: { userId: string; name: string; currentUserId: string }) {
  const phone = useNativeSyncContext();
  const query = useQuery({
    queryKey: ["calls", "staff-evidence", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_logs")
        .select("id,source,direction,started_at,duration_seconds,created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("Call evidence unavailable");
      return data;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const call = query.data ?? null;
  const evidence = staffCallEvidence(call);
  const ownPhone = phone.native && userId === currentUserId;
  const syncAt = ownPhone ? Math.max(phone.lastAt ?? 0, phone.background?.lastSuccessAt ?? 0) : 0;
  return (
    <section aria-label={`${name} call verification`} aria-live="polite" className="mb-5 border-y border-border py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 break-words font-semibold"><ShieldCheck className="size-5 shrink-0 text-primary" />{name} · সিঙ্ক ও কল যাচাই</h2>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="size-4" />আবার পরীক্ষা</Button>
      </div>
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">কলের প্রমাণ পরীক্ষা হচ্ছে…</p> : query.isError ? <p role="alert" className="text-sm text-destructive">কলের তথ্য পড়া যায়নি; verified status নিশ্চিত করা যাচ্ছে না। আবার পরীক্ষা করুন।</p> : <>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4" />সর্বশেষ সিঙ্ক</h3>
            <p className="mt-2 break-words text-sm">{ownPhone ? time(syncAt || null) : "ফোনের সিঙ্ক সময় অজানা"}</p>
            <p className="mt-2 text-xs text-muted-foreground">সর্বশেষ কল সার্ভারে পাওয়া: {time(call?.created_at ?? null)} (ঢাকা)</p>
            {!ownPhone && <p className="mt-1 text-xs text-muted-foreground">কল পাওয়ার সময় ফোনের শেষ সিঙ্কের সময় নয়।</p>}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">পরীক্ষামূলক কলের রেকর্ড</h3>
            {call ? <>
              <p className="mt-2 text-sm">সর্বশেষ আপলোড: {call.source === "sim" ? "SIM" : "WhatsApp"} · {call.direction}</p>
              <p className="mt-1 text-sm">কলের সময়: {time(call.started_at)} (ঢাকা)</p>
              <p className="mt-1 text-sm">ফোনের রিপোর্ট অনুযায়ী সময়কাল: {formatDuration(call.duration_seconds)}</p>
              <p className="mt-2 text-xs text-muted-foreground">এটি আপনার পরীক্ষামূলক কল কি না এখনো নিশ্চিত নয়।</p>
              <Button asChild variant="link" className="mt-1 h-auto px-0"><Link to="/calls/$callId" params={{ callId: call.id }}>কলের বিস্তারিত</Link></Button>
            </> : <p className="mt-2 text-sm text-muted-foreground">কোনো কল রেকর্ড পাওয়া যায়নি; পরীক্ষামূলক কল এখনো যাচাই হয়নি।</p>}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Verified status</h3>
            <p className={`mt-2 text-sm font-semibold ${evidence.receiptVerified ? "text-primary" : "text-muted-foreground"}`}>{evidence.receiptVerified ? "Verified · সার্ভারে রেকর্ড পাওয়া গেছে" : "Not verified · কলের প্রমাণ নেই"}</p>
            {call && <p className="mt-2 text-xs text-muted-foreground">{evidence.deviceEvidence === "device-calllog-report" ? "উৎস: ফোনের CallLog রিপোর্ট।" : "উৎস: WhatsApp নোটিফিকেশন থেকে অনুমান; সরাসরি কল হিস্ট্রি নয়।"}</p>}
            <p className="mt-2 text-xs text-muted-foreground">বাস্তব ফোনের পরীক্ষা: NOT VERIFIED। পরীক্ষামূলক কলের পরিচয়: NOT VERIFIED। AI লেখা কোনো কলের প্রমাণ নয়।</p>
          </div>
        </div>
        {!call && <div className="mt-5 border-t border-border pt-4" aria-label="কল না থাকলে করণীয়">
          <h3 className="text-sm font-semibold">কেন Not verified?</h3>
          <p className="mt-2 text-sm text-muted-foreground">{name}-এর কোনো কল রেকর্ড এখনো এই অ্যাকাউন্টে পাওয়া যায়নি। তাই আপলোড যাচাই করার প্রমাণ নেই; এটি ফোনে কল হয়নি বা অনুমতি বন্ধ আছে—এমন প্রমাণ নয়।</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li>টিম ফোনে সঠিক কর্মীর কোম্পানি কোড দিয়ে সেটআপ সম্পন্ন করুন।</li>
            <li>ফোনে কল হিস্ট্রি ও WhatsApp নোটিফিকেশনের অনুমতি এবং ব্যাটারি সেটিংস পরীক্ষা করুন।</li>
            <li>একটি SIM কল করে শেষ করুন; ইন্টারনেট চালু রেখে ফোনের Sync now চাপুন।</li>
            <li>এরপর এখানে ‘আবার পরীক্ষা’ চাপুন। রেকর্ড এলে সার্ভারে পাওয়া যাচাই হবে; বাস্তব ফোনের পরীক্ষা নিশ্চিত করতে কর্মীর নাম ও কলের সময় মিলিয়ে দেখুন।</li>
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/sync"><ShieldCheck className="size-4" />সিঙ্কের সমস্যা পরীক্ষা</Link></Button>
          {!ownPhone && <p className="mt-2 text-xs text-muted-foreground">অনুমতি ও Sync now কর্মীর Android ফোনেই পরীক্ষা করতে হবে; এই ওয়েবসাইট থেকে অন্য ফোনের সেটিংস জানা যায় না।</p>}
        </div>}
      </>}
    </section>
  );
}