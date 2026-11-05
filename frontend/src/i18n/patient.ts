// Patient-facing copy (login gateway, OTP, ABHA consent/card, patient portal) in English and Hindi.
// Static, reviewed strings only: nothing is machine-translated at runtime. These languages apply to this
// UI only; they say nothing about which languages the clinical AI or voice features support.
import { useEffect, useState } from "react";

export type Lang = "en" | "hi";

const en = {
  "lang.label": "Language",
  "lang.en": "English",
  "lang.hi": "हिंदी",

  // Login modal
  "login.title": "Patient Login",
  "login.subtitle": "Log in to see your treatment journey",
  "login.close": "Close login",
  "login.tab.abha": "ABHA (sandbox)",
  "login.tab.mobile": "Mobile OTP",
  "login.tab.qr": "Slip QR",
  "login.qr.unavailable": "QR login is not available in this demo yet. Please log in with Mobile OTP or ABHA.",
  "login.qr.useMobile": "Use Mobile OTP",
  "login.sessionExpired": "Please log in to see your treatment details.",

  // Shared OTP
  "otp.title": "Enter the OTP",
  "otp.label": "6-digit OTP",
  "otp.digit": "OTP digit {n}",
  "otp.resendIn": "Resend OTP in {s}s",
  "otp.resend": "Resend OTP",
  "otp.moreDigits": "{n} more digits — it checks automatically",
  "otp.moreDigit": "1 more digit — it checks automatically",
  "otp.verifying": "Checking…",
  "otp.sandboxTitle": "Sandbox OTP:",
  "otp.sandboxBody": "No SMS is sent in this demo; the code is shown here. Test code:",
  "otp.fill": "Fill it",
  "otp.demoAuth": "Demo authentication",
  "otp.demoAuthBody": "Sandbox OTP for the hackathon demo. This is not secure production login. Demo patient: 98765 43210.",
  "otp.sentTo": "Sent to {to}",

  // Mobile login
  "mobile.heading": "Log in with your mobile",
  "mobile.label": "Registered mobile number",
  "mobile.placeholder": "10-digit mobile",
  "mobile.digits": "{n}/10 digits",
  "mobile.badStart": "Mobile number must start with 6, 7, 8 or 9",
  "mobile.send": "Send OTP",
  "mobile.sending": "Sending…",
  "mobile.change": "Change number",
  "mobile.enter": "Enter Portal",
  "mobile.newPatient": "New patient?",
  "mobile.register": "Register with ABHA",

  // ABHA registration
  "abha.sandboxTag": "ABDM Sandbox",
  "abha.step": "Step {n} of 4",
  "abha.step1": "Identify",
  "abha.step2": "Consent",
  "abha.step3": "OTP",
  "abha.step4": "ABHA",
  "abha.step1.title": "Identify the beneficiary",
  "abha.step1.help": "Enter a test Aadhaar / Virtual ID (or an existing sandbox ABHA) and mobile number.",
  "abha.step2.title": "Explain and record consent",
  "abha.step2.help": "Read each statement to the beneficiary, then tick it.",
  "abha.step3.title": "Enter the OTP",
  "abha.step3.help": "Enter the 6-digit sandbox code shown below.",
  "abha.step4.title": "Synthetic ABHA ready",
  "abha.step4.help": "Demo sandbox ID, not issued by ABDM. Check the details, then enter the portal.",
  "abha.mode.generate": "Generate new",
  "abha.mode.link": "Link existing",
  "abha.id.generate": "Aadhaar number / Virtual ID",
  "abha.id.link": "Sandbox ABHA number / address",
  "abha.id.placeholder.generate": "12-digit Aadhaar or 16-digit VID",
  "abha.id.placeholder.link": "14-digit ABHA or name@sbx",
  "abha.id.digits": "{n}/{of} digits",
  "abha.id.digitsOnly": "Digits only",
  "abha.id.badAadhaar": "This Aadhaar number looks mistyped — please check it",
  "abha.id.okAadhaar": "Aadhaar number looks valid",
  "abha.id.okVid": "Virtual ID recognised",
  "abha.id.okAbhaNumber": "ABHA number recognised",
  "abha.id.okAbhaAddress": "ABHA address recognised",
  "abha.id.badLink": "Use a 14-digit ABHA number or name@sbx",
  "abha.mobile": "Aadhaar-linked mobile (optional)",
  "abha.linkToken": "Existing CerviSetu token (optional)",
  "abha.simulatedTitle": "Simulated verification:",
  "abha.simulatedBody": "This sandbox does not contact UIDAI or ABDM. Use test numbers only. Aadhaar is never stored (only a keyed hash and the last 4 digits).",
  "abha.continue": "Continue to consent",
  "abha.needId": "Enter a valid Aadhaar or Virtual ID to continue",
  "abha.needLinkId": "Enter a valid ABHA number or address to continue",
  "abha.accepted": "{n}/5 accepted",
  "abha.tickAll": "Tick all (after explaining)",
  "abha.clearAll": "Clear all",
  "abha.name": "Beneficiary name",
  "abha.namePlaceholder": "Name as on Aadhaar",
  "abha.nameConsent": "I, {name}, have had the above explained to me and hereby give my consent.",
  "abha.verifyOtp": "Verify with OTP",
  "abha.sendingOtp": "Sending OTP…",
  "abha.needConsents": "Tick {n} more to continue",
  "abha.needName": "Enter the beneficiary's name to continue",
  "abha.demographics": "Demographics",
  "abha.biometrics": "Biometrics",
  "abha.methodsNote": "Demographic and biometric verification need ABDM approval and are not enabled.",
  "abha.methodsTitle": "Requires ABDM approval",
  "abha.changeDetails": "Change details",
  "abha.card": "ABHA card (sandbox)",
  "abha.welcomeBack": "Welcome back",
  "abha.cardLabel": "Synthetic ABHA Sandbox ID — not issued by ABDM",
  "abha.card.number": "Sandbox ABHA number",
  "abha.card.address": "Sandbox ABHA address",
  "abha.card.name": "Full name",
  "abha.card.mobile": "Mobile",
  "abha.card.via": "Verified via",
  "abha.card.simulated": "(simulated)",
  "abha.tokenNoteTitle": "Privacy:",
  "abha.tokenNote": "Your record uses the private code {token}. Name and mobile are kept only in the encrypted vault.",
  "abha.print": "Print / save demo ABHA card",
  "abha.enter": "Enter Portal",
  "abha.consent.share_identity_with_nha":
    "I voluntarily share my Aadhaar / Virtual ID and demographic details with UIDAI and NHA to create my ABHA number and ABHA address.",
  "abha.consent.link_health_records":
    "I consent to my ABHA address / number being used to link my legacy and future government health records.",
  "abha.consent.share_records_with_providers":
    "I authorise sharing my health records with healthcare providers for this treatment encounter.",
  "abha.consent.anonymised_public_health_use":
    "I consent to anonymised use of my health records for public health purposes.",
  "abha.consent.admin_explained_consent":
    "I, the health worker, confirm I have informed and explained the above consents to the beneficiary in a language they understand.",

  // Server error codes
  "err.OTP_INVALID": "That code didn't match. {n} tries left.",
  "err.OTP_EXPIRED": "This code has expired. Tap Resend OTP to get a new one.",
  "err.TOO_MANY_ATTEMPTS": "Too many wrong tries. Please go back and start again.",
  "err.TRANSACTION_CLOSED": "This attempt has ended. Please go back and start again.",
  "err.RESEND_TOO_SOON": "Please wait a little before asking for a new code.",
  "err.TOO_MANY_RESENDS": "Too many new codes requested. Please start again.",
  "err.ALREADY_REGISTERED": "This person already has a sandbox ABHA. Log in with Mobile OTP, or use Link existing with the ABHA number.",
  "err.MOBILE_NOT_REGISTERED": "This mobile number is not registered yet. Please register with ABHA first.",
  "err.ABHA_NOT_FOUND": "No sandbox ABHA found for this number. Try Generate new, or add the CerviSetu token.",
  "err.INVALID_AADHAAR": "This Aadhaar number looks mistyped — please check it.",
  "err.INVALID_MOBILE": "Please enter a valid 10-digit mobile number.",
  "err.CONSENT_REQUIRED": "All five consent statements must be ticked.",
  "err.SIMULATION_DISABLED": "Demo login is switched off on this server.",
  "err.generic": "Something went wrong. Please try again.",
  "err.network": "Could not reach the server. Check your connection and try again.",
  "err.loginWithMobile": "Log in with Mobile OTP →",
  "err.registerAbha": "Register with ABHA →",

  // Portal
  "portal.name": "Patient Portal",
  "portal.logout": "Log out",
  "portal.menu": "Portal menu",
  "portal.loading": "Loading your treatment details…",
  "portal.error.title": "We couldn't load your details",
  "portal.error.body": "No information is shown until it loads correctly. Please try again.",
  "portal.retry": "Try again",
  "portal.forbidden.title": "This record belongs to someone else",
  "portal.forbidden.body": "You can only see your own treatment. Please open your own record or log in again.",
  "portal.openMine": "Open my record",
  "portal.loginAgain": "Log in again",
  "portal.synthetic.badge": "Synthetic demo patient",
  "portal.synthetic.body":
    "This is a hackathon demonstration. The treatment history, schedule and reminders on this page are generated demo data, not real medical records.",
  "portal.hello": "Namaste, {name}",
  "portal.helloNoName": "Namaste",
  "portal.clinic": "Your treatment centre: {name}",
  "portal.progress.title": "Your treatment progress",
  "portal.progress.count": "{done} of {total} treatment sessions done",
  "portal.progress.aria": "{done} of {total} treatment sessions completed",
  "portal.progress.external": "Outside radiation: {done} of {total}",
  "portal.progress.internal": "Internal radiation: {done} of {total}",
  "portal.progress.day": "Today is day {day} of your treatment",
  "portal.progress.expected": "Expected treatment completion: {date}",
  "portal.progress.expectedNone": "Expected completion will be shown once your schedule is set.",
  "portal.progress.disclaimer":
    "Dates may change because of your doctor's decisions, machine availability or approved breaks. This is an estimate, not a guarantee.",
  "portal.next.title": "Next treatment session",
  "portal.next.session": "Session {n} · {kind}",
  "portal.next.none": "No upcoming session is scheduled.",
  "portal.kind.EBRT": "outside radiation",
  "portal.kind.BRACHY": "internal radiation",
  "portal.today": "Today",
  "portal.tomorrow": "Tomorrow",
  "portal.status.title": "How things are going",
  "portal.status.OPTIMAL": "You are on track",
  "portal.status.OPTIMAL.body": "Your sessions are going as planned. Keep coming on your scheduled days.",
  "portal.status.WARNING": "Your treatment may take a little longer than planned",
  "portal.status.WARNING.body": "Please try not to miss sessions. Your care team can help if you have trouble reaching the clinic.",
  "portal.status.BREACH_RISK": "Your treatment may take longer than planned",
  "portal.status.BREACH_RISK.body": "Please talk to your care team about your next session. They are there to help you.",
  "portal.status.COMPLETED": "Your treatment course is complete",
  "portal.status.COMPLETED.body": "Your care team will tell you about follow-up visits.",
  "portal.status.PAUSED": "Your treatment is on an approved break",
  "portal.status.PAUSED.body": "Your doctor approved this break. Your care team will tell you when sessions start again.",
  "portal.status.NOT_STARTED": "Your treatment has not started yet",
  "portal.status.NOT_STARTED.body": "Your first session date will appear here.",
  "portal.missed": "Missed sessions so far: {n}",
  "portal.missedRecent": "You missed your last {n} scheduled sessions. Please contact your clinic.",
  "portal.support.title": "Support from your care team",
  "portal.support.none": "No extra follow-up is needed right now.",
  "portal.support.TIER_1": "Your care team would send you a reminder message.",
  "portal.support.TIER_2": "Your care team is checking in with you by phone.",
  "portal.support.TIER_3": "A health worker (ASHA) would visit to help you get to the clinic.",
  "portal.support.TIER_4": "The district health team would help arrange transport to the clinic.",
  "portal.support.simulated": "In this demo, reminders, calls and visits are simulated. No message, call or visit is actually made.",
  "portal.journey.title": "Your treatment journey",
  "portal.journey.upcoming": "Coming up",
  "portal.journey.history": "Past sessions",
  "portal.journey.empty": "No sessions recorded yet.",
  "portal.journey.syntheticTag": "demo record",
  "portal.event.COMPLETED": "Session done",
  "portal.event.MISSED": "Session missed",
  "portal.event.APPROVED_PAUSE": "Approved break",
  "portal.event.FACILITY_DOWNTIME": "Clinic machine unavailable",
  "portal.event.PLANNED_REST": "Planned rest day",
  "portal.event.UPCOMING": "Scheduled",
  "portal.event.session": "Session {n}",
  "portal.noplan.title": "Your treatment plan isn't ready yet",
  "portal.noplan.body":
    "Once your doctor approves your treatment plan, your sessions and progress will appear here. If you have questions, please ask your clinic.",
  "portal.info.title": "Your details",
  "portal.info.token": "Private patient code",
  "portal.info.abha": "Sandbox ABHA number",
  "portal.info.abhaAddress": "Sandbox ABHA address",
  "portal.info.stage": "Diagnosis (as recorded)",
  "portal.info.stageValue": "Cervical cancer, stage {stage}",
  "portal.info.abhaLabel": "Synthetic ABHA Sandbox ID — not issued by ABDM. Not an official ABHA number.",
  "portal.info.privacy": "Your Aadhaar and mobile number are never shown here.",
};

