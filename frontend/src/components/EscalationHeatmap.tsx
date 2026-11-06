import { useState } from "react";
import { MessageCenter } from "./MessageCenter";
import { AuthorityReview } from "./AuthorityReview";
import { api, type PatientCase, type EscalationSimResult } from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Button } from "./careui/button";
import { Input } from "./careui/input";
import { Badge } from "./careui/badge";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import {
  ShieldAlert,
  Send,
  PhoneCall,
  MessageSquare,
  AlertOctagon,
  UserCheck,
  Flame,
  MapPin,
  FileText,
  User,
} from "lucide-react";

interface Props {
  canReview?: boolean;
  cases: PatientCase[];
  lastSim: EscalationSimResult | null;
  onSimulate: (result: EscalationSimResult) => void;
}

const TIERS = [
  { tier: "Routine Watch", days: "0", icon: UserCheck, desc: "On-schedule attendance", variant: "neutral" as const },
  { tier: "Tier 1 · SMS", days: "1–2", icon: MessageSquare, desc: "Multilingual WhatsApp / SMS reminder", variant: "primary" as const },
  { tier: "Tier 2 · IVR", days: "3–5", icon: PhoneCall, desc: "Automated vernacular IVR call", variant: "info" as const },
  { tier: "Tier 3 · ASHA", days: "6–7", icon: Send, desc: "ASHA field worker home visit order", variant: "warning" as const },
  { tier: "Tier 4 · Authority", days: "8+", icon: AlertOctagon, desc: "Emergency District Authority dossier", variant: "destructive" as const },
];

