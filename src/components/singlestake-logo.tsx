import { useId } from "react";

type SinglestakeLogoProps = {
  className?: string;
  /**
   * `horizontal` — ícone + texto numa linha (tabs, header mesa).
   * `stacked` — ícone por cima do texto (sidebar estreita).
   */
  variant?: "horizontal" | "stacked";
};

/**
 * Logótipo vectorial **singlestake**: ficha minimal + wordmark, alinhado ao tema escuro
 * (#060a14 / #080d18) e acentos ciano–esmeralda do produto.
 */
export function SinglestakeLogo({ className, variant = "horizontal" }: SinglestakeLogoProps) {
  const uid = useId().replace(/:/g, "");
  const grad = `singlestake-grad-${uid}`;
  const stroke = `singlestake-stroke-${uid}`;

  if (variant === "stacked") {
    return (
      <svg
        className={className}
        role="img"
        aria-label="singlestake"
        viewBox="0 0 120 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>singlestake</title>
        <defs>
          <linearGradient id={grad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id={stroke} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <g transform="translate(60 18)">
          <circle r="14" fill="#0a0f18" stroke={`url(#${grad})`} strokeWidth="1.35" opacity="0.95" />
          <circle r="9" fill="none" stroke="#22d3ee" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="2.5 2" />
          <path
            d="M0 -6 L0 6 M-3.5 -1.5 L0 -6 L3.5 -1.5"
            stroke={`url(#${stroke})`}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <text
          x="60"
          y="42"
          textAnchor="middle"
          fill={`url(#${grad})`}
          style={{
            fontFamily: "ui-sans-serif, system-ui, Segoe UI, sans-serif",
            fontSize: "11.5px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          singlestake
        </text>
      </svg>
    );
  }

  return (
    <svg
      className={className}
      role="img"
      aria-label="singlestake"
      viewBox="0 0 200 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>singlestake</title>
      <defs>
        <linearGradient id={grad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id={stroke} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <g transform="translate(16 16)">
        <circle r="13" fill="#0a0f18" stroke={`url(#${grad})`} strokeWidth="1.35" opacity="0.95" />
        <circle r="8.5" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2.5 2" />
        <path
          d="M0 -6 L0 6 M-3.5 -1.5 L0 -6 L3.5 -1.5"
          stroke={`url(#${stroke})`}
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="38"
        y="21.5"
        fill={`url(#${grad})`}
        style={{
          fontFamily: "ui-sans-serif, system-ui, Segoe UI, sans-serif",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "-0.035em",
        }}
      >
        singlestake
      </text>
    </svg>
  );
}
