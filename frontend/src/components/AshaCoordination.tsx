import { useMemo, useState } from "react";
import type { PatientCase } from "../api/client";
import { Card, CardHeader, CardTitle, CardContent } from "./careui/card";
import { Avatar, AvatarFallback } from "./careui/avatar";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Users, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";

interface Props {
  cases: PatientCase[];
  loading: boolean;
}

const ASHA_WORKERS = [
  { id: "ASHA-001", name: "Sunita Devi", region: "Kalyanpur Block, Mirzapur", mobile: "+91 94150 11234", active: true, specialty: "Oral Cancer Screening", targetVisits: 12, completedVisits: 10 },
  { id: "ASHA-002", name: "Meena Kumari", region: "Rampur Block, Varanasi", mobile: "+91 95221 88901", active: true, specialty: "Maternal & Cervical VIA", targetVisits: 15, completedVisits: 13 },
  { id: "ASHA-003", name: "Rekha Singh", region: "Vindhyachal, Mirzapur", mobile: "+91 97890 33412", active: true, specialty: "Chronic Disease & Follow-up", targetVisits: 10, completedVisits: 7 },
  { id: "ASHA-004", name: "Lata Yadav", region: "Sonbhadra District", mobile: "+91 98112 55432", active: true, specialty: "Rural Referral & Escalation", targetVisits: 14, completedVisits: 11 },
  { id: "ASHA-005", name: "Poonam Verma", region: "Chandauli Block", mobile: "+91 99001 22345", active: false, specialty: "Breast Examination & Triage", targetVisits: 8, completedVisits: 4 },
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function AshaCoordination({ cases }: Props) {
  const [dispatchedWorkers, setDispatchedWorkers] = useState<Record<string, boolean>>({});

  const assignedCases = useMemo(() => {
    const assignments: Record<string, PatientCase[]> = {};
    ASHA_WORKERS.forEach((w) => { assignments[w.id] = []; });
    cases.forEach((c, i) => {
      const worker = ASHA_WORKERS[i % ASHA_WORKERS.length];
      assignments[worker.id] = [...(assignments[worker.id] || []), c];
    });
    return assignments;
  }, [cases]);

  const handleDispatch = (workerId: string) => {
    setDispatchedWorkers((prev) => ({ ...prev, [workerId]: true }));
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            ASHA Community Health Worker Network
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time frontline coordination, Tier 3 physical home-visit dispatches, and sector coverage metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            {ASHA_WORKERS.filter((w) => w.active).length} Field Leads Active
          </Badge>
          <Badge variant="primary" size="sm">
            Mirzapur &amp; Sonbhadra Cluster
          </Badge>
        </div>
      </div>

      {/* Workers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ASHA_WORKERS.map((worker) => {
          const workerCases = assignedCases[worker.id] || [];
          const hasCritical = workerCases.some((c) => (c.cancer_severity_score || 0) >= 0.8 || (c.days_overdue || 0) >= 6);
          const isDispatched = dispatchedWorkers[worker.id];
          const completionPct = Math.round((worker.completedVisits / worker.targetVisits) * 100);

          return (
            <Card key={worker.id} className="bg-white border-gray-200 shadow-2xs hover:border-[#2B66E4] transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg">
                      <AvatarFallback color={hasCritical ? "destructive" : "primary"}>
                        {getInitials(worker.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm font-bold text-[#111418] leading-tight">{worker.name}</CardTitle>
                      <span className="text-[11px] font-mono font-medium text-gray-500">{worker.id}</span>
                    </div>
                  </div>
                  <Badge variant={worker.active ? "success" : "neutral"} size="xs">
                    {worker.active ? "On Duty" : "Offline"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-3.5 pt-0">
                <div className="flex flex-col gap-1.5 text-xs text-gray-600 bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{worker.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-gray-400 shrink-0" />
                    <span className="font-mono">{worker.mobile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-gray-400 shrink-0" />
                    <span className="truncate font-medium text-gray-700">{worker.specialty}</span>
                  </div>
                </div>

                {/* Progress bar with diagonal hatch fill from inspo */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 text-[11px]">Monthly Home Visits</span>
                    <span className="font-semibold text-gray-800 text-xs">
                      {worker.completedVisits} / {worker.targetVisits} ({completionPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
                    <div
                      className="h-full bg-[#2B66E4] rounded-full"
                      style={{ width: `${completionPct}%` }}
                    />
                    <div className="h-full bg-hatch flex-1" />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Active Cohort:</span>
                    <Badge variant={hasCritical ? "destructive" : "neutral"} size="xs">
                      {workerCases.length} Patients
                    </Badge>
                  </div>

                  <Button
                    variant={isDispatched ? "outline" : "obsidian"}
                    size="xs"
                    onClick={() => handleDispatch(worker.id)}
                    className="text-xs gap-1 font-medium"
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Order Issued</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3" />
                        <span>Dispatch Order</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
