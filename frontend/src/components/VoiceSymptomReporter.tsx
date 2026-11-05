import { useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { api, type VoiceSymptomResult } from "../api/client";
import { useVoiceRecorder } from "../lib/useVoiceRecorder";

/** Lets a patient say how she feels in her own language. A nurse reviews every report. */
export function VoiceSymptomReporter({ patientToken, clockDay }: { patientToken: string; clockDay: number }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VoiceSymptomResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useVoiceRecorder(28, async (audio) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.reportVoiceSymptoms(patientToken, audio, clockDay));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process the recording");
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="mb-5 p-4 rounded-2xl border border-[#90C3CB] bg-[#90C3CB]/10">
      <button
        type="button"
        onClick={() => (recorder.recording ? recorder.stop() : recorder.start())}
        disabled={busy}
        data-testid="speak-symptoms"
        className="w-full min-h-12 rounded-xl bg-black text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : recorder.recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        {busy ? "Listening to your message..." : recorder.recording ? `Stop recording (${recorder.seconds}s)` : "Speak your symptoms"}
      </button>
      {(error || recorder.error) && <p role="alert" className="text-xs text-[#BA2D0B] mt-2">{error || recorder.error}</p>}
      {result && (
        <div className="mt-3 text-sm text-slate-700 space-y-1" data-testid="voice-symptom-result">
          <p className="italic">"{result.transcript}"</p>
          <p className="font-semibold">
            {result.checkin.is_ward_alert ? "The ward has been alerted and will contact you." : "Your care team has received this and a nurse will review it."}
          </p>
        </div>
      )}
    </div>
  );
}