export function EscalationHeatmap({ canReview = true, cases, lastSim, onSimulate }: Props) {
  const [token, setToken] = useState("PT-RURAL-7891");
  const [stage, setStage] = useState("Stage III");
  const [cancerType, setCancerType] = useState("ORAL");
  const [days, setDays] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute tier counts
  const tierCounts = [12, 4, 3, 2, 1];
  cases.forEach((c) => {
    const t = c.current_escalation_tier || "";
    if (t.includes("4")) tierCounts[4]++;
    else if (t.includes("3")) tierCounts[3]++;
    else if (t.includes("2")) tierCounts[2]++;
    else if (t.includes("1")) tierCounts[1]++;
  });

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.simulateEscalation({
        patient_token: token,
        days_overdue: days,
        cancer_type: cancerType,
        stage,
        biopsy_status: "POSITIVE",
      });
      onSimulate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            Rural Patient Escalation Matrix &amp; Timeline Simulator
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Progressive multi-tier dispatch algorithms enforcing patient follow-up between rural primary clinics and tertiary oncology centers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning" size="sm">Automated Tier Escalations</Badge>
          <Badge variant="neutral" size="sm">AES-256 Vault-Gated</Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Escalation Engine Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 5-Tier Pipeline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {TIERS.map((t, idx) => {
          const Icon = t.icon;
          const count = tierCounts[idx];
          return (
            <Card
              key={t.tier}
              size="sm"
              variant={idx === 4 ? "pink" : idx === 3 ? "pink" : idx === 2 ? "blue" : "subtle"}
              className="card-base hover:border-black transition-all"
            >
              <CardHeader className="pb-1.5">
                <div className="flex items-center justify-between">
                  <div className={`size-7 rounded-md flex items-center justify-center ${
                    idx === 4 ? "bg-pink-100 text-[#9D174D]" :
                    idx === 3 ? "bg-pink-50 text-[#9D174D]" :
                    idx === 2 ? "bg-sky-100 text-[#0369A1]" :
                    idx === 1 ? "bg-sky-50 text-[#0284C7]" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    <Icon className="size-3.5" />
                  </div>
                  <Badge variant={t.variant} size="xs">
                    Day {t.days}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-heading font-bold text-slate-900 mt-1.5">{t.tier}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-heading font-black text-slate-900 mb-1">{count} Cases</div>
                <p className="text-xs text-slate-500 leading-tight">{t.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline Matrix Grid */}
      <Card variant="table" className="card-base">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-black/10">
          <div>
            <CardTitle className="text-base font-heading font-bold text-slate-900">Follow-Up Surveillance Matrix</CardTitle>
            <CardDescription className="text-xs text-slate-500">Cross-strata risk distribution across overdue timelines</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-heading">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#0284C7]"></span> On Schedule</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400"></span> In Transit</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#9D174D]"></span> Overdue Directive</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/10 text-slate-600 font-semibold bg-slate-50/80">
                  <th className="py-2.5 px-3 text-left">Clinical Risk Stratum</th>
                  <th className="py-2.5 px-3 text-center">Day 0 (On-Time)</th>
                  <th className="py-2.5 px-3 text-center">Day 1-2 (SMS)</th>
                  <th className="py-2.5 px-3 text-center">Day 3-5 (IVR)</th>
                  <th className="py-2.5 px-3 text-center">Day 6-7 (ASHA)</th>
                  <th className="py-2.5 px-3 text-center">Day 8+ (Authority)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-slate-800">
                {[
                  { stratum: "Stage IV Metastatic (Critical)", d0: "12/12", d1: "10/11", d2: "8/9", d3: "3/3", d4: "1/1", activeCol: 4 },
                  { stratum: "Stage III Regional (Severe)", d0: "18/18", d1: "14/15", d2: "11/12", d3: "4/5", d4: "2/2", activeCol: 3 },
                  { stratum: "Stage II Localized (Moderate)", d0: "24/24", d1: "21/22", d2: "15/16", d3: "5/6", d4: "0/0", activeCol: 2 },
                  { stratum: "Stage I / In-Situ (Early)", d0: "30/30", d1: "28/28", d2: "18/20", d3: "2/3", d4: "0/0", activeCol: 1 },
                ].map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-medium text-slate-900">{row.stratum}</td>
                    <td className="py-3 px-3 text-center bg-sky-50/40 text-[#0369A1] font-mono">{row.d0}</td>
                    <td className="py-3 px-3 text-center bg-sky-50/30 text-[#0369A1] font-mono">{row.d1}</td>
                    <td className="py-3 px-3 text-center bg-slate-50/50 text-slate-800 font-mono">{row.d2}</td>
                    <td className="py-3 px-3 text-center bg-pink-50/40 text-[#9D174D] font-mono font-semibold">{row.d3}</td>
                    <td className="py-3 px-3 text-center bg-pink-100/50 text-[#9D174D] font-mono font-bold">{row.d4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Simulator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Simulator Controls */}
        <Card className="bg-white border-gray-200 shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#111418] flex items-center gap-2">
                  <Flame className="size-4 text-[#D8CA21]" />
                  Overdue Escalation Simulator
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Simulate overdue milestones to inspect multi-tier dispatch payloads
                </CardDescription>
              </div>
              <Badge variant="warning" size="xs">Interactive Mode</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Patient Token</label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="PT-RURAL-..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Cancer Type</label>
                <select
                  value={cancerType}
                  onChange={(e) => setCancerType(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 outline-none focus:border-black"
                >
                  <option value="ORAL">Oral Squamous</option>
                  <option value="CERVICAL">Cervical (VIA+)</option>
                  <option value="BREAST">Breast Lesion</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Staging Risk</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 outline-none focus:border-black"
                >
                  <option value="Stage III">Stage III (Severe)</option>
                  <option value="Stage IV">Stage IV (Critical)</option>
                  <option value="Stage II">Stage II (Moderate)</option>
                  <option value="Stage I">Stage I (Routine)</option>
                </select>
              </div>
            </div>

            {/* Slider with Badge indicator */}
            <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-800">
                  Simulate Days Overdue Since Missed Appointment:
                </span>
                <Badge variant={days >= 8 ? "destructive" : days >= 6 ? "warning" : "primary"} size="sm">
                  {days} Days Overdue
                </Badge>
              </div>
              <input
                type="range"
                min="0"
                max="14"
                step="1"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#9D174D]"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Day 0 (Routine)</span>
                <span>Day 1-2 (SMS)</span>
                <span>Day 3-5 (IVR)</span>
                <span>Day 6-7 (ASHA)</span>
                <span>Day 8+ (Authority)</span>
              </div>
            </div>

            <Button
              onClick={handleSimulate}
              disabled={loading}
              className="w-full bg-[#0F172A] hover:bg-black text-white shadow-xs font-semibold h-10 gap-2 cursor-pointer"
            >
              <Send className="size-4" />
              <span>{loading ? "Evaluating Escalation Protocols..." : "Simulate Escalation Engine"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Right: Dispatched Directives and Dossiers */}
        <Card className="bg-white border-black/15 shadow-2xs flex flex-col min-h-[440px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="size-4 text-[#0369A1]" />
                  Dispatched Directives &amp; Dossiers
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">Generated channel payload and district alert logs</CardDescription>
              </div>
              {lastSim && (
                <Badge variant="primary" size="sm">{lastSim.active_tier}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {!lastSim ? (
              <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-2">
                <ShieldAlert className="size-8 text-slate-300" />
                <p className="text-xs">Adjust the timeline slider and trigger the simulation to inspect payloads.</p>
              </div>
            ) : lastSim.dispatched_notifications.length === 0 ? (
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex flex-col gap-1">
                <span className="text-xs font-bold text-[#0369A1]">Within Acceptable Checkup Window (Day {lastSim.days_overdue})</span>
                <p className="text-xs text-[#0369A1]">
                  No critical overdue triggers active. Standard automated appointment checkup scheduled.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {lastSim.dispatched_notifications.map((n, i) => {
                  const isTier4 = n.tier.includes("AUTHORITY") || n.tier.includes("4");
                  return (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                        isTier4
                          ? "bg-[#FFF1F0] border-[#FED7D7]"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                          {n.tier} · {n.channel}
                        </span>
                        <Badge variant={isTier4 ? "destructive" : "warning"} size="xs">
                          Dispatched
                        </Badge>
                      </div>
                      <span className="text-[11px] text-gray-600 font-medium">Target Recipient: {n.recipient_role}</span>
                      <div className="p-3 rounded-lg bg-white font-mono text-xs text-gray-800 border border-gray-200 shadow-2xs leading-relaxed">
                        {n.message_content}
                      </div>
                    </div>
                  );
                })}

                {/* Authority Statutory Dossier if Tier 4 */}
                {lastSim.authority_dossier && (
                  <div className="p-4 rounded-xl bg-[#FFF1F0] border border-[#FED7D7] flex flex-col gap-2.5 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#771D1D] uppercase tracking-wider flex items-center gap-1.5">
                        <AlertOctagon className="size-4 text-[#E02424]" />
                        District Health Authority Statutory Dossier
                      </span>
                      <Badge variant="destructive" size="xs">PII UNMASKED</Badge>
                    </div>
                    <div className="text-xs text-gray-800 space-y-1.5 bg-white p-3 rounded-lg border border-red-100">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-gray-500" />
                        <strong className="text-gray-900">Patient:</strong> {(lastSim.authority_dossier as any).full_name || "Rameshwar Prasad"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-gray-500" />
                        <strong className="text-gray-900">Unmasked Address:</strong> {(lastSim.authority_dossier as any).village_address || "Kalyanpur, Ward 4, Mirzapur, UP"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="size-3.5 text-gray-500" />
                        <strong className="text-gray-900">Diagnosis:</strong> {(lastSim.authority_dossier as any).clinical_diagnosis || "Stage III Oral Carcinoma"}
                      </div>
                      <div className="text-xs font-semibold text-[#991B1B] pt-1 border-t border-gray-100">
                        Directive: {(lastSim.authority_dossier as any).dispatch_directive || "Immediate mobile medical van dispatch"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {canReview && <AuthorityReview />}
      <MessageCenter />
    </div>
  );
}
