import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dashboardSyncWarning } from "@/lib/dashboard-sync-warning";
import { useNativeSyncContext } from "./native-sync-context";

const reasons: Record<string, string> = {
  offline: "এই ফোনে ইন্টারনেট সংযোগ নেই।",
  "call-log": "কল হিস্ট্রি পড়ার অনুমতি বন্ধ আছে।",
  notifications: "WhatsApp কল শনাক্ত করার Notification access বন্ধ আছে।",
  battery: "ব্যাটারি সেটিংস অ্যাপকে ব্যাকগ্রাউন্ডে বন্ধ করতে পারে।",
  "old-app": "এই APK-তে ব্যাকগ্রাউন্ড আপলোডের তথ্য পাওয়া যাচ্ছে না।",
  "background-off": "অ্যাপ বন্ধ থাকলে আপলোড করার ব্যবস্থা চালু নেই।",
  "signed-out": "অ্যাকাউন্ট বা আপলোড কী গ্রহণ করা হচ্ছে না।",
  unreachable: "এই ফোন থেকে আপলোড সেবায় পৌঁছানো যাচ্ছে না।",
  "upload-failed": "সর্বশেষ আপলোডে ত্রুটি হয়েছে।",
  stale: "সাম্প্রতিক সফল সিঙ্কের তথ্য পাওয়া যাচ্ছে না।",
};

export function DashboardSyncWarning({ userId, name, currentUserId }: { userId: string; name: string; currentUserId: string }) {
  const phone = useNativeSyncContext();
  const ownPhone = phone.native && userId === currentUserId;
  const receipt = useQuery({
    queryKey: ["calls", "latest-receipt", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_logs").select("created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("Receipt check failed");
      return data?.created_at ?? null;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  if (receipt.isPending) return <p role="status" className="mb-5 text-sm text-muted-foreground">{name}: কল আপলোডের তথ্য পরীক্ষা হচ্ছে…</p>;
  const warning = receipt.isError ? null : dashboardSyncWarning({
    now: Date.now(), latestReceipt: receipt.data ?? null,
    phone: ownPhone ? { now: Date.now(), online: phone.online, permissions: phone.status, background: phone.background, sim: phone.sources.sim, whatsapp: phone.sources.whatsapp, uploadError: phone.error } : undefined,
  });
  if (!receipt.isError && !warning) return null;
  return (
    <section role="alert" aria-label={`${name} sync warning`} className="mb-5 border-y border-destructive/40 bg-destructive/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-semibold">{name}: {receipt.isError ? "সিঙ্কের তথ্য দেখা যাচ্ছে না" : "কল সিঙ্ক পরীক্ষা করুন"}</h2>
          <p className="mt-2 text-sm">{receipt.isError ? "আপলোডের তথ্য পড়া যায়নি; এটি ফোনের সিঙ্ক ব্যর্থ হওয়ার প্রমাণ নয়। আবার পরীক্ষা করুন।" : warning?.kind === "no-receipt" ? "এই কর্মীর কোনো কল এখনো সার্ভারে পাওয়া যায়নি।" : warning?.kind === "device" ? "এই ফোনে নিচের সমস্যা শনাক্ত হয়েছে।" : "২ ঘণ্টার বেশি সময় নতুন কল পাওয়া যায়নি; নতুন কল না করলেও এমন হতে পারে।"}</p>
          {warning?.kind === "device" && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{warning.issues.map(issue => <li key={issue.id}>{reasons[issue.id] ?? issue.title}</li>)}</ul>}
          {!receipt.isError && <>
            <p className="mt-2 text-xs text-muted-foreground">সর্বশেষ কল পাওয়া: {receipt.data ? new Date(receipt.data).toLocaleString("bn-BD") : "এখনো পাওয়া যায়নি"}{!ownPhone && "। দূর থেকে ফোনের অনুমতি, ইন্টারনেট বা ব্যাটারির অবস্থা জানা যাচ্ছে না; নির্দিষ্ট কারণ এখনো নিশ্চিত নয়।"}</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>কর্মীর ফোনে Winlog Calls খুলে সঠিক কর্মীর অ্যাকাউন্ট আছে কি না দেখুন; প্রয়োজন হলে ম্যানেজারের নতুন Company Code দিয়ে সেটআপ করুন।</li>
              <li>মোবাইল ডেটা বা Wi-Fi চালু করুন। Sync status-এ Call history ও Phone permission দিন; WhatsApp-এর জন্য Notification access চালু করুন।</li>
              <li>Battery settings-এ Unrestricted দিন; প্রয়োজন হলে Autostart চালু করুন।</li>
              <li>একটি SIM কল শেষ করে ফোনে Sync now চাপুন। ত্রুটি থাকলে Sync status-এর নির্দেশনা অনুসরণ করুন এবং স্ক্রিনশট ম্যানেজারকে দিন।</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">সার্ভারে কল পাওয়া মানে আপলোড নিশ্চিত; কলের কথোপকথন বা বাস্তব ফোন পরীক্ষা নিশ্চিত নয়।</p>
          </>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void receipt.refetch()} disabled={receipt.isFetching}><RefreshCw className="size-4" />আবার পরীক্ষা</Button>
            {ownPhone && <Button onClick={() => void phone.syncNow()} disabled={phone.syncing || !phone.online}><RefreshCw className="size-4" />Sync now</Button>}
            <Button asChild variant="outline"><Link to="/sync">{ownPhone ? "Sync status খুলুন" : "ফোনে করণীয় দেখুন"}</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}