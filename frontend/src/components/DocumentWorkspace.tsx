import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, MessageCircleQuestion } from "lucide-react";
import { api, type DocumentBlock, type DocumentResult } from "../api/client";

const STATUS_MESSAGE: Record<string, string> = {
  OCR_DISABLED: "Document reading is not turned on for this server.",
  OCR_FAILED: "The document could not be read right now. Please try again.",
  OCR_EMPTY: "No text was found in this document.",
};

interface Props {
  /** Sends the clinician-reviewed summary to the intake form. */
  onUseInIntake: (summary: string) => void;
}

/** Upload a slip or report, see where every value came from, correct it, and ask questions about it. */
export function DocumentWorkspace({ onUseInIntake }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentResult | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [qa, setQa] = useState<{ q: string; a: string; quote: string | null }[]>([]);
  const [used, setUsed] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const read = async (chosen: File) => {
    setFile(chosen);
    setPreview(chosen.type.startsWith("image/") ? URL.createObjectURL(chosen) : null);
    setBusy(true);
    setError(null);
    setDoc(null);
    setQa([]);
    setActive(null);
    setUsed(false);
    try {
      const result = await api.extractDocument(chosen);
      setDoc(result);
      setValues(Object.fromEntries((result.fields || []).map((f) => [f.key, f.value])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the document");
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    if (!doc?.text || !question.trim()) return;
    setAsking(true);
    const q = question.trim();
    try {
      const res = await api.askDocument(doc.text, q);
      setQa((prev) => [...prev, { q, a: res.found && res.answer ? res.answer : "This document does not answer that.", quote: res.quote }]);
      setQuestion("");
    } catch {
      setQa((prev) => [...prev, { q, a: "Could not get an answer right now. Please try again.", quote: null }]);
    } finally {
      setAsking(false);
    }
  };

  const useInIntake = () => {
    if (!doc) return;
    const lines = (doc.fields || []).map((f) => `${f.label}: ${values[f.key] ?? f.value}`);
    const labs = (doc.labs || []).map((l) => `${l.name} ${l.value} ${l.unit}`);
    onUseInIntake([...lines, labs.length ? `Labs: ${labs.join(", ")}` : ""].filter(Boolean).join("\n"));
    setUsed(true);
  };

  const blocks: DocumentBlock[] = doc?.blocks || [];
  const hasBoxes = !!preview && blocks.some((b) => b.bbox);
  const flagged = useMemo(() => new Set((doc?.labs || []).filter((l) => l.abnormal).map((l) => l.block_id)), [doc]);
  const rowClass = (blockId: string | null) => `cursor-pointer rounded-lg transition-colors ${blockId && active === blockId ? "bg-amber-100" : "hover:bg-gray-50"}`;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4" data-testid="document-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#111418]">Document Workspace</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upload a slip or lab report. Click any value to see where it came from, and correct it before use.</p>
        </div>
        <label className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-black text-white text-xs font-semibold cursor-pointer hover:bg-black/85">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {busy ? "Reading document..." : file ? "Upload another" : "Upload document"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            disabled={busy}
            data-testid="document-input"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) read(chosen);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && <p role="alert" className="text-xs text-[#BA2D0B]">{error}</p>}
      {doc?.status === "QUALITY_REJECTED" && (
        <p role="alert" className="text-xs text-[#BA2D0B]">{doc.quality?.reasons.join(" ") || "This photo cannot be read. Please retake it."}</p>
      )}
      {doc && STATUS_MESSAGE[doc.status] && <p role="alert" className="text-xs text-[#BA2D0B]">{STATUS_MESSAGE[doc.status]}</p>}
      {doc?.quality?.warnings.map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}

      {doc?.status === "COMPLETED" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* The document itself, with every read block marked */}
          <div className="min-w-0 space-y-2">
            {preview && (
              <div className="relative border border-gray-200 rounded-lg overflow-hidden" data-testid="document-preview">
                <img src={preview} alt="Uploaded document" className="w-full block" />
                {hasBoxes && blocks.map((b) => b.bbox && b.page === 1 && (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={b.text}
                    title={b.text}
                    onClick={() => setActive(b.id)}
                    style={{ left: `${b.bbox[0] * 100}%`, top: `${b.bbox[1] * 100}%`, width: `${(b.bbox[2] - b.bbox[0]) * 100}%`, height: `${(b.bbox[3] - b.bbox[1]) * 100}%` }}
                    className={`absolute border cursor-pointer transition-colors ${
                      active === b.id ? "bg-amber-300/50 border-amber-600" : flagged.has(b.id) ? "bg-red-200/30 border-red-500" : "border-[#0F766E]/40 hover:bg-[#0F766E]/10"
                    }`}
                  />
                ))}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-0.5" data-testid="document-text">
              <p className="text-[11px] font-bold text-gray-500 px-1.5">Text read from the document (personal details hidden)</p>
              {blocks.map((b) => (
                <p key={b.id} onClick={() => setActive(b.id)} className={`text-xs text-gray-800 px-1.5 py-1 ${rowClass(b.id)}`}>{b.text}</p>
              ))}
            </div>
          </div>

          {/* What was extracted: editable, checked and traceable */}
          <div className="min-w-0 space-y-4">
            {(doc.labs || []).length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-800 mb-1.5">Lab values</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="document-labs">
                  {doc.labs!.map((l) => (
                    <button
                      key={l.name}
                      type="button"
                      onClick={() => setActive(l.block_id)}
                      className={`text-left p-2 rounded-lg border cursor-pointer ${l.abnormal ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                        {l.abnormal ? <AlertTriangle className="size-3.5 text-[#BA2D0B]" /> : <CheckCircle2 className="size-3.5 text-[#0F766E]" />}
                        {l.name}: {l.value} {l.unit}
                      </span>
                      <span className="block text-[11px] text-gray-600 mt-0.5">{l.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-gray-800 mb-1.5">Extracted details</h3>
              {(doc.fields || []).length === 0 && <p className="text-xs text-gray-500">No clinical details were recognised. You can still read and ask about the text.</p>}
              <div className="space-y-1" data-testid="document-fields">
                {doc.fields?.map((f) => (
                  <div key={f.key} onClick={() => f.block_id && setActive(f.block_id)} className={`p-1.5 ${rowClass(f.block_id)}`}>
                    <label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
                      {f.label}
                      {!f.found_in_document && <span className="text-[#BA2D0B]">Not matched to the document, please check</span>}
                    </label>
                    <input
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      onFocus={() => f.block_id && setActive(f.block_id)}
                      className="w-full mt-0.5 text-xs px-2 py-1.5 rounded border border-gray-200 bg-white focus:outline-none focus:border-black"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={useInIntake}
                data-testid="document-use"
                className="mt-2 w-full py-2 rounded-full bg-[#0F766E] text-white text-xs font-semibold cursor-pointer hover:bg-[#0d635c]"
              >
                {used ? "Added to intake notes ✓" : "Use in intake notes"}
              </button>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <MessageCircleQuestion className="size-3.5" /> Ask this document
              </h3>
              <div className="space-y-2 mb-2" data-testid="document-answers">
                {qa.map((item, i) => (
                  <div key={i} className="text-xs bg-gray-50 rounded-lg p-2">
                    <p className="font-semibold text-gray-900">{item.q}</p>
                    <p className="text-gray-800 mt-0.5">{item.a}</p>
                    {item.quote && <p className="text-gray-500 italic mt-0.5">"{item.quote}"</p>}
                  </div>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="For example: what chemotherapy is planned?"
                  data-testid="document-question"
                  className="flex-1 min-w-0 text-xs px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-black"
                />
                <button type="submit" disabled={asking || !question.trim()} className="px-4 rounded-full bg-black text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
                  {asking ? "..." : "Ask"}
                </button>
              </form>
            </div>
            <p className="text-[11px] text-gray-500">Decision support only. Handwriting and photos can be misread, so check values against the original.</p>
          </div>
        </div>
      )}
    </section>
  );
}
