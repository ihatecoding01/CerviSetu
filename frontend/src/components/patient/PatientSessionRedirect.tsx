import React, { useEffect } from "react";
import { portalApi } from "../../api/portal";
import { usePatientLang } from "../../i18n/patient";

// Bare /patient: open the logged-in patient's own record, or default to demo patient so /patient never breaks
export const PatientSessionRedirect: React.FC<{ onFound: (token: string) => void; onMissing: () => void }> = ({ onFound }) => {
  const { t } = usePatientLang();
  useEffect(() => {
    portalApi
      .session()
      .then((s) => {
        if (s.authenticated && s.patient_token) {
          onFound(s.patient_token);
        } else {
          // Fall back to primary demonstration patient so /patient is immediately usable
          onFound("PT-CASE-BINDU");
        }
      })
      .catch(() => onFound("PT-CASE-BINDU"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <p role="status" className="min-h-screen flex items-center justify-center text-sm text-slate-600">
      {t("portal.loading")}
    </p>
  );
};
