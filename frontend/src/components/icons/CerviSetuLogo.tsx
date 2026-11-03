import React from "react";

interface LogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "width" | "height"> {
  size?: number | string;
}

/** CerviSetu emblem: teal cervical cancer awareness ribbon with care cross and new growth. */
export const CerviSetuLogo: React.FC<LogoProps> = ({ size = 24, className, ...props }) => (
  <img
    src="/cervisetu-logo.png"
    width={size}
    height={size}
    alt="CerviSetu"
    draggable={false}
    className={`object-contain select-none ${className ?? ""}`}
    {...props}
  />
);
