import { useCallback, useEffect, useState } from "react";
import { Check, Phone, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WinLogNative } from "@/lib/native";

export function CallPermissionSetup({ native, onGranted }: { native: boolean; onGranted?: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = useCallback(async () => {
    if (!native) return;
    setBusy(true);
    setError(null);
    try {
      const status = await WinLogNative.getStatus();
      setAllowed(status.callLog);
      setCheckedAt(new Date());
    } catch {
      setAllowed(null);
      setCheckedAt(null);
      setError("অনুমতি যাচাই করা যায়নি। আবার পরীক্ষা করুন; সমস্যা থাকলে অ্যাপটি আপডেট করুন।");
    } finally {
      setBusy(false);
    }
  }, [native]);

  useEffect(() => {
    void check();
    const onReturn = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [check]);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      await WinLogNative.requestCallLogPermission();
      const status = await WinLogNative.getStatus();
      setAllowed(status.callLog);
      setCheckedAt(new Date());
      if (status.callLog) onGranted?.();
    } catch {
      setAllowed(null);
      setCheckedAt(null);
      setError("অনুমতি চাওয়া যায়নি। অ্যাপ সেটিংস থেকে অনুমতি দিন, তারপর আবার পরীক্ষা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function openSettings() {
    try {
      await WinLogNative.openAppSettings();
    } catch {
      setError("ফোনের Settings → Apps → Winlog Calls → Permissions → Call logs খুলুন।");
    }
  }

  return (
    <section aria-labelledby="call-permission-heading" className="border-y border-border py-5">
      <div className="flex items-center gap-3">
        <Phone className="size-5 shrink-0 text-accent-foreground" />
        <h2 id="call-permission-heading" className="font-semibold">কল-লগ অনুমতি / Call history access</h2>
      </div>
      <p role="status" aria-live="polite" className="mt-3 font-medium">
        {!native ? "এই ব্রাউজারে ফোনের অনুমতি যাচাই করা যায় না" : busy ? "অনুমতি যাচাই হচ্ছে…" : allowed === true ? "অনুমতি দেওয়া আছে" : allowed === false ? "অনুমতি দেওয়া নেই" : "অনুমতির অবস্থা অজানা"}
      </p>
      {checkedAt && !busy && <p className="mt-1 text-xs text-muted-foreground">সর্বশেষ পরীক্ষা: {checkedAt.toLocaleTimeString("bn-BD")}</p>}
      <p className="mt-3 text-sm text-muted-foreground">SIM কলের নম্বর, সময়, দিক ও রিপোর্ট করা সময়কাল পড়তে এই অনুমতি প্রয়োজন; কথোপকথনের অডিও রেকর্ড করা হয় না।</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>ইনস্টল করা Winlog Calls APK-তে এই সেটআপ স্ক্রিন খুলুন।</li>
        <li>‘অনুমতি দিন’ চাপুন; Android-এর Call logs ও Phone অনুমতির প্রশ্নে ‘Allow’ বেছে নিন।</li>
        <li>প্রশ্ন না এলে ‘অ্যাপ সেটিংস’ → Permissions → Call logs → Allow করুন; Phone অনুমতি চাইলে সেটিও দিন।</li>
        <li>অ্যাপে ফিরে ‘আবার পরীক্ষা’ চাপুন। অনুমতি দেওয়া থাকলে একটি SIM কল শেষ করে ‘Upload now’ চাপুন।</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {allowed !== true && <Button variant="signal" disabled={!native || busy} onClick={() => void request()}><Check />অনুমতি দিন</Button>}
        <Button variant="outline" disabled={!native || busy} onClick={() => void openSettings()}><Settings />অ্যাপ সেটিংস</Button>
        <Button variant="outline" disabled={!native || busy} onClick={() => void check()}><RefreshCw className={busy ? "animate-spin motion-reduce:animate-none" : ""} />আবার পরীক্ষা</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">অনুমতি থাকলেই কল আপলোড বা বাস্তব ফোনের পরীক্ষা সফল প্রমাণিত হয় না। WhatsApp-এর জন্য আলাদা notification access প্রয়োজন।</p>
    </section>
  );
}