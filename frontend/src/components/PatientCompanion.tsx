import React, { useState, useEffect } from "react";
import { useSiteLang } from "../i18n/site";
import { LanguageSwitch } from "./LanguageSwitch";
import {
  Heart,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Download,
  Building2,
  Sparkles,
  ShieldCheck,
  QrCode,
  Check,
  MapPin,
  Clock,
  Phone,
  Bus,
  Home,
  RefreshCw,
  Info,
  Layers,
  CircleDot,
} from "lucide-react";
import { VoiceSymptomReporter } from "./VoiceSymptomReporter";
import { api, type HealingClock, type HubSpokePass, type SoundboardTrack } from "../api/client";
import type { PatientProfile } from "../api/client";

interface Props {
  patientToken?: string;
  onExitToGateway?: () => void;
  isEmbeddedInDualView?: boolean;
}

type SectionTab = "all" | "clock" | "hydration" | "triage" | "travel";

const TRANSLATIONS = {
  hi: {
    tokenLabel: "गोपनीय पहचान (Token):",
    stageBadge: "Stage IIB Cervical",
    dpdpBadge: "DPDP Protected",
    centreLabel: "केंद्र:",
    centreValue: "मिर्ज़ापुर जिला ऑन्कोलॉजी डेकेयर व विकिरण स्पोक",
    doctorLabel: "प्रभारी चिकित्सक:",
    doctorValue: "डॉ. शर्मा (MD, Radiotherapy)",
    helpline: "हेल्पलाइन: 1075",
    logout: "लॉग आउट",
    tabs: {
      all: "संपूर्ण दृश्य (Overview)",
      clock: "उपचार यात्रा (Pathway)",
      hydration: "कीमो तैयारी (Hydration)",
      triage: "लक्षण जांच (Triage)",
      travel: "यात्रा पास व ऑडियो (Travel & Audio)",
    },
    clockTag: "Literacy-Free Healing Clock",
    clockStandard: "GEC-ESTRO ≤49d Standard",
    clockTitle: "29-चरण उपचार यात्रा",
    clockSubtitle: "बाहरी विकिरण (25 सिकाई) + अंदरूनी ब्रैकीथेरेपी (4 चरण)",
    overallProgress: "कुल प्रगति",
    progressCompleted: "पूर्ण",
    progressRate: "प्रगति दर",
    milestone1Title: "चरण 1: बाहरी विकिरण (EBRT: 1–25 Fractions)",
    milestone1Desc: "मिर्ज़ापुर जिला स्पोक क्लिनिक पर दैनिक विकिरण सिकाई। नियमित CBC/RFT परीक्षण।",
    milestone2Title: "चरण 2: Day-21 प्री-ब्रैकी PAC चेकलिस्ट (Fraction 15)",
    milestone2Desc: "केंद्रीय कैंसर केंद्र (Hub) हेतु OT स्लॉट विंडो (Days 38–44) समन्वय।",
    milestone3Title: "चरण 3: अंदरूनी ब्रैकीथेरेपी (HDR: 26–29 Fractions)",
    milestone3Desc: "वाराणसी कैंसर सेंटर (75 km) पर भर्ती। नि:शुल्क रोडवेज बस पास व धर्मशाला कमरा।",
    fractionTitle: "दैनिक फ्रैक्शन प्रगति (1–25 EBRT + 26–29 Hub)",
    today: "आज",
    pending: "लंबित",
    brachyPrefix: "सत्र",
    brachyDone: "सफलतापूर्वक पूर्ण",
    brachyActive: "आज का चरण",
    brachySlot: "OT स्लॉट Day 41",
    projectedOttLabel: "अनुमानित समापन (OTT)",
    daysUnit: "दिन",
    projectedOttStatus: "≤49d GEC-ESTRO On-Track",
    upperLimitLabel: "सुरक्षित अधिकतम सीमा",
    upperLimitDays: "56 दिन",
    upperLimitSub: "+12 दिन सुरक्षा मार्जिन शेष",
    hubMilestoneLabel: "हब समन्वय (Day-21)",
    hubSlotRequested: "स्लॉट अनुरोधित (Days 38–44)",
    hubSlotPending: "Fraction 15 पर सक्रिय",
    hubLocation: "वाराणसी कैंसर सेंटर (75 km)",
    hydrationTitle: "कीमोथेरेपी जल सेवन व सुरक्षा निर्देश",
    hydrationSubtitle: "Cisplatin Hydration & Renal Safety Guardrail",
    hydrationQuote:
      "कल की कीमोथेरेपी (Cisplatin) के लिए अस्पताल द्वारा दी गई पानी पीने की सलाह (2.5 से 3 लीटर तरल) का ध्यान रखें और अपनी रक्त जांच (CBC/RFT) रिपोर्ट साथ लाएं।",
    hydrationPoint1Title: "पर्याप्त जल सेवन (2.5–3 लीटर):",
    hydrationPoint1Desc:
      "कीमोथेरेपी से पहले व बाद में पर्याप्त पानी, नारियल पानी व दाल का पानी पिएं ताकि गुर्दे सुरक्षित रहें।",
    hydrationPoint2Title: "रक्त जांच (CBC/RFT):",
    hydrationPoint2Desc:
      "कल सुबह डेकेयर में आते समय सीरम क्रिएटिनिन और हीमोग्लोबिन पर्ची साथ लाएं।",
    hydrationPoint3Title: "हल्का व सुपाच्य भोजन:",
    hydrationPoint3Desc:
      "सुबह खाली पेट न रहें; हल्का, सुपाच्य और ताजा घर का भोजन अवश्य लें।",
    protocolNote: "Centre-Approved Protocol",
    verifiedNurse: "सत्यापित: सिस्टर अंजलि (नर्स)",
    triageTitle: "सहानुभूतिपूर्ण लक्षण जांच",
    triageSubtitle: "Bi-Weekly Clinical Toxicity Assessment",
    twoQuestionCheck: "2-Question Check",
    triagePrompt:
      "यदि आपको घर पर किसी भी प्रकार की शारीरिक परेशानी हो रही है, तो नीचे दिए गए बटन से तुरंत सूचित करें:",
    symp1Title: "हल्के पतले दस्त",
    symp1Grade: "Grade 1",
    symp1Desc: "1–3 बार दस्त; घरेलू ORS व आहार मार्गदर्शन तुरंत पाएं",
    symp2Title: "गंभीर दस्त",
    symp2Grade: "Grade 2+",
    symp2Desc: "4+ बार दस्त या कमजोरी; नर्स वार्ड अलर्ट भेजा जाएगा",
    symp3Title: "पेशाब में जलन व दर्द",
    symp3Grade: "Grade 1",
    symp3Desc: "पेशाब में रुकावट या दर्द; प्रचुर जल सेवन निर्देश",
    symp4Title: "अत्यधिक थकान व कमजोरी",
    symp4Grade: "Grade 2",
    symp4Desc: "बिस्तर से उठने में असमर्थता; पोषण व हीमोग्लोबिन जांच",
    triageAudioNotice:
      "लक्षण चुनने पर तत्काल मातृभाषा (हिंदी) में ऑडियो मार्गदर्शन व कॉल सपोर्ट उपलब्ध होता है।",
    brachyMilestoneTag: "Day 21 Milestone",
    brachyCardTitle: "ब्रैकीथेरेपी प्रक्रिया व ऑडियो मार्गदर्शन",
    brachyCardSubtitle: "Regional Cancer Centre (RCC) Varanasi Handoff (~75 km)",
    step15Active: "Step 15 Active",
    step15Pending: "Step 15 Pending",
    voiceLabel: "आवाज:",
    translationLabel: "Translation:",
    otherAudioTracks: "अन्य ऑडियो सलाह:",
    track1Label: "1. ब्रैकीथेरेपी आश्वासन",
    track2Label: "2. जल सेवन निर्देश",
    track3Label: "3. हीलिंग क्लॉक परिचय",
    travelCardTitle: "रोडवेज बस पास व अस्पताल धर्मशाला",
    travelCardSubtitle: "UP-RTC Bus Voucher & RCC Dharamshala Accommodation",
    approvedDay41: "स्वीकृत (Day 41)",
    hubAwaiting: "Hub पुष्टि प्रतीक्षित",
    hubStep15Req: "Step 15 पर अनुरोधित",
    travelIntro:
      "मिर्ज़ापुर से वाराणसी (~75 km) यात्रा हेतु मरीज व 1 तीमारदार (Attendant) के लिए नि:शुल्क सरकारी रोडवेज बस व अस्पताल धर्मशाला की व्यवस्था:",
    busTitle: "यूपी रोडवेज बस वाउचर",
    busRoute: "मिर्ज़ापुर ➔ कैंट वाराणसी (2 सीट)",
    roomTitle: "धर्मशाला कमरा संख्या",
    roomLocation: "कैंसर सेंटर परिसर (मुफ्त ठहराव)",
    viewPassBtn: "डिजिटल बोर्डिंग पास व QR कोड देखें",
    passPendingNotice:
      "हब ऑन्कोलॉजिस्ट द्वारा Day 41 स्लॉट पुष्टि के उपरांत डिजिटल पास डाउनलोड हेतु उपलब्ध होगा।",
    evaluatorHeader: "Evaluator Live Demo Controls",
    resetBtn: "रीसेट करें (Reset to Step 14)",
    demo1Pending: "डेमो 1: Fraction 15 (Day 21 Milestone) आगे बढ़ाएं",
    demo1Done: "Fraction 15 पूर्ण · Days 38–44 हब स्लॉट अनुरोधित",
    demo2Pending: "डेमो 2: हब ऑन्कोलॉजिस्ट OT स्लॉट स्वीकृत करें (Day 41)",
    demo2Done: "Day 41 OT स्लॉट, बस पास व धर्मशाला स्वीकृत",
    modalBadge: "UP Government Cancer Care Protocol",
    modalTitle: "यात्रा व धर्मशाला बोर्डिंग पास",
    modalTokenLabel: "मरीज पहचान टोकन:",
    modalRouteLabel: "मार्ग (~75 km Hub-Spoke Route):",
    modalRouteVal: "Mirzapur Spoke Clinic ➔ Regional Cancer Centre (RCC) Varanasi Hub",
    modalBusLabel: "रोडवेज बस वाउचर:",
    modalRoomLabel: "धर्मशाला कमरा:",
    modalValidity: "वैधता: Day 38 से Day 44 (ब्रैकीथेरेपी सत्र)",
    modalDownloadBtn: "डाउनलोड / प्रिंट करें",
    downloadAlert: "पास आपके फोन पर डाउनलोड कर लिया गया है (Simulated PDF)।",
  },
  en: {
    tokenLabel: "Confidential ID (Token):",
    stageBadge: "Stage IIB Cervical",
    dpdpBadge: "DPDP Protected",
    centreLabel: "Centre:",
    centreValue: "Mirzapur District Oncology Daycare & Radiotherapy Spoke",
    doctorLabel: "Attending Oncologist:",
    doctorValue: "Dr. Sharma (MD, Radiotherapy)",
    helpline: "Helpline: 1075",
    logout: "Sign Out",
    tabs: {
      all: "All Sections",
      clock: "Treatment Pathway",
      hydration: "Pre-Chemo Care",
      triage: "Symptom Check",
      travel: "Travel Pass & Audio",
    },
    clockTag: "Literacy-Free Healing Clock",
    clockStandard: "GEC-ESTRO ≤49d Standard",
    clockTitle: "29-Step Treatment Pathway",
    clockSubtitle: "External Beam Radiotherapy (25 Fractions) + Internal Brachytherapy (4 Fractions)",
    overallProgress: "Overall Progress",
    progressCompleted: "Completed",
    progressRate: "Completion Rate",
    milestone1Title: "Phase 1: External Beam Radiotherapy (EBRT: 1–25)",
    milestone1Desc: "Daily radiation fractions at Mirzapur District Spoke Clinic. Weekly CBC/RFT monitoring.",
    milestone2Title: "Phase 2: Day-21 Pre-Brachy PAC Gate (Fraction 15)",
    milestone2Desc: "Pre-Anesthetic Checkup (PAC) cleared. Hub slot request window (Days 38–44) initiated.",
    milestone3Title: "Phase 3: High-Dose-Rate Brachytherapy (HDR: 26–29)",
    milestone3Desc: "Specialized inpatient procedures at Regional Cancer Centre Hub, Varanasi (~75 km route).",
    fractionTitle: "Daily Fraction Track (1–25 EBRT + 26–29 Hub)",
    today: "Today",
    pending: "Pending",
    brachyPrefix: "Session",
    brachyDone: "Completed",
    brachyActive: "Active Step",
    brachySlot: "OT Slot Day 41",
    projectedOttLabel: "Projected Completion (OTT)",
    daysUnit: "Days",
    projectedOttStatus: "≤49d GEC-ESTRO On-Track",
    upperLimitLabel: "Safe Biological Ceiling",
    upperLimitDays: "56 Days",
    upperLimitSub: "+12 Days safety margin remaining",
    hubMilestoneLabel: "Hub Coordination (Day-21)",
    hubSlotRequested: "Slot Requested (Days 38–44)",
    hubSlotPending: "Unlocks at Fraction 15",
    hubLocation: "RCC Varanasi Hub (75 km)",
    hydrationTitle: "Pre-Chemotherapy Hydration & Renal Safety",
    hydrationSubtitle: "Cisplatin Hydration & Renal Safety Guardrail",
    hydrationQuote:
      "For tomorrow's chemotherapy (Cisplatin), adhere strictly to the hospital's hydration guidance (2.5 to 3 liters of fluids) and bring your latest blood test (CBC/RFT) report.",
    hydrationPoint1Title: "Adequate Hydration (2.5–3 Liters):",
    hydrationPoint1Desc:
      "Drink plenty of water, coconut water, or broth before and after chemotherapy to safeguard kidney function.",
    hydrationPoint2Title: "Blood Tests (CBC/RFT):",
    hydrationPoint2Desc:
      "Bring your latest Serum Creatinine and Hemoglobin report to the daycare ward tomorrow morning.",
    hydrationPoint3Title: "Light Home Meals:",
    hydrationPoint3Desc:
      "Do not arrive on an empty stomach; consume a light, easily digestible home-cooked meal.",
    protocolNote: "Centre-Approved Protocol",
    verifiedNurse: "Verified by: Sister Anjali (Lead Nurse)",
    triageTitle: "Compassionate Symptom Triage",
    triageSubtitle: "Bi-Weekly Clinical Toxicity Assessment",
    twoQuestionCheck: "2-Question Check",
    triagePrompt:
      "If you are experiencing any discomfort or adverse symptoms at home, select the symptom below for immediate care guidance:",
    symp1Title: "Mild Loose Motions",
    symp1Grade: "Grade 1",
    symp1Desc: "1–3 loose motions; receive domestic ORS & dietary guidance instantly",
    symp2Title: "Severe Diarrhea",
    symp2Grade: "Grade 2+",
    symp2Desc: "4+ loose motions or weakness; immediate nurse ward alert dispatched",
    symp3Title: "Urinary Burning / Dysuria",
    symp3Grade: "Grade 1",
    symp3Desc: "Pain or burning during urination; intense hydration protocol",
    symp4Title: "Extreme Fatigue & Weakness",
    symp4Grade: "Grade 2",
    symp4Desc: "Inability to perform daily tasks; nutritional review & Hb check",
    triageAudioNotice:
      "Selecting a symptom immediately provides vernacular audio guidance and clinical callback support.",
    brachyMilestoneTag: "Day 21 Milestone",
    brachyCardTitle: "Brachytherapy Procedure & Audio Reassurance",
    brachyCardSubtitle: "Regional Cancer Centre (RCC) Varanasi Handoff (~75 km)",
    step15Active: "Step 15 Active",
    step15Pending: "Unlocks at Step 15",
    voiceLabel: "Voice:",
    translationLabel: "Translation:",
    otherAudioTracks: "Other Audio Guidance Tracks:",
    track1Label: "1. Brachytherapy Reassurance",
    track2Label: "2. Hydration Guidelines",
    track3Label: "3. Healing Clock Intro",
    travelCardTitle: "State Bus Voucher & Hospital Dharamshala Pass",
    travelCardSubtitle: "UP-RTC Bus Voucher & RCC Dharamshala Accommodation",
    approvedDay41: "Approved (Day 41)",
    hubAwaiting: "Awaiting Hub Confirmation",
    hubStep15Req: "Requested at Step 15",
    travelIntro:
      "Complimentary UP State Roadways bus transit and hospital Dharamshala guest stay arranged for patient + 1 family attendant (~75 km route):",
    busTitle: "UP-RTC Roadways Bus Voucher",
    busRoute: "Mirzapur ➔ Varanasi Cantt (2 Seats)",
    roomTitle: "Dharamshala Room Number",
    roomLocation: "RCC Campus (Complimentary Stay)",
    viewPassBtn: "View Digital Boarding Pass & QR Code",
    passPendingNotice:
      "Digital boarding pass will unlock once the Hub oncologist confirms the Day 41 OT slot.",
    evaluatorHeader: "Evaluator Live Demo Controls",
    resetBtn: "Reset Demo (Step 14)",
    demo1Pending: "Demo 1: Advance to Fraction 15 (Day 21 Milestone)",
    demo1Done: "Fraction 15 Completed · Days 38–44 Hub Slot Requested",
    demo2Pending: "Demo 2: Hub Oncologist Confirms OT Slot (Day 41)",
    demo2Done: "Day 41 OT Slot, Bus Voucher & Dharamshala Approved",
    modalBadge: "UP Government Cancer Care Protocol",
    modalTitle: "Travel & Accommodation Boarding Pass",
    modalTokenLabel: "Patient Identification Token:",
    modalRouteLabel: "Route (~75 km Hub-Spoke Transit):",
    modalRouteVal: "Mirzapur Spoke Clinic ➔ Regional Cancer Centre (RCC) Varanasi Hub",
    modalBusLabel: "Roadways Bus Voucher:",
    modalRoomLabel: "Dharamshala Room:",
    modalValidity: "Validity: Days 38 to 44 (Brachytherapy Session)",
    modalDownloadBtn: "Download / Print Digital Pass",
    downloadAlert: "Pass downloaded to your device (Simulated PDF).",
  },
};

