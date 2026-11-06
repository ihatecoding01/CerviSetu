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
    <div className="w-full card-base card-gradient-subtle rounded-lg p-6 sm:p-8 border border-black/15 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/10 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-heading text-xs uppercase tracking-wider text-[#0284C7] font-bold bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
              Developer Platform & REST APIs
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-600 font-medium">FastAPI Specification</span>
          </div>
          <h3 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
            Programmatic Cancer Care Infrastructure APIs
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={executeLiveRequest}
            disabled={isExecuting}
            className="px-4 py-2 rounded-md bg-[#0F172A] hover:bg-black text-white text-xs font-heading font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <div className="size-4 rounded bg-white/20 flex items-center justify-center text-white">
              <SolarPlay size={10} />
            </div>
            <span>{isExecuting ? "Executing Call..." : "Test Live API Endpoint"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Code Snippets Studio */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-white/80 border border-black/15 rounded-md p-0.5 shadow-2xs">
              {(["curl", "python", "typescript"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1 rounded-md text-xs font-heading font-semibold transition-all cursor-pointer ${
                    selectedLang === lang
                      ? "bg-[#0F172A] text-white shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md border border-black/15 bg-white hover:bg-slate-50 text-xs font-heading font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              {copied ? (
                <>
                  <div className="size-4 rounded bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0369A1]">
                    <SolarCheck size={12} />
                  </div>
                  <span className="text-[#0369A1]">Copied</span>
                </>
              ) : (
                <>
                  <div className="size-4 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                    <SolarCopy size={12} />
                  </div>
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Snippet Card */}
          <div className="bg-[#0F172A] border border-black/30 rounded-lg p-5 overflow-x-auto shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800 text-[11px] font-mono-data text-slate-400">
              <div className="size-4 rounded bg-slate-800 flex items-center justify-center text-sky-400">
                <SolarCode size={11} />
              </div>
              <span>POST /api/showcase/parse-prescription</span>
            </div>
            <pre className="font-mono-data text-xs text-slate-200 leading-relaxed">
              <code>{snippets[selectedLang]}</code>
            </pre>
          </div>
        </div>

        {/* Right Column: Live Output Inspector */}
        <div className="lg:col-span-5 card-base card-gradient-blue border border-black/15 rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-black/10 mb-3">
            <span className="font-heading text-xs text-slate-900 uppercase tracking-wider font-bold">
              Live API Response
            </span>
            {roundtripMs !== null && (
              <span className="text-[11px] font-mono-data px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#0369A1] font-bold">
                200 OK · {roundtripMs} ms
              </span>
            )}
          </div>

          <div className="bg-white/90 border border-black/10 rounded-md p-4 font-mono-data text-[11px] text-slate-900 overflow-y-auto max-h-[320px] shadow-2xs">
            {liveResponse ? (
              <pre className="whitespace-pre-wrap leading-normal text-slate-900">
                {liveResponse}
              </pre>
            ) : (
              <div className="text-slate-500 py-8 text-center font-sans">
                Click "Test Live API Endpoint" to execute an active request against the CerviSetu FastAPI backend.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
