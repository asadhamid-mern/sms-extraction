# GoalNowX — Google Play Store Listing Content

---

## APP NAME
```
GoalNowX
```

---

## SHORT DESCRIPTION
*(80 characters max — shown under the app name in search results)*

```
Watch live football matches & get live scores. HD quality, all leagues.
```
*(71 characters)*

---

## FULL DESCRIPTION
*(4000 characters max — shown on the app's Play Store page)*

```
🔴 LIVE FOOTBALL, ANYTIME, ANYWHERE

GoalNowX gives you instant access to live football matches in HD quality. Watch every goal, every tackle, and every moment from the world's biggest leagues — all in one app.

⚽ WHAT YOU GET:
• Live match streaming in HD quality
• All major leagues: Premier League, La Liga, Serie A, Bundesliga, Champions League & more
• Live scores and real-time match updates
• Instant access — no long setup, no complicated sign-up

📱 HOW IT WORKS:
1. Open the app
2. Tap "Start Watching"
3. Verify with a one-time SMS code
4. Enjoy live football instantly

🏆 LEAGUES & COMPETITIONS:
• UEFA Champions League
• Premier League
• La Liga
• Serie A
• Bundesliga
• UEFA Europa League
• And many more international competitions

🔒 SAFE & SECURE:
Your subscription is handled securely through your mobile network operator. No credit card needed — charges applied directly to your phone bill.

📞 SUBSCRIPTION & BILLING:
This app uses Direct Carrier Billing (DCB). Subscription charges are added to your mobile phone bill. Standard operator charges apply. You will receive a one-time SMS verification code to confirm your subscription.

To cancel your subscription, contact your mobile network operator or our support team at goalnowx@gmail.com.

By subscribing, you agree to our Terms & Conditions and Privacy Policy.

📧 SUPPORT: goalnowx@gmail.com
🌐 PRIVACY POLICY: https://sms-extraction.vercel.app/privacy-policy
```

---

## APP CATEGORY
```
Sports
```

---

## TAGS / KEYWORDS
```
football, live football, soccer, live scores, premier league, champions league, sports streaming, live sports, football scores, HD football
```

---

## PRIVACY POLICY URL
```
https://sms-extraction.vercel.app/privacy-policy
```
*(Already deployed — use this URL directly in Play Console)*

---

## CONTENT RATING QUESTIONNAIRE ANSWERS
*(Fill these in Play Console → App Content → Content Rating)*

| Question | Answer |
|---|---|
| Does the app contain violence? | No |
| Does the app contain sexual content? | No |
| Does the app contain profanity? | No |
| Does the app contain user-generated content? | No |
| Does the app allow users to interact with others? | No |
| Does the app share location data? | No |
| Is this app directed at children? | No |
| Target age group | 18+ |

**Expected rating: Everyone / General**

---

## DATA SAFETY FORM ANSWERS
*(Fill these in Play Console → App Content → Data Safety)*

### Data Collected:
| Data Type | Collected | Purpose |
|---|---|---|
| Phone number | Yes | App functionality (SMS OTP verification) |
| Name | No | — |
| Email address | No | — |
| Location | No | — |
| App interactions | No | — |

### Data Practices:
- Is data encrypted in transit? **Yes**
- Can users request data deletion? **Yes** (via goalnowx@gmail.com)
- Is data shared with third parties? **Yes** — mobile network operator only, for subscription verification

---

## SIGNING KEYSTORE SETUP (for Release AAB)
*(One-time setup — do this in Android Studio)*

### Step 1 — Create Keystore:
```
Android Studio → Build → Generate Signed Bundle/APK
→ Android App Bundle
→ Create New Keystore

Key store path:    C:\Users\HP\goalnowx-release-key.jks
Password:          [choose a strong password — SAVE IT SAFELY]
Key alias:         goalnowx
Key password:      [same or different password — SAVE IT SAFELY]
Validity:          25 years
First and last name: GoalNowX
```

### Step 2 — Build Release AAB:
```
→ Select release build variant
→ Finish
→ File saved to: android-app/app/release/app-release.aab
```

### Step 3 — Upload to Play Console:
```
Play Console → [Your App] → Production → Create new release
→ Upload the .aab file
→ Add release notes (see below)
→ Review and Rollout
```

---

## RELEASE NOTES (What's new — shown in Play Store)
*(500 characters max)*

```
Initial release of GoalNowX. Watch live football from the world's biggest leagues including Premier League, Champions League, La Liga and more. HD quality streaming with instant access via your mobile network.
```

---

## STORE ICON
- File: `ic_launcher_foreground_image.png` (in android-app/res/drawable)
- Required size for Play Store: **512×512 PNG**
- The existing file is 1024×1024 — resize to 512×512 before uploading

---

## FEATURE GRAPHIC
- File: `feature-graphic.html` (in this folder)
- Required size: **1024×500 PNG**
- How to export:
  1. Open `feature-graphic.html` in Chrome
  2. Set browser zoom to 100%
  3. Take a screenshot of exactly the 1024×500 area
  4. OR: Right-click → Inspect → Device toolbar → set to 1024×500 → screenshot

---

## CHECKLIST BEFORE SUBMITTING

- [ ] Signed release AAB uploaded (.aab file, NOT .apk)
- [ ] 512×512 app icon uploaded
- [ ] 1024×500 feature graphic uploaded
- [ ] At least 2 phone screenshots uploaded (you have 4 ✅)
- [ ] Short description filled
- [ ] Full description filled
- [ ] Privacy policy URL entered: https://sms-extraction.vercel.app/privacy-policy
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed
- [ ] App category set to: Sports
- [ ] Contact email set to: goalnowx@gmail.com
- [ ] Release notes added
