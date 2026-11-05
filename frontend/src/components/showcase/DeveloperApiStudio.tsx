import React, { useState } from "react";
import { api } from "../../api/client";
import {
  SolarCode,
  SolarCopy,
  SolarCheck,
  SolarPlay,
} from "../icons/SolarIcons";

export const DeveloperApiStudio: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<"curl" | "python" | "typescript">("curl");
  const [copied, setCopied] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [liveResponse, setLiveResponse] = useState<string | null>(null);
  const [roundtripMs, setRoundtripMs] = useState<number | null>(null);

  const snippets = {
    curl: `curl -X POST "http://localhost:8000/api/showcase/parse-prescription" \\
  -H "Content-Type: application/json" \\
  -d '{"sample_id": "sample_cervical_01"}'`,

    python: `import requests

url = "http://localhost:8000/api/showcase/parse-prescription"
payload = {"sample_id": "sample_cervical_01"}

response = requests.post(url, json=payload)
data = response.json()
print("Extracted Cancer Site:", data["cancer_type"])
print("Curative Window Days:", data["fractions_planned"]["curative_window_days"])`,

    typescript: `import { api } from "./api/client";

const result = await api.parsePrescriptionSlip({
  sample_id: "sample_cervical_01"
});

console.log("Cancer Type:", result.cancer_type);
console.log("Spatial Bounding Boxes:", result.bounding_boxes.length);`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[selectedLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeLiveRequest = async () => {
    setIsExecuting(true);
    const t0 = performance.now();
    try {
      const res = await api.parsePrescriptionSlip({ sample_id: "sample_cervical_01" });
      const elapsed = Math.round(performance.now() - t0);
      setLiveResponse(JSON.stringify(res, null, 2));
      setRoundtripMs(elapsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Execution error";
      setLiveResponse(JSON.stringify({ error: message }, null, 2));
      setRoundtripMs(Math.round(performance.now() - t0));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#F19941]/30 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
              Developer Platform & REST APIs
            </span>
            <span className="text-xs text-[#F19941]">·</span>
            <span className="text-xs text-[#4B5563]">FastAPI Specification</span>
          </div>
          <h3 className="text-2xl font-semibold text-[#000000] tracking-tight">
            Programmatic Cancer Care Infrastructure APIs
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={executeLiveRequest}
            disabled={isExecuting}
            className="px-4 py-2 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <div className="size-4 rounded bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
              <SolarPlay size={10} />
            </div>
            <span>{isExecuting ? "Executing Call..." : "Test Live API Endpoint"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Code Snippets Studio */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-[#F8F9FA] border-2 border-[#F19941] rounded-lg p-1">
              {(["curl", "python", "typescript"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold font-mono-data transition-all cursor-pointer ${
                    selectedLang === lang
                      ? "bg-[#DBFE87] text-[#000000] border border-[#BA2D0B]"
                      : "text-[#4B5563] hover:text-[#000000]"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border-2 border-[#F19941] bg-[#FFFFFF] hover:bg-[#F8F9FA] text-xs font-semibold text-[#000000] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {copied ? (
                <>
                  <div className="size-4 rounded bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                    <SolarCheck size={12} />
                  </div>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <div className="size-4 rounded bg-[#90C3CB] border border-[#F19941] flex items-center justify-center text-[#000000]">
                    <SolarCopy size={12} />
                  </div>
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Snippet Card */}
          <div className="bg-[#111827] border-2 border-[#BA2D0B] rounded-xl p-5 overflow-x-auto shadow-sm">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#374151] text-[11px] font-mono-data text-[#9CA3AF]">
              <div className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                <SolarCode size={11} />
              </div>
              <span>POST /api/showcase/parse-prescription</span>
            </div>
            <pre className="font-mono-data text-xs text-[#E5E7EB] leading-relaxed">
              <code>{snippets[selectedLang]}</code>
            </pre>
          </div>
        </div>

        {/* Right Column: Live Output Inspector */}
        <div className="lg:col-span-5 bg-[#F8F9FA] border-2 border-[#BA2D0B] rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#F19941]/30 mb-3">
            <span className="text-xs font-mono-data text-[#000000] uppercase tracking-wider font-bold">
              Live API Response
            </span>
            {roundtripMs !== null && (
              <span className="text-[11px] font-mono-data px-2 py-0.5 rounded bg-[#DBFE87] border border-[#BA2D0B] text-[#000000] font-bold">
                200 OK · {roundtripMs} ms
              </span>
            )}
          </div>

          <div className="bg-[#FFFFFF] border-2 border-[#F19941]/40 rounded-lg p-4 font-mono-data text-[11px] text-[#000000] overflow-y-auto max-h-[320px]">
            {liveResponse ? (
              <pre className="whitespace-pre-wrap leading-normal text-[#000000]">
                {liveResponse}
              </pre>
            ) : (
              <div className="text-[#4B5563] py-8 text-center">
                Click "Test Live API Endpoint" to execute an active request against the CerviSetu FastAPI backend.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
