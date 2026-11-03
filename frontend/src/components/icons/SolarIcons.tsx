import React from "react";

interface SolarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Solar Icons Library (Niche Modern Icon System from 480 Design)
 * Clean 24x24 geometric coordinate space with linear-bold precision.
 */

// Pulse / ECG / Activity (Solar: Heart Pulse / Graph)
export const SolarPulse: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 12h3.5l2.5-6 4 12 3-8 2 4h3" />
  </svg>
);

// Shield Keyhole / Security (Solar: Shield Keyhole Linear)
export const SolarShieldKeyhole: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2l7.5 3.5v6.2c0 5.4-3.5 10.3-7.5 11.8-4-1.5-7.5-6.4-7.5-11.8V5.5L12 2z" />
    <circle cx="12" cy="10.5" r="1.8" />
    <path d="M12 12.3v3.2" />
  </svg>
);

// Users / Health Community (Solar: Users Group Rounded Linear)
export const SolarUsersGroup: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M16 21v-1.8c0-1.8-1.4-3.2-3.2-3.2h-3.6C7.4 16 6 17.4 6 19.2V21" />
    <circle cx="11" cy="9" r="3.2" />
    <path d="M18 7.5a2.8 2.8 0 0 1 0 5.4" />
    <path d="M21 21v-1.5c0-1.3-.9-2.4-2.1-2.7" />
  </svg>
);

// Document / Medical Prescription (Solar: Document Text / Scanner)
export const SolarDocumentText: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

// Hospital / Clinical Cross (Solar: Buildings / Hospital)
export const SolarHospital: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M12 7v4" />
    <path d="M10 9h4" />
    <path d="M9 17v4" />
    <path d="M15 17v4" />
  </svg>
);

// Device / Mobile Tablet (Solar: Smartphone / Devices)
export const SolarSmartphone: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
    <path d="M10 5h4" />
  </svg>
);

// Arrow Right (Solar: Arrow Right Linear)
export const SolarArrowRight: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M4 12h16" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

// Check / Verified (Solar: Check Circle Linear)
export const SolarCheck: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Caret Down (Solar: Alt Arrow Down)
export const SolarCaretDown: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// Shield Check (Solar: Shield Check Linear)
export const SolarShieldCheck: React.FC<SolarIconProps> = ({ size = 20, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2l7.5 3.5v6.2c0 5.4-3.5 10.3-7.5 11.8-4-1.5-7.5-6.4-7.5-11.8V5.5L12 2z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

