import React from "react";
import { usePatientLang, type Lang } from "../i18n/patient";

// English / Hindi switch for patient-facing screens; choice persists across pages and refresh
export const LanguageSwitch: React.FC = () => {
  const { lang, setLang, t } = usePatientLang();
  const options: Lang[] = ["hi", "en"];
  return (
    <div role="radiogroup" aria-label={t("lang.label")} className="flex bg-slate-100 border border-slate-200 rounded-full p-0.5">
      {options.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          lang={l}
          onClick={() => setLang(l)}
          className={`min-h-9 px-3 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-black ${
            lang === l ? "bg-black text-white" : "text-slate-700 hover:text-black"
          }`}
        >
          {l === "hi" ? t("lang.hi") : t("lang.en")}
        </button>
      ))}
    </div>
  );
};
