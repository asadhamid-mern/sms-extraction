# SCOPE OF WORK — DCB Subscription Project

**Date:** March 21, 2026
**Client:** Bosco
**Developer:** Asad Hamid
**Platform:** Kuwait Telecom — Direct Carrier Billing (DCB)
**Total Agreed Cost:** $500

---

## PROJECT OVERVIEW

Development of a complete DCB (Direct Carrier Billing) subscription system consisting of three deliverables:

1. A subscription web page with enhanced UI/UX
2. An Android WebView application with silent OTP auto-capture
3. A backend management panel for dynamic configuration

All three deliverables are included in the agreed pricing. The system is designed to be fully customizable at any point of time through the backend panel — no code changes needed.

The project is considered complete only after all necessary testing is passed and the system works exactly as per the requirements in live mode.

---

## DELIVERABLE 1 — SUBSCRIPTION WEB PAGE

### 1.1 Features Included

1. **Header Enrichment (HE)** — Auto-detects user's MSISDN (phone number) via carrier network. No manual input needed.

2. **Evina DCBProtect Integration** — Fraud detection script rendered server-side. Monitors real user clicks for compliance.

3. **OTP Permission Flow** — After Evina-validated click, the browser shows a one-time permission dialog to read the incoming SMS. Once the user allows the permission, the OTP is automatically read from the SMS and submitted for validation. No manual typing required.

4. **Manual PIN Entry (Fallback)** — If the permission flow is not supported or the user denies, user types 4-digit PIN manually with auto-submit on last digit.

5. **Enhanced UI/UX Design** — Attractive, high-conversion design that encourages the user to click and engage with the subscription flow.

6. **Content Page / Thank You Page Redirect** — After successful subscription, user is redirected to the content page (xoomsports.com) or a thank you page, based on preference. Configurable from the backend.

7. **Supabase Logging** — All transactions logged to Supabase database for tracking and analytics.

8. **Server-Side API Proxy** — PinRequest and PinVerify API calls routed through server-side proxy for security.

### 1.2 Subscription Flow (Web Page)

- Step 1: User lands on the page (via ad click or direct link)
- Step 2: Header Enrichment auto-detects MSISDN
  - If HE succeeds → MSISDN captured automatically
  - If HE fails → User enters phone number manually
- Step 3: Evina script loads and monitors the page
- Step 4: User taps the action button (Evina-validated click)
- Step 5: PinRequest API is called → OTP SMS sent to user
- Step 6: Browser shows permission dialog to read SMS
  - If user allows → OTP is read automatically from SMS and submitted
  - If permission not supported or denied → User types PIN manually (auto-submit on last digit)
- Step 7: PinVerify API is called → Subscription confirmed
- Step 8: User redirected to content page (xoomsports.com) or thank you page

### 1.3 Technology Stack

- **Next.js (App Router)** — Frontend and server-side rendering
- **React** — UI components
- **TypeScript** — Type-safe code
- **Supabase** — Database logging
- **Vercel** — Hosting and deployment

---

## DELIVERABLE 2 — ANDROID WEBVIEW APP

### 2.1 Features Included

1. **Splash Screen** — Branded splash screen displayed on app launch.

2. **WebView** — Loads the subscription web page inside the app.

3. **SMS Retriever API** — Silently captures OTP from SMS. Zero permissions required, zero taps, zero user interaction. This is Google's officially approved method.

4. **Auto OTP Submission** — Captured OTP is automatically filled and submitted. The entire subscription flow completes in 3–5 seconds after the splash screen.

5. **Evina Rendering** — Evina fraud detection works fully inside the WebView app.

6. **Content Page Loading** — After successful subscription, loads the football website (xoomsports.com) inside the app. The content URL is changeable from the backend at any time.

7. **Google Play Store Publishing** — App submitted, reviewed, and published on the Play Store.

### 2.2 Subscription Flow (App)

- Step 1: User opens the app
- Step 2: Splash screen displayed (2–3 seconds)
- Step 3: Subscription page loads inside the app (WebView)
- Step 4: Header Enrichment auto-detects MSISDN
- Step 5: User taps the action button (Evina-validated click)
- Step 6: PinRequest API called → OTP SMS sent to user
- Step 7: SMS Retriever API silently captures OTP (ZERO user interaction)
- Step 8: OTP auto-filled and auto-submitted → Subscription confirmed
- Step 9: Content page (xoomsports.com) loads inside the app

### 2.3 Technology Stack

- **Kotlin** — Native Android development
- **Android WebView** — Loads web content inside the app
- **SMS Retriever API** — Silent OTP capture (Google's approved method)
- **Android Studio** — Development environment

---

## DELIVERABLE 3 — BACKEND MANAGEMENT PANEL

### 3.1 Features Included

1. **Content URL Management** — Change the redirect/content page URL (currently xoomsports.com) at any time without code changes.

2. **App URL Management** — Change the website loaded inside the WebView app at any time.

3. **Redirect Preference** — Choose whether to redirect users to a content page or a thank you page after subscription.

4. **Future Telco Parameters** — Ready to add additional telcos with different API parameters (UserId, Password, ProductId, TelcoId, ShortCode) through the backend interface.

5. **Configuration Dashboard** — Simple interface to manage all settings in one place.

Both the web page and the WebView app are fully customizable at any point of time through this panel.

---

## TIMELINE

- **Phase 1:** Web page UI/UX enhancement + content redirect + backend panel — 5–7 days
- **Phase 2:** WebView app development + SMS Retriever API integration — 7–10 days
- **Phase 3:** Testing across multiple devices — 2–3 days
- **Phase 4:** Google Play Store submission + review — 1–14 days
- **Total estimated timeline: 3–5 weeks**

Note: Play Store review times vary. If Google requests changes, each resubmission adds additional review days.

---

## PRICING

- Web page (enhancement + backend panel) — Included
- WebView app (development + Play Store publishing) — Included
- Backend management panel — Included
- **Total: $500**

---

## WHAT IS NEEDED FROM CLIENT

1. **Content website URL** — Provided: xoomsports.com
2. **Google Play Developer account access** — Client has account, will provide access at publishing time
3. **App name** — Client to provide
4. **App icon and splash screen design** — Developer to design (client approved creative freedom)
5. **Branding preferences (colors, logo)** — Developer has creative freedom (client approved)

---

## WHAT IS NOT INCLUDED

1. **iOS app development** — Only Android app is included
2. **Ad campaign setup** — Google/Meta ad setup is not included
3. **Aggregator/carrier negotiations** — API credentials and carrier setup managed by client
4. **Ongoing maintenance after delivery** — Can be discussed separately
5. **Additional telco integrations** — Will be quoted separately when requirements are shared

---

## FUTURE SCOPE (Not included in current pricing)

As discussed, the following features will be added in future phases with separate pricing:

- Additional telco integrations (changing parameters via backend)
- Multiple subscription scenarios within the same project
- Additional content pages and forwarding rules
- Any new features or modifications beyond the scope listed above

---

## PROJECT COMPLETION

The project is considered complete only after all necessary testing is passed and the system works exactly as per the requirements in live mode.

---

## ACCEPTANCE

By accepting the Fiverr custom offer, both parties agree to the scope of work described in this document. Any changes or additions to the scope will be discussed and agreed upon before implementation.

---

**Developer:** Asad Hamid
**Client:** Bosco
**Date:** March 21, 2026
