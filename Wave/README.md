# Wave

A private iOS app for noticing cravings and urges, and for seeing your own patterns over time.

Wave is not a diet, weight, or calorie tracker. It never asks about food amounts, weight, or your body. It never rates a day as good or bad, has no streaks, no red numbers, and no failure states. "Gave in" and "rode it out" are recorded with identical styling because both are just information.

Everything lives on your phone. There are no network calls of any kind, no accounts, no analytics, and no remote push. Notifications are local, optional, and worded so they never reveal what the app is for.

## Requirements

- Xcode 16 or newer (the project uses the modern folder-synced project format)
- An iPhone running iOS 17 or newer
- A free or paid Apple Developer account signed into Xcode

## Open, sign, and run on your iPhone

1. Open `Wave/Wave.xcodeproj` in Xcode (double-click it, or `File → Open…`).
2. In the Project navigator, click the blue **Wave** project icon at the top, then select the **Wave** target.
3. Open the **Signing & Capabilities** tab.
4. Check **Automatically manage signing** (it should already be on).
5. In the **Team** dropdown, pick your Apple ID team. If none is listed, go to `Xcode → Settings → Accounts`, press **+**, and sign in with your Apple ID first.
6. Change the **Bundle Identifier** from `com.example.WaveUrges` to something unique to you, e.g. `com.yourname.wave`. Two people cannot install the same bundle ID from different teams, so make it yours.
7. Connect your iPhone with a cable. On the phone, tap **Trust** when asked.
8. Enable Developer Mode on the phone if prompted: `Settings → Privacy & Security → Developer Mode`, toggle it on, restart the phone.
9. In Xcode's toolbar, set the run destination to your iPhone (not a simulator).
10. Press **⌘R** (or the ▶ button).
11. First launch only: iOS will block the app until you trust your certificate. On the phone, go to `Settings → General → VPN & Device Management`, tap your Apple ID under *Developer App*, and tap **Trust**.

With a free Apple account the install expires after 7 days; just press ⌘R again to reinstall. Your data is kept — it lives in the app's container, not in the build.

## What's in the app

- **Home** — one large "Log an urge" button and today's entries. Nothing else.
- **Log sheet** — time is captured automatically. You can note what you were doing in the hour before (optional), how you were feeling (bored, tired, stressed, lonely, restless, fine), intensity 1–10, and what you did (rode it out / gave in / something else).
- **Urge surf** — a 20-minute countdown with a slowly breathing wave and rotating calm lines. The screen stays awake. If you leave the app mid-timer, a local notification fires when the 20 minutes end. Afterwards it asks how the intensity changed and saves that.
- **Check-in** — one open question per day, rotating between what set things off, what helped, and what you noticed. Your answer from seven days ago is shown underneath.
- **Patterns** — after five logged urges, plain sentences about your data: most common time of day, most common preceding feeling, how often you rode it out. No charts, no goals.
- **Reframe** — write a harsh thought about yourself and pull it apart into two lines: what actually happened, and the verdict that got attached. The split is suggested automatically but fully editable. Past entries are kept.
- **Settings** (gear icon on Home) — reminder times and the plain-text export.

## Notifications

- Requested only after an explanation screen on first launch; you can also decline and enable later by turning a reminder on in Settings.
- One optional daily check-in reminder at a time you choose.
- One optional second reminder for the hour your own logs cluster around; Settings suggests that hour once there is enough data.
- All copy is an invitation, never a scold.
- If you haven't logged anything for four days or more, Wave replaces the daily reminders with a single quiet note two days out. It reduces frequency when you're away; it never escalates.

## Export

`Settings → Export my logs as text` opens the iOS share sheet with a plain-text document containing every urge, surf session, check-in, and reframe, timestamped. Hand it to a doctor, save it to Files, or AirDrop it to a computer.

## Project layout

```
Wave/
├── Wave.xcodeproj
└── Wave/
    ├── WaveApp.swift            App entry, SwiftData container
    ├── RootView.swift           Onboarding gate and tab bar
    ├── Models/
    │   └── Models.swift         SwiftData models, enums, settings keys
    ├── Support/
    │   ├── Theme.swift          Dark palette and card styling
    │   ├── NotificationManager.swift  All local-notification logic
    │   ├── Patterns.swift       Turns logs into plain sentences
    │   ├── ThoughtSplitter.swift      Fact/verdict split heuristic
    │   └── ExportBuilder.swift  Plain-text export
    ├── Views/
    │   ├── HomeView.swift
    │   ├── LogUrgeSheet.swift
    │   ├── SurfView.swift
    │   ├── CheckInView.swift
    │   ├── PatternsView.swift
    │   ├── ReframeView.swift
    │   ├── SettingsView.swift
    │   └── OnboardingView.swift
    └── Assets.xcassets
```

## Implementation notes

- Persistence is SwiftData (`UrgeLog`, `CheckIn`, `SurfSession`, `ReframeEntry`). The store is created automatically on first run; deleting the app deletes the data.
- Reminder preferences are in `UserDefaults` via `@AppStorage`; `NotificationManager` re-reads them and reschedules whenever the app becomes active, a setting changes, or something is saved.
- The "reduce when quiet" behavior works by stamping a last-activity date on every save. When rescheduling, if that stamp is 4+ days old, the repeating reminders are dropped and one non-repeating gentle note is queued 48 hours out.
- The surf timer stores an end date rather than counting ticks, so backgrounding, relaunching, or lock screen time cannot drift it. `isIdleTimerDisabled` keeps the screen awake only while the timer runs.
- The reframe split is a heuristic (it looks for verdict-like phrases such as "so I", "I always", "which means"). Whatever it suggests, both lines are editable before saving.
- The app is portrait-only, forced dark, with 44pt+ touch targets throughout, and everything important is reachable in the bottom half of the screen.
