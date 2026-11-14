# WinLog roadmap

- [ ] Bring Winstone Pulse staff and real-call records here (requires source-project data export)
- [ ] Request dashboard publication and provide team-phone installation/test steps

- [x] Private company-code setup with manager-selected staff assignment (successful staff activation pending: no staff account exists)
- [x] Signed Winlog Calls v6 APK built and signature verified; dashboard, recap, pending sync ready for publication
- [x] Renamed project and APK label to Winlog Calls; referenced ZIP is the already-inspected kit, no new attachment present

- [x] Backend: accounts, manager role, call log storage
- [x] Web screens: today/week stats, call log, team, phone setup, sign-in
- [x] Android app: SIM call history + WhatsApp call capture + upload
- [x] GitHub Actions job that builds and releases the APK
- [ ] Connect GitHub (user action in Lovable) so the APK build runs
- [x] Restyle app in Winstone navy + gold
- [x] Winstone logo as Android app icon + site icon
- [x] Manager AI assistant: separate saved conversations about team call activity
- [x] Background call uploads while the app is closed
- [x] Rebuild APK with icon + background uploads
- [x] Phone sync status screen: permissions, last SIM/WhatsApp sync, troubleshooting
- [x] GitHub Actions: build + publish signed APK on every app update
- [x] Remove Lovable badge from the live site and Android website shell
- [x] AI summary from manager-provided call records: activity summary + calls needing follow-up
- [x] Quick AI summary on each call card (pattern / follow-up)
- [ ] Connect project to GitHub so every change builds a fresh APK (user action: Project settings → Git)
- [ ] Real-phone test: install APK, SIM + WhatsApp call, confirm closed-app upload (user action; checklist provided)
- [x] Publish the Winstone version
- [x] Agent-focused dashboard with personal call details and manager agent filter
- [x] Signed APK build on every push, with stable latest download
- [ ] Create real manager and team accounts (blocked: user must create first account/invite members via More → Users; agent has no invitation tool)
- [ ] Resolve overdue Pro payment (user action: Plans & credits)
- [x] Rebuild WinLog from this project's Android source and verify shared website URL in the APK

- [x] Manager follow-up queue with resolve
- [x] Phone setup checklist (call history, notifications, battery)
- [x] Manager follow-up viewing and successful-resolution analytics
- [x] Foreground upload analytics: new SIM/WhatsApp calls only, counts without personal details
- [ ] Complete daily-upload goal analytics including closed-app uploads (blocked: analytics supports browser events only, not WorkManager/server uploads)
- [x] Stay signed in on phones
- [x] Dashboard chart: daily calls uploaded by team phones
- [ ] Remove sign-in: owner chose fully open; held back because it would put customer phone numbers on the open internet
- [x] Daily manager digest (AI recap of yesterday on dashboard)
- [ ] Merge all Winstone Connect APK features with WinLog (deferred: latest request focuses on building this site's WinLog APK; source inspected, remaining capabilities recorded in migration ledger)
- [x] Build a fresh signed Android APK using this site's shared screens
- [x] Phone dashboard: live count of calls waiting to upload (native receipts implemented; real-phone acceptance pending)
- [x] Deliver a clean complete source ZIP for rebuilding the final APK (private signing key excluded; build instructions included)
- [ ] Confirm a real phone call appears in dashboard and daily uploads chart (blocked until a team phone uploads a call; current call count is zero)

- [x] Supplied GitHub repository is accessible and contains the Android push-build workflow; Lovable Git sync status remains user-controlled
