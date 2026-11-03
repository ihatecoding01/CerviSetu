import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  weight?: "regular" | "bold" | "fill";
}

export const PhosphorShieldCheck: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M208,40H48A16,16,0,0,0,32,56v58.78c0,89.61,75.82,119.34,91,124.39a15.54,15.54,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,105.47-80,110.42-13.65-4.95-80-32-80-110.42V56H208ZM173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z" />
  </svg>
);

export const PhosphorActivity: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M240,128a8,8,0,0,1-8,8H187.75l-26.68,53.36a8,8,0,0,1-14.31-.08l-37.49-80.34L94.51,135a8,8,0,0,1-7.15,1H24a8,8,0,0,1,0-16H82.25l26.68-53.36a8,8,0,0,1,14.31.08l37.49,80.34L175.49,121a8,8,0,0,1,7.15-1H232A8,8,0,0,1,240,128Z" />
  </svg>
);

export const PhosphorMapPin: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,206c-21.53-16.09-72-58.42-72-118a72,72,0,0,1,144,0C200,163.58,149.53,205.91,128,222Z" />
  </svg>
);

export const PhosphorUsers: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,8,240a8,8,0,0,0,16,0,80,80,0,0,1,160,0,8,8,0,0,0,16,0A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.29a8,8,0,0,1-1.12,7.71H195a8,8,0,0,1,0-16h40.42A79.94,79.94,0,0,0,168,124a8,8,0,0,1,0-16,96,96,0,0,1,82.14,98.29ZM172,108a44,44,0,0,1-8.54,26.15,8,8,0,0,1-13.08-9.15,28,28,0,1,0-48.76,0,8,8,0,1,1-13.08,9.15A44,44,0,1,1,172,108Z" />
  </svg>
);

export const PhosphorArrowRight: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
  </svg>
);

export const PhosphorCheck: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
  </svg>
);

export const PhosphorLockKey: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-80-68v24a8,8,0,0,1-16,0V140a16,16,0,1,1,16,0Z" />
  </svg>
);

export const PhosphorPhoneCall: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M222.37,158.46l-47.11-21.11a16,16,0,0,0-15.17,1.4L136.4,154.2a111.41,111.41,0,0,1-50.6-50.6L101.25,79.91a16,16,0,0,0,1.4-15.17L81.54,17.63A16,16,0,0,0,67,8H32A16,16,0,0,0,16,24,192,192,0,0,0,208,216a16,16,0,0,0,16-16V173A16,16,0,0,0,222.37,158.46ZM208,200A176.12,176.12,0,0,1,32,24H67L87,69.57,67.6,89a8,8,0,0,0-.73,9.58,127.38,127.38,0,0,0,66.55,66.55,8,8,0,0,0,9.58-.73L162.43,145,208,165.43ZM152,40a8,8,0,0,1,8-8,72.08,72.08,0,0,1,72,72,8,8,0,0,1-16,0,56.06,56.06,0,0,0-56-56A8,8,0,0,1,152,40Zm24,32a8,8,0,0,1,8-8,40,40,0,0,1,40,40,8,8,0,0,1-16,0,24,24,0,0,0-24-24A8,8,0,0,1,176,72Z" />
  </svg>
);

export const PhosphorSparkle: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M213.66,101.66l-50.4-14.4-14.4-50.4a8,8,0,0,0-15.72,0l-14.4,50.4-50.4,14.4a8,8,0,0,0,0,15.72l50.4,14.4,14.4,50.4a8,8,0,0,0,15.72,0l14.4-50.4,50.4-14.4a8,8,0,0,0,0-15.72Zm-73.66,18.34a8,8,0,0,0-5.66,5.66L128,147l-6.34-21.34a8,8,0,0,0-5.66-5.66L94.66,114l21.34-6.34a8,8,0,0,0,5.66-5.66L128,81l6.34,21.34a8,8,0,0,0,5.66,5.66L161.34,114ZM88,208a8,8,0,0,1-8,8H56v24a8,8,0,0,1-16,0V216H16a8,8,0,0,1,0-16H40V176a8,8,0,0,1,16,0v24H80A8,8,0,0,1,88,208Zm144-48a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0v-8h-8a8,8,0,0,1,0-16h8v-8a8,8,0,0,1,16,0v8h8A8,8,0,0,1,232,160Z" />
  </svg>
);

export const PhosphorHospital: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M240,192H224V40a16,16,0,0,0-16-16H48A16,16,0,0,0,32,40V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,40H208V192H152V152a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40H48ZM136,192H120V160h16ZM144,88a8,8,0,0,1-8,8H128v8a8,8,0,0,1-16,0V96H104a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,144,88Z" />
  </svg>
);

export const PhosphorCalendarCheck: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-34.34-77.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L120,172.69l42.34-42.35A8,8,0,0,1,173.66,130.34Z" />
  </svg>
);

export const PhosphorWarningCircle: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
  </svg>
);

export const PhosphorDeviceMobile: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,40a8,8,0,0,1,8-8h96a8,8,0,0,1,8,8v136H72ZM184,216a8,8,0,0,1-8,8H80a8,8,0,0,1-8-8V192H184Zm-56-12a12,12,0,1,0-12-12A12,12,0,0,0,128,204Z" />
  </svg>
);

export const PhosphorFileText: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-40-64a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16h48A8,8,0,0,1,160,152Zm0,32a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16h48A8,8,0,0,1,160,184Zm-72-64a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,120Z" />
  </svg>
);

export const PhosphorCaretDown: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
  </svg>
);

export const PhosphorQrCode: React.FC<IconProps> = ({ size = 20, weight = "regular", className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M120,48V96a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8h48A8,8,0,0,1,120,48ZM104,56H72V88h32ZM48,136v72a8,8,0,0,0,8,8h72a8,8,0,0,0,8-8V136a8,8,0,0,0-8-8H56A8,8,0,0,0,48,136Zm72,64H64V144h56ZM200,40H144a8,8,0,0,0-8,8V96a8,8,0,0,0,8,8h56a8,8,0,0,0,8-8V48A8,8,0,0,0,200,40Zm-8,48H152V56h40Zm-56,48v16a8,8,0,0,0,8,8h16v16H144a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0v-8h16a8,8,0,0,0,8-8V168h24a8,8,0,0,0,0-16H184V144a8,8,0,0,0-8-8H144a8,8,0,0,0-8,8Zm64,32v32a8,8,0,0,0,16,0V168a8,8,0,0,0-16,0Z" />
  </svg>
);