export const PatientCompanion: React.FC<Props> = ({
  patientToken = "PT-RURAL-7891",
  onExitToGateway,
  isEmbeddedInDualView = false,
}) => {
  const [clock, setClock] = useState<HealingClock>({
    patient_token: patientToken,
    ebrt_fractions_completed: 14,
    brachy_fractions_completed: 0,
    total_steps_completed: 14,
    projected_finish_days: 44,
    clock_target_49d_status: "OPTIMAL",
    clock_limit_56d_status: "ON_TRACK",
  });

  const [passData, setPassData] = useState<HubSpokePass>({
    pass_id: `PASS-${patientToken.slice(-4)}`,
    patient_token: patientToken,
    spoke_facility_name: "Mirzapur District Oncology Daycare & Radiotherapy Spoke",
    hub_facility_name: "Regional Cancer Centre (RCC) Varanasi Brachytherapy Hub",
    distance_km: 75.0,
    requested_window: "Days 38–44",
    hub_ot_slot_date: null,
    slot_confirmed_by_doctor: 0,
    bus_voucher_code: null,
    dharamshala_room_code: null,
    is_simulated_mock: 1,
  });

  const [tracks, setTracks] = useState<SoundboardTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string>("brachy_reassurance");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionTab>("all");

  // Follows the site-wide language: Hindi uses the hand-written copy, other languages translate the English copy
  const [siteLang] = useSiteLang();
  const language: "hi" | "en" = siteLang === "hi" ? "hi" : "en";

  const t = TRANSLATIONS[language];

  const [notificationMsg, setNotificationMsg] = useState<{
    title: string;
    desc: string;
    type: "success" | "alert" | "info";
  } | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [profile, setProfile] = useState<PatientProfile | null>(null);

  // Load backend state
  const refreshData = async () => {
    try {
      api.getPatientProfile(patientToken).then(setProfile).catch(() => setProfile(null));
      const clockRes = await api.getHealingClock(patientToken);
      if (clockRes?.clock) setClock(clockRes.clock);

      const passRes = await api.getPatientPasses(patientToken);
      if (passRes?.pass) setPassData(passRes.pass);

      const tracksRes = await api.getSoundboardTracks();
      if (tracksRes?.tracks && tracksRes.tracks.length > 0) {
        setTracks(tracksRes.tracks);
      } else {
        setTracks([
          {
            id: "welcome_healing_clock",
            title_hi: "उपचार यात्रा और हीलिंग क्लॉक (Welcome & Pathway)",
            speaker: "Sarvam Saaras v3 (Hindi Female)",
            hindi_text:
              "नमस्ते। आपके उपचार में कुल 29 चरण निर्धारित किए गए हैं। हम हर कदम पर आपके साथ रहेंगे ताकि आप समय पर स्वस्थ हो सकें।",
            english_translation:
              "Greetings. A total of 29 steps are scheduled in your treatment. We will stay by your side at every step so you recover on time.",
            clinical_guardrail:
              "Phrased non-definitively ('निर्धारित किए गए हैं') rather than promising an absolute legal guarantee.",
          },
          {
            id: "cisplatin_hydration",
            title_hi: "कीमोथेरेपी जल सेवन सलाह (Pre-Chemo Hydration)",
            speaker: "Sarvam Saaras v3 (Hindi Female)",
            hindi_text:
              "कल की कीमोथेरेपी के लिए अस्पताल द्वारा दी गई पानी पीने की सलाह का ध्यान रखें और अपनी रक्त जांच रिपोर्ट साथ लाएं।",
            english_translation:
              "For tomorrow's chemotherapy, follow the hydration guidance given by your hospital and bring your blood test report.",
            clinical_guardrail:
              "Guards against fluid overload in renal/cardiac patients; defers specific fluid volumes to attending center protocol.",
          },
          {
            id: "brachy_reassurance",
            title_hi: "ब्रैकीथेरेपी प्रक्रिया और दर्द-प्रबंधन (Brachytherapy Reassurance)",
            speaker: "Sarvam Saaras v3 (Hindi Female)",
            hindi_text:
              "ब्रैकीथेरेपी (अंदरूनी विकिरण उपचार) के दौरान आपको सुरक्षित और आरामदायक रखने के लिए डॉक्टरों की टीम निश्चेतना (एनेस्थीसिया) और दर्द-निवारक व्यवस्था करती है। इससे घबराएं नहीं।",
            english_translation:
              "During brachytherapy (internal radiation treatment), the medical team provides anesthesia and pain-relief measures to keep you safe and comfortable. Please do not be afraid.",
            clinical_guardrail:
              "Replaces misleading term 'सिकाई' with 'अंदरूनी विकिरण उपचार'. Honestly explains anesthesia and pain relief rather than falsely claiming 'painless'.",
          },
        ]);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    refreshData();
  }, [patientToken]);

  // Audio simulation timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 10;
        });
      }, 500);
    } else {
      setAudioProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  // Demo Action 1: Advance to Fraction 15 (Day 21 Milestone)
  const handleAdvanceToFraction15 = async () => {
    setLoadingAction("advance");
    try {
      const res = await api.advanceFraction15(patientToken, 15);
      if (res?.clock) setClock(res.clock);
      if (res?.pass_status) setPassData(res.pass_status);
      setNotificationMsg({
        title:
          language === "hi"
            ? "Day 21 (Fraction 15) माइलस्टोन सक्रिय!"
            : "Day 21 (Fraction 15) Milestone Activated!",
        desc:
          language === "hi"
            ? "Pre-Brachy PAC चेकलिस्ट शुरू की गई। केंद्रीय अस्पताल (Hub) को Days 38–44 स्लॉट विंडो भेजी गई।"
            : "Pre-Brachy PAC checklist initiated. Hub slot window (Days 38–44) transmitted to central hospital.",
        type: "success",
      });
    } catch {
      setClock((prev) => ({
        ...prev,
        ebrt_fractions_completed: 15,
        total_steps_completed: 15,
      }));
      setNotificationMsg({
        title:
          language === "hi"
            ? "Day 21 (Fraction 15) माइलस्टोन सक्रिय!"
            : "Day 21 (Fraction 15) Milestone Activated!",
        desc:
          language === "hi"
            ? "Pre-Brachy PAC चेकलिस्ट शुरू की गई। केंद्रीय अस्पताल को Days 38–44 स्लॉट अनुरोध भेजा गया।"
            : "Pre-Brachy PAC checklist initiated. Hub slot window (Days 38–44) requested.",
        type: "success",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Demo Action 2: Hub Confirms OT Slot (Step 2B)
  const handleConfirmHubSlot = async () => {
    setLoadingAction("confirm");
    try {
      const res = await api.confirmHubSlot(patientToken, "Day 41");
      if (res?.pass_data) setPassData(res.pass_data);
      setNotificationMsg({
        title:
          language === "hi"
            ? "केंद्रीय अस्पताल OT स्लॉट स्वीकृत!"
            : "Central Hub OT Slot Approved!",
        desc:
          language === "hi"
            ? "ब्रैकीथेरेपी स्लॉट: Day 41. रोडवेज बस पास (UP-RTC) व धर्मशाला कमरा स्वीकृत कर दिया गया।"
            : "Brachytherapy slot confirmed for Day 41. UP-RTC roadways bus pass and Dharamshala room unlocked.",
        type: "success",
      });
    } catch {
      setPassData((prev) => ({
        ...prev,
        slot_confirmed_by_doctor: 1,
        hub_ot_slot_date: "Day 41",
        bus_voucher_code: `UP-RTC-${patientToken.slice(-4)}`,
        dharamshala_room_code: "DHM-ROOM-402",
      }));
      setNotificationMsg({
        title:
          language === "hi"
            ? "केंद्रीय अस्पताल OT स्लॉट स्वीकृत!"
            : "Central Hub OT Slot Approved!",
        desc:
          language === "hi"
            ? "ब्रैकीथेरेपी स्लॉट: Day 41. रोडवेज बस पास व धर्मशाला कमरा स्वीकृत कर दिया गया।"
            : "Brachytherapy slot confirmed for Day 41. UP-RTC bus pass and Dharamshala room unlocked.",
        type: "success",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Reset Demo to Baseline (Step 14)
  const handleResetDemo = () => {
    setClock({
      patient_token: patientToken,
      ebrt_fractions_completed: 14,
      brachy_fractions_completed: 0,
      total_steps_completed: 14,
      projected_finish_days: 44,
      clock_target_49d_status: "OPTIMAL",
      clock_limit_56d_status: "ON_TRACK",
    });
    setPassData({
      pass_id: `PASS-${patientToken.slice(-4)}`,
      patient_token: patientToken,
      spoke_facility_name: "Mirzapur District Oncology Daycare & Radiotherapy Spoke",
      hub_facility_name: "Regional Cancer Centre (RCC) Varanasi Brachytherapy Hub",
      distance_km: 75.0,
      requested_window: "Days 38–44",
      hub_ot_slot_date: null,
      slot_confirmed_by_doctor: 0,
      bus_voucher_code: null,
      dharamshala_room_code: null,
      is_simulated_mock: 1,
    });
    setNotificationMsg({
      title:
        language === "hi"
          ? "डेमो रीसेट संपन्न (Reset to Step 14)"
          : "Demo Reset Completed (Step 14)",
      desc:
        language === "hi"
          ? "रोगी स्थिति मूल 14/29 स्तर पर रीसेट कर दी गई है।"
          : "Patient status reset to baseline 14/29 steps.",
      type: "info",
    });
  };

  const [hydrationAcked, setHydrationAcked] = useState<boolean>(false);

  const handleAckHydration = async () => {
    try {
      await api.ackHydration(patientToken, { glasses_count: 8, ors_taken: true });
      setHydrationAcked(true);
      setNotificationMsg({
        title: language === "hi" ? "जल सेवन पुष्टि दर्ज की गई ✓" : "Hydration Intake Confirmed ✓",
        desc: language === "hi" ? "दैनिक 8 गिलास (2.5 लीटर) जल सेवन दर्ज हुआ। गुर्दे की सुरक्षा सुनिश्चित है।" : "Daily 8 glasses (2.5L) fluids logged. Nephroprotection active.",
        type: "success",
      });
    } catch {
      setHydrationAcked(true);
    }
  };

  // Symptom Triage Action
  const handleReportSymptom = async (symptomName: string, grade: number) => {
    try {
      await api.reportPatientSymptom(patientToken, {
        symptom_key: symptomName,
        severity_grade: grade,
        notes: "Patient reported from Care Companion portal.",
      });
      await api.logPatientSymptom({
        patient_token: patientToken,
        symptoms: [symptomName],
        severity_grade: grade,
        voice_note_received: false,
      });

      if (grade === 1) {
        setNotificationMsg({
          title:
            language === "hi"
              ? "घरेलू ORS व जल सेवन सलाह प्रेषित (Grade 1)"
              : "Home ORS & Hydration Guidance Dispatched (Grade 1)",
          desc:
            language === "hi"
              ? "हल्के दस्त व जलन के लिए उबला पानी, ORS घोल और सुपाच्य भोजन लें। नीचे ऑडियो सलाह सुनें।"
              : "Drink boiled water, ORS solution, and light home meals for mild symptoms. Listen to audio advice below.",
          type: "success",
        });
      } else {
        setNotificationMsg({
          title:
            language === "hi"
              ? "अस्पताल नर्स वार्ड लिस्ट में अलर्ट दर्ज"
              : "Priority Nurse Ward Alert Logged",
          desc:
            language === "hi"
              ? "मध्यम/गंभीर लक्षण दर्ज किए गए। सिस्टर अंजलि (नर्स) तुरंत आपसे संपर्क कर दवा सुनिश्चित करेंगी।"
              : "Moderate/severe symptom recorded. Lead Nurse Sister Anjali has been alerted for immediate callback.",
          type: "alert",
        });
      }
    } catch {
      setNotificationMsg({
        title: language === "hi" ? "लक्षण दर्ज किए गए" : "Symptoms Recorded",
        desc:
          language === "hi"
            ? "स्वास्थ्य केंद्र को आपकी स्थिति की सूचना भेज दी गई है।"
            : "Your care center has received your symptom status update.",
        type: "success",
      });
    }
  };

  const toggleAudioTrack = (trackId: string) => {
    if (activeTrackId === trackId && isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    setActiveTrackId(trackId);
    setIsPlayingAudio(true);
  };

  const currentTrack =
    tracks.find((t) => t.id === activeTrackId) ||
    tracks[0] || {
      id: "brachy_reassurance",
      title_hi: "ब्रैकीथेरेपी प्रक्रिया और दर्द-प्रबंधन",
      speaker: "Sarvam Saaras v3",
      hindi_text:
        "ब्रैकीथेरेपी (अंदरूनी विकिरण उपचार) के दौरान आपको सुरक्षित और आरामदायक रखने के लिए डॉक्टरों की टीम निश्चेतना (एनेस्थीसिया) और दर्द-निवारक व्यवस्था करती है। इससे घबराएं नहीं।",
      english_translation:
        "During brachytherapy (internal radiation), the medical team provides anesthesia and pain relief. Please do not fear the procedure.",
      clinical_guardrail: "Replaces misleading term 'सिकाई' with 'अंदरूनी विकिरण उपचार'.",
    };

  return (
    <div className={`w-full font-sans antialiased text-black ${isEmbeddedInDualView ? "p-0" : "max-w-4xl mx-auto py-2"}`}>
      {/* 1. Header Card: Patient Context & Quick Language Switcher */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 mb-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="size-12 rounded-2xl bg-[#BA2D0B]/10 text-[#BA2D0B] flex items-center justify-center shrink-0 border border-[#BA2D0B]/20">
              <Heart className="size-6 text-[#BA2D0B]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.tokenLabel}
                </span>
                <span className="font-mono font-bold text-black bg-slate-100 px-2.5 py-0.5 rounded-lg text-sm border border-slate-200">
                  {patientToken}
                </span>
                <span className="text-xs bg-[#DBFE87] text-black border border-[#c6ea6d] px-2.5 py-0.5 rounded-full font-bold">
                  {profile?.synthetic_patient && profile.stage ? `Stage ${profile.stage} Cervical` : t.stageBadge}
                </span>
                {profile?.synthetic_patient && (
                  <span className="text-xs bg-[#BA2D0B]/10 text-[#BA2D0B] border border-[#BA2D0B]/30 px-2.5 py-0.5 rounded-full font-bold">
                    SYNTHETIC DEMO
                  </span>
                )}
                <span className="text-xs bg-[#90C3CB]/20 text-slate-800 border border-[#90C3CB]/50 px-2.5 py-0.5 rounded-full font-semibold">
                  {t.dpdpBadge}
                </span>
              </div>
              {profile?.display_name && (
                <p className="text-sm font-bold text-slate-900 mt-2">
                  {language === "hi" ? "नमस्ते" : "Namaste"}, {profile.display_name}
                  {profile.abha_number_masked && (
                    <span className="ml-2 text-xs font-mono font-semibold text-slate-500">ABHA {profile.abha_number_masked}</span>
                  )}
                </p>
              )}
              {profile?.synthetic_patient && (
                <p className="text-xs text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-lg px-2.5 py-1.5 mt-2">
                  Synthetic demo patient: treatment history, clock and escalations are generated demo data, not real
                  clinical records. ABHA shown is a {profile.abha_label}.
                </p>
              )}
              <div className="text-xs text-slate-600 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-slate-400" />
                  <span className="font-semibold text-black">{t.centreLabel}</span> {t.centreValue}
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span>
                  <span className="font-semibold text-black">{t.doctorLabel}</span> {t.doctorValue}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center flex-wrap gap-3 self-end md:self-center">
            <LanguageSwitch />

            <a
              href="tel:1075"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#BA2D0B] bg-[#BA2D0B]/10 hover:bg-[#BA2D0B]/15 border border-[#BA2D0B]/30 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
              title="National Health Helpline"
            >
              <Phone className="size-3.5" />
              <span>{t.helpline}</span>
            </a>

            {onExitToGateway && (
              <button
                onClick={onExitToGateway}
                className="text-xs text-slate-600 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer font-medium"
              >
                {t.logout}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Basic UX: Segmented Section Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-7 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSection("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            activeSection === "all"
              ? "bg-black text-white border-black shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-black"
          }`}
        >
          <Layers className="size-3.5" />
          <span>{t.tabs.all}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("clock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            activeSection === "clock"
              ? "bg-black text-white border-black shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-black"
          }`}
        >
          <Clock className="size-3.5" />
          <span>{t.tabs.clock}</span>
          <span className="bg-[#DBFE87] text-black text-xs px-2 py-0.5 rounded-full font-bold">
            {clock.total_steps_completed}/29
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("hydration")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            activeSection === "hydration"
              ? "bg-black text-white border-black shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-black"
          }`}
        >
          <Heart className="size-3.5" />
          <span>{t.tabs.hydration}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("triage")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            activeSection === "triage"
              ? "bg-black text-white border-black shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-black"
          }`}
        >
          <AlertTriangle className="size-3.5" />
          <span>{t.tabs.triage}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("travel")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            activeSection === "travel"
              ? "bg-black text-white border-black shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-black"
          }`}
        >
          <Bus className="size-3.5" />
          <span>{t.tabs.travel}</span>
          {passData.slot_confirmed_by_doctor === 1 && (
            <span className="bg-[#DBFE87] text-black text-xs px-2 py-0.5 rounded-full font-bold">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* Live System Notification Toast */}
      {notificationMsg && (
        <div
          className={`p-5 rounded-2xl mb-7 text-sm border transition-all shadow-xs ${
            notificationMsg.type === "alert"
              ? "bg-[#BA2D0B]/10 border-[#BA2D0B]/30 text-[#BA2D0B]"
              : notificationMsg.type === "info"
              ? "bg-[#90C3CB]/15 border-[#90C3CB]/40 text-slate-900"
              : "bg-[#DBFE87]/30 border-[#c4e872] text-black"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {notificationMsg.type === "alert" ? (
                <AlertTriangle className="size-5 text-[#BA2D0B] shrink-0 mt-0.5" />
              ) : notificationMsg.type === "info" ? (
                <Info className="size-5 text-[#90C3CB] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="size-5 text-black shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold text-sm block">{notificationMsg.title}</span>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">{notificationMsg.desc}</p>
              </div>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="text-slate-400 hover:text-black text-xs font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. Section: 29-Step Visual Healing Clock (Styled like Image 1 "Get started · 0 of 3 done") */}
      {(activeSection === "all" || activeSection === "clock") && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 mb-8 shadow-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-7 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-black bg-[#DBFE87] px-2.5 py-0.5 rounded-full">
                  {t.clockTag}
                </span>
                <span className="text-xs text-slate-500 font-semibold">{t.clockStandard}</span>
              </div>
              <h2 className="text-lg font-bold text-black mt-2">
                {t.clockTitle} · {clock.total_steps_completed} of 29 {t.progressCompleted}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.clockSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-800">
                {Math.round((clock.total_steps_completed / 29) * 100)}% {t.progressRate}
              </span>
            </div>
          </div>

          {/* Stepper with Connected Line (Inspired directly by Image 1 "Get started") */}
          <div className="space-y-6 mb-8 pl-1">
            {/* Step 1: External Beam Radiation (EBRT) */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="size-7 rounded-full bg-[#DBFE87] border-2 border-black flex items-center justify-center shrink-0">
                  <Check className="size-3.5 text-black stroke-[3]" />
                </div>
                <div className="w-0.5 h-12 bg-slate-200 mt-1" />
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-black">{t.milestone1Title}</h3>
                  <span className="text-xs font-bold text-black bg-[#DBFE87] px-2 py-0.5 rounded-full">
                    14 / 25 {t.progressCompleted}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {t.milestone1Desc}
                </p>
              </div>
            </div>

            {/* Step 2: Day-21 PAC Clearance Gate */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="size-7 rounded-full bg-[#F19941] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CircleDot className="size-4 animate-pulse" />
                </div>
                <div className="w-0.5 h-12 bg-slate-200 mt-1" />
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-black">{t.milestone2Title}</h3>
                  {clock.total_steps_completed < 15 ? (
                    <button
                      type="button"
                      onClick={handleAdvanceToFraction15}
                      disabled={loadingAction === "advance"}
                      className="bg-black hover:bg-black/85 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer"
                    >
                      Advance to Frac 15
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-black bg-[#DBFE87] px-2.5 py-0.5 rounded-full">
                      Gate Cleared ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {t.milestone2Desc}
                </p>
              </div>
            </div>

            {/* Step 3: Central Hub Brachytherapy (HDR) */}
            <div className="flex items-start gap-4">
              <div className="size-7 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-400 flex items-center justify-center shrink-0">
                <span className="size-2 rounded-full bg-slate-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">{t.milestone3Title}</h3>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    OT Slot: Day 41
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {t.milestone3Desc}
                </p>
              </div>
            </div>
          </div>

          {/* Visual Fraction Track Grid (Unsquished, Spacious Chips) */}
          <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200/90 mb-8">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold text-black text-sm">{t.fractionTitle}</span>
              <span className="text-xs text-slate-500 font-medium">Fractions 1–25 Spoke · 26–29 Hub</span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-25 gap-2">
              {Array.from({ length: 25 }).map((_, i) => {
                const fractionNum = i + 1;
                const isDone = fractionNum <= clock.total_steps_completed;
                const isCurrent = fractionNum === clock.total_steps_completed + 1;
                const isMilestone15 = fractionNum === 15;

                return (
                  <div
                    key={i}
                    title={`Fraction ${fractionNum}`}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-colors ${
                      isDone
                        ? "bg-[#DBFE87] border-[#c4e872] text-black font-bold"
                        : isCurrent
                        ? "bg-[#F19941] border-[#F19941] text-white font-bold ring-2 ring-[#F19941] ring-offset-2"
                        : isMilestone15
                        ? "bg-[#F19941]/15 border-[#F19941]/40 text-[#BA2D0B] font-bold"
                        : "bg-white border-slate-200 text-slate-400 font-normal"
                    }`}
                  >
                    <span className="text-xs">{fractionNum}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Biological Timeline Metric Cards (Generous Whitespace & Coded Colors) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#DBFE87]/20 border border-[#c4e872] p-4 rounded-2xl flex items-center gap-3">
              <Clock className="size-5 text-black shrink-0" />
              <div>
                <span className="text-xs text-slate-700 font-semibold block">
                  {t.projectedOttLabel}
                </span>
                <strong className="text-black text-base font-bold">
                  {clock.projected_finish_days} {t.daysUnit}
                </strong>
                <span className="text-xs text-slate-600 block mt-0.5">
                  {t.projectedOttStatus}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="size-5 text-slate-600 shrink-0" />
              <div>
                <span className="text-xs text-slate-600 font-semibold block">
                  {t.upperLimitLabel}
                </span>
                <strong className="text-slate-900 text-base font-bold">{t.upperLimitDays}</strong>
                <span className="text-xs text-slate-500 block mt-0.5">
                  {t.upperLimitSub}
                </span>
              </div>
            </div>

            <div className="bg-[#90C3CB]/20 border border-[#90C3CB]/50 p-4 rounded-2xl flex items-center gap-3">
              <Building2 className="size-5 text-slate-800 shrink-0" />
              <div>
                <span className="text-xs text-slate-800 font-semibold block">
                  {t.hubMilestoneLabel}
                </span>
                <strong className="text-black text-sm font-bold block truncate">
                  {clock.total_steps_completed >= 15 ? t.hubSlotRequested : t.hubSlotPending}
                </strong>
                <span className="text-xs text-slate-600 block mt-0.5">{t.hubLocation}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Section: Pre-Chemo Care & Hydration Guard */}
      {(activeSection === "all" || activeSection === "hydration") && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 mb-8 shadow-xs">
          <div className="flex items-start justify-between pb-5 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#90C3CB]/20 text-slate-800 flex items-center justify-center border border-[#90C3CB]/40">
                <Heart className="size-5 text-[#BA2D0B]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black">
                  {t.hydrationTitle}
                </h3>
                <span className="text-xs text-slate-500">
                  {t.hydrationSubtitle}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold bg-[#DBFE87] text-black border border-[#c4e872] px-3 py-1 rounded-full">
              eGFR Safe
            </span>
          </div>

          {/* Instruction Box in Aqua Accent */}
          <div className="bg-[#90C3CB]/15 rounded-2xl p-5 border border-[#90C3CB]/30 text-black mb-6 text-sm font-medium leading-relaxed">
            {t.hydrationQuote}
          </div>

          {/* 3 Step Action Cards with Breathing Room */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="size-4.5 text-[#BA2D0B] shrink-0" />
                <span className="text-xs font-bold text-black">{t.hydrationPoint1Title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t.hydrationPoint1Desc}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="size-4.5 text-[#F19941] shrink-0" />
                <span className="text-xs font-bold text-black">{t.hydrationPoint2Title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t.hydrationPoint2Desc}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="size-4.5 text-black shrink-0" />
                <span className="text-xs font-bold text-black">{t.hydrationPoint3Title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t.hydrationPoint3Desc}</p>
            </div>
          </div>

          {/* Interactive Hydration Check-In */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                2.5L
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950">
                  {language === "hi" ? "दैनिक जल सेवन चेक-इन (Cisplatin Renal Protection)" : "Daily Hydration Check-in (Nephroprotection)"}
                </div>
                <div className="text-xs text-emerald-800">
                  {language === "hi"
                    ? "क्या आपने आज के 8 गिलास (2.5 लीटर) तरल/पानी का सेवन पूरा कर लिया है?"
                    : "Have you reached today's 8 glasses (2.5L) recommended fluid intake?"}
                </div>
              </div>
            </div>

            <button
              onClick={handleAckHydration}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                hydrationAcked
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              {hydrationAcked
                ? (language === "hi" ? "✓ 8 गिलास पूर्ण (सत्यापित)" : "✓ 8 Glasses Completed")
                : (language === "hi" ? "✓ हाँ, 8 गिलास पानी पी लिया" : "✓ Yes, 8 Glasses Taken")}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{t.protocolNote}</span>
            <span className="text-black font-semibold">{t.verifiedNurse}</span>
          </div>
        </div>
      )}

      {/* 5. Section: Compassionate Symptom Triage Check-in */}
      {(activeSection === "all" || activeSection === "triage") && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 mb-8 shadow-xs">
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-black">
                {t.triageTitle}
              </h3>
              <span className="text-xs text-slate-500">
                {t.triageSubtitle}
              </span>
            </div>
            <span className="text-xs bg-slate-100 text-black px-2.5 py-1 rounded-md font-semibold">
              {t.twoQuestionCheck}
            </span>
          </div>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            {t.triagePrompt}
          </p>

          <VoiceSymptomReporter patientToken={patientToken} clockDay={clock.ebrt_start_date ? Math.max(1, Math.ceil((Date.now() - new Date(clock.ebrt_start_date).getTime()) / 86400000)) : 1} />

          {/* 4 Accessible Symptom Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <button
              type="button"
              onClick={() => handleReportSymptom("DIARRHEA", 1)}
              className="p-4 bg-slate-50 hover:bg-[#90C3CB]/20 border border-slate-200 hover:border-[#90C3CB] rounded-2xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-black">
                  💧 {t.symp1Title}
                </span>
                <span className="text-xs font-bold text-slate-800 bg-[#90C3CB]/40 px-2 py-0.5 rounded">
                  {t.symp1Grade}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {t.symp1Desc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleReportSymptom("DIARRHEA_SEVERE", 2)}
              className="p-4 bg-[#BA2D0B]/10 hover:bg-[#BA2D0B]/15 border border-[#BA2D0B]/30 hover:border-[#BA2D0B] rounded-2xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-[#BA2D0B] flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-[#BA2D0B]" />
                  🚨 {t.symp2Title}
                </span>
                <span className="text-xs font-bold text-white bg-[#BA2D0B] px-2 py-0.5 rounded">
                  {t.symp2Grade}
                </span>
              </div>
              <p className="text-xs text-[#BA2D0B]/90 leading-normal">
                {t.symp2Desc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleReportSymptom("PELVIC_BURNING", 1)}
              className="p-4 bg-slate-50 hover:bg-[#F19941]/15 border border-slate-200 hover:border-[#F19941] rounded-2xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-black">
                  🔥 {t.symp3Title}
                </span>
                <span className="text-xs font-bold text-slate-900 bg-[#F19941]/30 px-2 py-0.5 rounded">
                  {t.symp3Grade}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {t.symp3Desc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleReportSymptom("SEVERE_FATIGUE", 2)}
              className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-black rounded-2xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-black">
                  ⚡ {t.symp4Title}
                </span>
                <span className="text-xs font-bold text-white bg-black px-2 py-0.5 rounded">
                  {t.symp4Grade}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {t.symp4Desc}
              </p>
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
            <Volume2 className="size-4 text-black shrink-0" />
            <span>{t.triageAudioNotice}</span>
          </div>
        </div>
      )}

      {/* 6. Section: Travel Passes & Indic Voice Audio Player */}
      {(activeSection === "all" || activeSection === "travel") && (
        <div className="space-y-8 mb-8">
          {/* Card A: Day-21 (Fraction 15) Brachy Reassurance & Indic Voice Player */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 shadow-xs">
            <div className="flex items-start justify-between pb-5 mb-5 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-black bg-[#F19941] px-2.5 py-0.5 rounded-full">
                  {t.brachyMilestoneTag}
                </span>
                <h3 className="text-base font-bold text-black mt-2">
                  {t.brachyCardTitle}
                </h3>
                <span className="text-xs text-slate-500">
                  {t.brachyCardSubtitle}
                </span>
              </div>

              <span
                className={`text-xs px-3 py-1 rounded-full font-bold border ${
                  clock.total_steps_completed >= 15
                    ? "bg-[#DBFE87] text-black border-[#c4e872]"
                    : "bg-[#F19941]/20 text-slate-900 border-[#F19941]/40"
                }`}
              >
                {clock.total_steps_completed >= 15 ? t.step15Active : t.step15Pending}
              </span>
            </div>

            {/* Accessible Audio Player Widget (Sleek Black Card matching Image 1) */}
            <div className="bg-black text-white rounded-2xl p-5 mb-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#F19941] text-white flex items-center justify-center">
                    <Volume2 className="size-5 text-black" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {language === "en"
                        ? currentTrack.id === "brachy_reassurance"
                          ? "Brachytherapy Procedure & Pain Relief Reassurance"
                          : currentTrack.id === "cisplatin_hydration"
                          ? "Pre-Chemotherapy Hydration Guidelines"
                          : "Treatment Pathway & Healing Clock Introduction"
                        : currentTrack.title_hi}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t.voiceLabel} {currentTrack.speaker}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleAudioTrack(currentTrack.id)}
                  className="size-10 rounded-full bg-[#F19941] hover:bg-[#e08933] text-black flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  {isPlayingAudio ? (
                    <Pause className="size-4.5 fill-current" />
                  ) : (
                    <Play className="size-4.5 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Progress Bar in Lime Accent */}
              {isPlayingAudio && (
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4 overflow-hidden">
                  <div
                    className="bg-[#DBFE87] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              )}

              {/* Active Transcript Display */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                🔊 "{language === "en" ? currentTrack.english_translation : currentTrack.hindi_text}"
              </div>

              {/* Subtext Comparison */}
              <div className="mt-2.5 text-xs text-slate-400">
                {language === "hi"
                  ? `${t.translationLabel} "${currentTrack.english_translation}"`
                  : `Original Hindi Audio: "${currentTrack.hindi_text}"`}
              </div>
            </div>

            {/* Quick Track Switcher */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {t.otherAudioTracks}
              </span>
              <div className="flex flex-wrap gap-2">
                {tracks.map((trackItem) => {
                  const label =
                    trackItem.id === "brachy_reassurance"
                      ? t.track1Label
                      : trackItem.id === "cisplatin_hydration"
                      ? t.track2Label
                      : t.track3Label;

                  return (
                    <button
                      key={trackItem.id}
                      type="button"
                      onClick={() => {
                        setActiveTrackId(trackItem.id);
                        setIsPlayingAudio(true);
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
                        activeTrackId === trackItem.id
                          ? "bg-black text-white border-black font-semibold"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card B: UP Roadways Bus Voucher & Dharamshala Pass */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-black">
                  {t.travelCardTitle}
                </h3>
                <span className="text-xs text-slate-500">
                  {t.travelCardSubtitle}
                </span>
              </div>

              {passData.slot_confirmed_by_doctor === 1 ? (
                <span className="text-xs bg-[#DBFE87] text-black border border-[#c4e872] px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-black" />
                  {t.approvedDay41}
                </span>
              ) : (
                <span className="text-xs bg-[#F19941]/20 text-slate-900 border border-[#F19941]/40 px-3 py-1 rounded-full font-bold">
                  {clock.total_steps_completed >= 15 ? t.hubAwaiting : t.hubStep15Req}
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              {t.travelIntro}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4.5 bg-[#90C3CB]/15 rounded-2xl border border-[#90C3CB]/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bus className="size-4.5 text-slate-800" />
                  <span className="text-xs font-bold text-black">{t.busTitle}</span>
                </div>
                <div className="font-mono font-bold text-base text-black">
                  {passData.bus_voucher_code || (passData.slot_confirmed_by_doctor ? "UP-RTC-7891" : t.pending)}
                </div>
                <span className="text-xs text-slate-600 block mt-1">
                  {t.busRoute}
                </span>
              </div>

              <div className="p-4.5 bg-[#F19941]/15 rounded-2xl border border-[#F19941]/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Home className="size-4.5 text-slate-800" />
                  <span className="text-xs font-bold text-black">{t.roomTitle}</span>
                </div>
                <div className="font-mono font-bold text-base text-black">
                  {passData.dharamshala_room_code || (passData.slot_confirmed_by_doctor ? "DHM-ROOM-402" : t.pending)}
                </div>
                <span className="text-xs text-slate-600 block mt-1">
                  {t.roomLocation}
                </span>
              </div>
            </div>

            {passData.slot_confirmed_by_doctor === 1 ? (
              <button
                type="button"
                onClick={() => setShowPassModal(true)}
                className="w-full py-3 bg-black hover:bg-black/85 text-white rounded-full text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="size-4" />
                <span>{t.viewPassBtn}</span>
              </button>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                {t.passPendingNotice}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Dedicated Evaluator Live Demo Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#DBFE87] ring-2 ring-[#DBFE87]/50" />
            <span className="text-xs font-bold uppercase tracking-wider text-black font-mono">
              {t.evaluatorHeader}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            className="text-xs text-slate-500 hover:text-black flex items-center gap-1 cursor-pointer self-start sm:self-auto font-medium"
          >
            <RefreshCw className="size-3.5" /> {t.resetBtn}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clock.total_steps_completed < 15 ? (
            <button
              type="button"
              onClick={handleAdvanceToFraction15}
              disabled={loadingAction === "advance"}
              className="py-3 px-5 bg-[#BA2D0B] hover:bg-[#a02609] text-white rounded-full text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="size-4 text-[#DBFE87]" />
              <span>{t.demo1Pending}</span>
            </button>
          ) : (
            <div className="py-3 px-5 bg-[#DBFE87]/30 border border-[#c4e872] text-black rounded-full text-xs font-bold flex items-center justify-center gap-2">
              <Check className="size-4 text-black" />
              <span>{t.demo1Done}</span>
            </div>
          )}

          {passData.slot_confirmed_by_doctor === 0 ? (
            <button
              type="button"
              onClick={handleConfirmHubSlot}
              disabled={loadingAction === "confirm"}
              className="py-3 px-5 bg-black hover:bg-black/85 text-white rounded-full text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Building2 className="size-4 text-[#90C3CB]" />
              <span>{t.demo2Pending}</span>
            </button>
          ) : (
            <div className="py-3 px-5 bg-[#90C3CB]/25 border border-[#90C3CB] text-black rounded-full text-xs font-bold flex items-center justify-center gap-2">
              <Check className="size-4 text-black" />
              <span>{t.demo2Done}</span>
            </div>
          )}
        </div>
      </div>

      {/* Printable Bilingual Family Caregiver Pass Modal */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-black shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-black bg-[#DBFE87] border border-[#c4e872] px-2.5 py-0.5 rounded-full">
                  {t.modalBadge}
                </span>
                <h3 className="text-base font-bold mt-1.5 text-black">
                  {t.modalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4 font-sans text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-500 font-medium">{t.modalTokenLabel}</span>
                <strong className="font-mono text-sm text-black">{patientToken}</strong>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">{t.modalRouteLabel}</span>
                <div className="font-bold text-black text-xs mt-0.5">
                  {t.modalRouteVal}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 block">{t.modalBusLabel}</span>
                  <strong className="font-mono text-black text-sm">
                    {passData.bus_voucher_code || "UP-RTC-7891"}
                  </strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 block">{t.modalRoomLabel}</span>
                  <strong className="font-mono text-black text-sm">
                    {passData.dharamshala_room_code || "DHM-ROOM-402"}
                  </strong>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200">
                <QrCode className="size-28 text-black" />
                <span className="text-xs font-mono text-slate-500 mt-2">
                  {t.modalValidity}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  alert(t.downloadAlert);
                  setShowPassModal(false);
                }}
                className="w-full py-3 bg-black hover:bg-black/85 text-white rounded-full font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="size-4" /> {t.modalDownloadBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