type Key = keyof typeof en;

const hi: Record<Key, string> = {
  "lang.label": "भाषा",
  "lang.en": "English",
  "lang.hi": "हिंदी",

  "login.title": "मरीज़ लॉगिन",
  "login.subtitle": "अपने इलाज की जानकारी देखने के लिए लॉगिन करें",
  "login.close": "लॉगिन बंद करें",
  "login.tab.abha": "ABHA (सैंडबॉक्स)",
  "login.tab.mobile": "मोबाइल OTP",
  "login.tab.qr": "पर्ची QR",
  "login.qr.unavailable": "इस डेमो में QR से लॉगिन अभी उपलब्ध नहीं है। कृपया मोबाइल OTP या ABHA से लॉगिन करें।",
  "login.qr.useMobile": "मोबाइल OTP से लॉगिन करें",
  "login.sessionExpired": "अपने इलाज की जानकारी देखने के लिए कृपया लॉगिन करें।",

  "otp.title": "OTP डालें",
  "otp.label": "6 अंकों का OTP",
  "otp.digit": "OTP का अंक {n}",
  "otp.resendIn": "{s} सेकंड में OTP फिर से भेजें",
  "otp.resend": "OTP फिर से भेजें",
  "otp.moreDigits": "{n} अंक और — पूरा होते ही अपने आप जाँच होगी",
  "otp.moreDigit": "1 अंक और — पूरा होते ही अपने आप जाँच होगी",
  "otp.verifying": "जाँच हो रही है…",
  "otp.sandboxTitle": "सैंडबॉक्स OTP:",
  "otp.sandboxBody": "इस डेमो में कोई SMS नहीं भेजा जाता; कोड यहीं दिखाया जाता है। टेस्ट कोड:",
  "otp.fill": "भरें",
  "otp.demoAuth": "डेमो लॉगिन",
  "otp.demoAuthBody": "यह हैकाथॉन डेमो का सैंडबॉक्स OTP है। यह असली सुरक्षित लॉगिन नहीं है। डेमो मरीज़: 98765 43210।",
  "otp.sentTo": "{to} पर भेजा गया",

  "mobile.heading": "अपने मोबाइल नंबर से लॉगिन करें",
  "mobile.label": "पंजीकृत मोबाइल नंबर",
  "mobile.placeholder": "10 अंकों का मोबाइल नंबर",
  "mobile.digits": "{n}/10 अंक",
  "mobile.badStart": "मोबाइल नंबर 6, 7, 8 या 9 से शुरू होना चाहिए",
  "mobile.send": "OTP भेजें",
  "mobile.sending": "भेजा जा रहा है…",
  "mobile.change": "नंबर बदलें",
  "mobile.enter": "पोर्टल खोलें",
  "mobile.newPatient": "नए मरीज़ हैं?",
  "mobile.register": "ABHA से पंजीकरण करें",

  "abha.sandboxTag": "ABDM सैंडबॉक्स",
  "abha.step": "चरण {n} / 4",
  "abha.step1": "पहचान",
  "abha.step2": "सहमति",
  "abha.step3": "OTP",
  "abha.step4": "ABHA",
  "abha.step1.title": "लाभार्थी की पहचान",
  "abha.step1.help": "टेस्ट आधार / वर्चुअल आईडी (या पहले से बना सैंडबॉक्स ABHA) और मोबाइल नंबर डालें।",
  "abha.step2.title": "सहमति समझाएँ और दर्ज करें",
  "abha.step2.help": "हर बात लाभार्थी को पढ़कर सुनाएँ, फिर उस पर टिक करें।",
  "abha.step3.title": "OTP डालें",
  "abha.step3.help": "नीचे दिखाया गया 6 अंकों का सैंडबॉक्स कोड डालें।",
  "abha.step4.title": "सिंथेटिक ABHA तैयार है",
  "abha.step4.help": "यह डेमो सैंडबॉक्स आईडी है, ABDM द्वारा जारी नहीं। जानकारी जाँचें, फिर पोर्टल खोलें।",
  "abha.mode.generate": "नया बनाएँ",
  "abha.mode.link": "पहले वाला जोड़ें",
  "abha.id.generate": "आधार नंबर / वर्चुअल आईडी",
  "abha.id.link": "सैंडबॉक्स ABHA नंबर / पता",
  "abha.id.placeholder.generate": "12 अंकों का आधार या 16 अंकों की VID",
  "abha.id.placeholder.link": "14 अंकों का ABHA या name@sbx",
  "abha.id.digits": "{n}/{of} अंक",
  "abha.id.digitsOnly": "सिर्फ़ अंक डालें",
  "abha.id.badAadhaar": "यह आधार नंबर गलत लग रहा है — कृपया जाँचें",
  "abha.id.okAadhaar": "आधार नंबर सही लग रहा है",
  "abha.id.okVid": "वर्चुअल आईडी पहचानी गई",
  "abha.id.okAbhaNumber": "ABHA नंबर पहचाना गया",
  "abha.id.okAbhaAddress": "ABHA पता पहचाना गया",
  "abha.id.badLink": "14 अंकों का ABHA नंबर या name@sbx डालें",
  "abha.mobile": "आधार से जुड़ा मोबाइल (वैकल्पिक)",
  "abha.linkToken": "मौजूदा CerviSetu कोड (वैकल्पिक)",
  "abha.simulatedTitle": "नकली (सिम्युलेटेड) जाँच:",
  "abha.simulatedBody": "यह सैंडबॉक्स UIDAI या ABDM से संपर्क नहीं करता। सिर्फ़ टेस्ट नंबर इस्तेमाल करें। आधार कभी सेव नहीं होता (सिर्फ़ एक सुरक्षित हैश और आखिरी 4 अंक)।",
  "abha.continue": "सहमति पर आगे बढ़ें",
  "abha.needId": "आगे बढ़ने के लिए सही आधार या वर्चुअल आईडी डालें",
  "abha.needLinkId": "आगे बढ़ने के लिए सही ABHA नंबर या पता डालें",
  "abha.accepted": "{n}/5 स्वीकार",
  "abha.tickAll": "सभी पर टिक करें (समझाने के बाद)",
  "abha.clearAll": "सभी हटाएँ",
  "abha.name": "लाभार्थी का नाम",
  "abha.namePlaceholder": "आधार पर लिखा नाम",
  "abha.nameConsent": "मुझे, {name} को, ऊपर दी गई बातें समझाई गई हैं और मैं अपनी सहमति देता/देती हूँ।",
  "abha.verifyOtp": "OTP से सत्यापित करें",
  "abha.sendingOtp": "OTP भेजा जा रहा है…",
  "abha.needConsents": "आगे बढ़ने के लिए {n} और पर टिक करें",
  "abha.needName": "आगे बढ़ने के लिए लाभार्थी का नाम डालें",
  "abha.demographics": "जनसांख्यिकी",
  "abha.biometrics": "बायोमेट्रिक",
  "abha.methodsNote": "जनसांख्यिकी और बायोमेट्रिक जाँच के लिए ABDM की मंज़ूरी चाहिए; ये चालू नहीं हैं।",
  "abha.methodsTitle": "ABDM की मंज़ूरी ज़रूरी है",
  "abha.changeDetails": "जानकारी बदलें",
  "abha.card": "ABHA कार्ड (सैंडबॉक्स)",
  "abha.welcomeBack": "फिर से स्वागत है",
  "abha.cardLabel": "सिंथेटिक ABHA सैंडबॉक्स आईडी — ABDM द्वारा जारी नहीं",
  "abha.card.number": "सैंडबॉक्स ABHA नंबर",
  "abha.card.address": "सैंडबॉक्स ABHA पता",
  "abha.card.name": "पूरा नाम",
  "abha.card.mobile": "मोबाइल",
  "abha.card.via": "जाँच का तरीका",
  "abha.card.simulated": "(सिम्युलेटेड)",
  "abha.tokenNoteTitle": "गोपनीयता:",
  "abha.tokenNote": "आपका रिकॉर्ड निजी कोड {token} से जुड़ा है। नाम और मोबाइल सिर्फ़ एन्क्रिप्टेड वॉल्ट में रखे जाते हैं।",
  "abha.print": "डेमो ABHA कार्ड प्रिंट / सेव करें",
  "abha.enter": "पोर्टल खोलें",
  "abha.consent.share_identity_with_nha":
    "मैं अपना ABHA नंबर और ABHA पता बनाने के लिए अपनी इच्छा से अपना आधार / वर्चुअल आईडी और जनसांख्यिकीय विवरण UIDAI और NHA के साथ साझा करता/करती हूँ।",
  "abha.consent.link_health_records":
    "मैं सहमति देता/देती हूँ कि मेरे ABHA पते / नंबर का उपयोग मेरे पुराने और भविष्य के सरकारी स्वास्थ्य रिकॉर्ड जोड़ने के लिए किया जाए।",
  "abha.consent.share_records_with_providers":
    "मैं इस इलाज के लिए अपने स्वास्थ्य रिकॉर्ड स्वास्थ्य सेवा प्रदाताओं के साथ साझा करने की अनुमति देता/देती हूँ।",
  "abha.consent.anonymised_public_health_use":
    "मैं सार्वजनिक स्वास्थ्य के उद्देश्यों के लिए अपने स्वास्थ्य रिकॉर्ड के पहचान-रहित (अनाम) उपयोग के लिए सहमति देता/देती हूँ।",
  "abha.consent.admin_explained_consent":
    "मैं, स्वास्थ्य कार्यकर्ता, पुष्टि करता/करती हूँ कि मैंने ऊपर दी गई सहमतियों की जानकारी लाभार्थी को उनकी समझ में आने वाली भाषा में दी है और समझाई है।",

  "err.OTP_INVALID": "कोड मेल नहीं खाया। {n} कोशिशें बाकी हैं।",
  "err.OTP_EXPIRED": "इस कोड का समय खत्म हो गया। नया कोड पाने के लिए “OTP फिर से भेजें” दबाएँ।",
  "err.TOO_MANY_ATTEMPTS": "बहुत बार गलत कोड डाला गया। कृपया वापस जाकर फिर से शुरू करें।",
  "err.TRANSACTION_CLOSED": "यह कोशिश खत्म हो गई है। कृपया वापस जाकर फिर से शुरू करें।",
  "err.RESEND_TOO_SOON": "नया कोड माँगने से पहले थोड़ा इंतज़ार करें।",
  "err.TOO_MANY_RESENDS": "बहुत बार नया कोड माँगा गया। कृपया फिर से शुरू करें।",
  "err.ALREADY_REGISTERED": "इस व्यक्ति का सैंडबॉक्स ABHA पहले से बना है। मोबाइल OTP से लॉगिन करें, या ABHA नंबर से “पहले वाला जोड़ें” चुनें।",
  "err.MOBILE_NOT_REGISTERED": "यह मोबाइल नंबर अभी पंजीकृत नहीं है। कृपया पहले ABHA से पंजीकरण करें।",
  "err.ABHA_NOT_FOUND": "इस नंबर का कोई सैंडबॉक्स ABHA नहीं मिला। “नया बनाएँ” चुनें, या CerviSetu कोड डालें।",
  "err.INVALID_AADHAAR": "यह आधार नंबर गलत लग रहा है — कृपया जाँचें।",
  "err.INVALID_MOBILE": "कृपया 10 अंकों का सही मोबाइल नंबर डालें।",
  "err.CONSENT_REQUIRED": "पाँचों सहमतियों पर टिक करना ज़रूरी है।",
  "err.SIMULATION_DISABLED": "इस सर्वर पर डेमो लॉगिन बंद है।",
  "err.generic": "कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।",
  "err.network": "सर्वर से संपर्क नहीं हो पाया। अपना इंटरनेट जाँचें और फिर से कोशिश करें।",
  "err.loginWithMobile": "मोबाइल OTP से लॉगिन करें →",
  "err.registerAbha": "ABHA से पंजीकरण करें →",

  "portal.name": "मरीज़ पोर्टल",
  "portal.logout": "लॉग आउट",
  "portal.menu": "पोर्टल मेनू",
  "portal.loading": "आपके इलाज की जानकारी लाई जा रही है…",
  "portal.error.title": "आपकी जानकारी नहीं मिल पाई",
  "portal.error.body": "जानकारी सही से लोड होने तक कुछ नहीं दिखाया जाएगा। कृपया फिर से कोशिश करें।",
  "portal.retry": "फिर से कोशिश करें",
  "portal.forbidden.title": "यह रिकॉर्ड किसी और का है",
  "portal.forbidden.body": "आप सिर्फ़ अपना इलाज देख सकते हैं। कृपया अपना रिकॉर्ड खोलें या फिर से लॉगिन करें।",
  "portal.openMine": "मेरा रिकॉर्ड खोलें",
  "portal.loginAgain": "फिर से लॉगिन करें",
  "portal.synthetic.badge": "सिंथेटिक डेमो मरीज़",
  "portal.synthetic.body":
    "यह हैकाथॉन का डेमो है। इस पेज पर इलाज का इतिहास, तारीखें और रिमाइंडर डेमो के लिए बनाए गए हैं, ये असली मेडिकल रिकॉर्ड नहीं हैं।",
  "portal.hello": "नमस्ते, {name}",
  "portal.helloNoName": "नमस्ते",
  "portal.clinic": "आपका इलाज केंद्र: {name}",
  "portal.progress.title": "आपके इलाज की प्रगति",
  "portal.progress.count": "{total} में से {done} इलाज सत्र पूरे",
  "portal.progress.aria": "{total} में से {done} इलाज सत्र पूरे हुए",
  "portal.progress.external": "बाहरी विकिरण (सिकाई): {total} में से {done}",
  "portal.progress.internal": "अंदरूनी विकिरण: {total} में से {done}",
  "portal.progress.day": "आज आपके इलाज का दिन {day} है",
  "portal.progress.expected": "इलाज पूरा होने की अनुमानित तारीख: {date}",
  "portal.progress.expectedNone": "आपका कार्यक्रम तय होने पर अनुमानित तारीख यहाँ दिखेगी।",
  "portal.progress.disclaimer":
    "डॉक्टर के फ़ैसलों, मशीन की उपलब्धता या मंज़ूर की गई छुट्टी की वजह से तारीखें बदल सकती हैं। यह सिर्फ़ अनुमान है, पक्का वादा नहीं।",
  "portal.next.title": "अगला इलाज सत्र",
  "portal.next.session": "सत्र {n} · {kind}",
  "portal.next.none": "अभी कोई अगला सत्र तय नहीं है।",
  "portal.kind.EBRT": "बाहरी विकिरण (सिकाई)",
  "portal.kind.BRACHY": "अंदरूनी विकिरण",
  "portal.today": "आज",
  "portal.tomorrow": "कल",
  "portal.status.title": "इलाज कैसा चल रहा है",
  "portal.status.OPTIMAL": "आपका इलाज समय पर चल रहा है",
  "portal.status.OPTIMAL.body": "आपके सत्र योजना के अनुसार हो रहे हैं। अपने तय दिनों पर आते रहें।",
  "portal.status.WARNING": "आपके इलाज में तय समय से थोड़ा ज़्यादा समय लग सकता है",
  "portal.status.WARNING.body": "कोशिश करें कि कोई सत्र न छूटे। क्लिनिक पहुँचने में दिक्कत हो तो आपकी देखभाल टीम मदद कर सकती है।",
  "portal.status.BREACH_RISK": "आपके इलाज में तय समय से ज़्यादा समय लग सकता है",
  "portal.status.BREACH_RISK.body": "अपने अगले सत्र के बारे में अपनी देखभाल टीम से बात करें। वे आपकी मदद के लिए हैं।",
  "portal.status.COMPLETED": "आपका इलाज पूरा हो गया है",
  "portal.status.COMPLETED.body": "आगे की जाँच (फ़ॉलो-अप) के बारे में आपकी देखभाल टीम बताएगी।",
  "portal.status.PAUSED": "आपका इलाज मंज़ूर की गई छुट्टी पर है",
  "portal.status.PAUSED.body": "यह छुट्टी आपके डॉक्टर ने मंज़ूर की है। सत्र फिर से कब शुरू होंगे, आपकी देखभाल टीम बताएगी।",
  "portal.status.NOT_STARTED": "आपका इलाज अभी शुरू नहीं हुआ है",
  "portal.status.NOT_STARTED.body": "आपके पहले सत्र की तारीख यहाँ दिखेगी।",
  "portal.missed": "अब तक छूटे सत्र: {n}",
  "portal.missedRecent": "आपके पिछले {n} तय सत्र छूट गए हैं। कृपया अपने क्लिनिक से संपर्क करें।",
  "portal.support.title": "आपकी देखभाल टीम से मदद",
  "portal.support.none": "अभी किसी अतिरिक्त फ़ॉलो-अप की ज़रूरत नहीं है।",
  "portal.support.TIER_1": "आपकी देखभाल टीम आपको रिमाइंडर संदेश भेजेगी।",
  "portal.support.TIER_2": "आपकी देखभाल टीम फ़ोन पर आपका हाल पूछ रही है।",
  "portal.support.TIER_3": "क्लिनिक पहुँचने में मदद के लिए आशा कार्यकर्ता आपसे मिलने आएँगी।",
  "portal.support.TIER_4": "ज़िला स्वास्थ्य टीम क्लिनिक तक आने-जाने का इंतज़ाम करने में मदद करेगी।",
  "portal.support.simulated": "इस डेमो में संदेश, कॉल और मुलाकात सिर्फ़ दिखाए जाते हैं। असल में कोई संदेश, कॉल या मुलाकात नहीं होती।",
  "portal.journey.title": "आपकी इलाज यात्रा",
  "portal.journey.upcoming": "आने वाले सत्र",
  "portal.journey.history": "पिछले सत्र",
  "portal.journey.empty": "अभी तक कोई सत्र दर्ज नहीं है।",
  "portal.journey.syntheticTag": "डेमो रिकॉर्ड",
  "portal.event.COMPLETED": "सत्र पूरा",
  "portal.event.MISSED": "सत्र छूटा",
  "portal.event.APPROVED_PAUSE": "मंज़ूर की गई छुट्टी",
  "portal.event.FACILITY_DOWNTIME": "क्लिनिक की मशीन उपलब्ध नहीं थी",
  "portal.event.PLANNED_REST": "तय आराम का दिन",
  "portal.event.UPCOMING": "तय है",
  "portal.event.session": "सत्र {n}",
  "portal.noplan.title": "आपकी इलाज योजना अभी तैयार नहीं है",
  "portal.noplan.body":
    "आपके डॉक्टर के इलाज योजना मंज़ूर करने के बाद आपके सत्र और प्रगति यहाँ दिखेंगे। कोई सवाल हो तो अपने क्लिनिक से पूछें।",
  "portal.info.title": "आपकी जानकारी",
  "portal.info.token": "निजी मरीज़ कोड",
  "portal.info.abha": "सैंडबॉक्स ABHA नंबर",
  "portal.info.abhaAddress": "सैंडबॉक्स ABHA पता",
  "portal.info.stage": "बीमारी (जैसा दर्ज है)",
  "portal.info.stageValue": "सर्वाइकल कैंसर, स्टेज {stage}",
  "portal.info.abhaLabel": "सिंथेटिक ABHA सैंडबॉक्स आईडी — ABDM द्वारा जारी नहीं। यह आधिकारिक ABHA नंबर नहीं है।",
  "portal.info.privacy": "आपका आधार और मोबाइल नंबर यहाँ कभी नहीं दिखाया जाता।",
};

const DICT: Record<Lang, Record<Key, string>> = { en, hi };
export const LANG_STORAGE_KEY = "cervisetu_patient_lang";

export type TFn = (key: Key, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

function readLang(): Lang {
  try {
    // The site-wide picker decides, so a page never mixes two languages
    const site = localStorage.getItem("cervisetu_site_lang");
    if (site) return site === "hi" ? "hi" : "en";
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v === "en" || v === "hi") return v;
  } catch {
    // storage unavailable (private mode)
  }
  return "en";
}

const listeners = new Set<(l: Lang) => void>();

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
  listeners.forEach((fn) => fn(lang));
}

// Shared by the login modal and portal so a switch anywhere updates everywhere and survives refresh
export function usePatientLang(): { lang: Lang; setLang: (l: Lang) => void; t: TFn } {
  const [lang, set] = useState<Lang>(readLang);
  useEffect(() => {
    listeners.add(set);
    document.documentElement.lang = lang;
    return () => {
      listeners.delete(set);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { lang, setLang, t: (key, vars) => translate(lang, key, vars) };
}

export type PatientKey = Key;
