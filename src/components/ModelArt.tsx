import type { ModelDefinition } from "../types";
export default function ModelArt({ model }: { model: ModelDefinition }) {
  const k = model.kind;
  return (
    <svg className="model-art" viewBox="0 0 160 90" aria-hidden="true">
      <defs>
        <linearGradient id={`metal-${model.id}`} x1="0" y1="0" x2=".5" y2="1">
          <stop stopColor="#bfcac4" />
          <stop offset=".45" stopColor="#798781" />
          <stop offset="1" stopColor="#36423d" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="75" rx="52" ry="5" fill="#000" opacity=".25" />
      <g fill={`url(#metal-${model.id})`} stroke="#94a79b" strokeWidth=".6">
        {k === "car" || k === "truck" ? (
          <>
            <path
              d={
                k === "car"
                  ? "M25 55 38 47 58 43 74 29 101 30 120 45 137 53 137 65 26 65Z"
                  : "M22 33H92V52H99V38H120L138 53V67H22Z"
              }
            />
            <path d="M64 44 77 33H98L112 44Z" fill="#263a35" />
            <circle cx="50" cy="64" r="11" fill="#1a201e" />
            <circle cx="116" cy="64" r="11" fill="#1a201e" />
            <circle cx="50" cy="64" r="5" />
            <circle cx="116" cy="64" r="5" />
          </>
        ) : k === "aircraft" || k === "drone" ? (
          <>
            <path d="M18 54 71 44 92 15 102 15 91 44 140 53 141 59 89 57 75 75 65 75 70 56 20 60Z" />
            <path d="M120 52 111 32H119L135 52Z" />
          </>
        ) : k === "sphere" ? (
          <circle cx="80" cy="47" r="29" />
        ) : k === "cube" || k === "building" || k === "custom" ? (
          <>
            <path d="M49 32 87 20 116 36 79 50Z" />
            <path d="M49 32V65L79 80V50Z" fill="#4b5c52" />
            <path d="M79 50 116 36V65L79 80Z" />
          </>
        ) : k === "torus" ? (
          <ellipse
            cx="80"
            cy="48"
            rx="37"
            ry="22"
            fill="none"
            stroke="#84968b"
            strokeWidth="15"
          />
        ) : k === "cone" || k === "rocket" ? (
          <path d="M24 61 119 29 132 57 119 70Z" />
        ) : k === "cylinder" ? (
          <>
            <path d="M45 28H115V66H45Z" />
            <ellipse cx="45" cy="47" rx="13" ry="19" />
            <ellipse cx="115" cy="47" rx="13" ry="19" />
          </>
        ) : k === "bridge" ? (
          <>
            <path d="M20 50H142V59H20Z" />
            <path d="M39 29H47V75H39ZM113 29H121V75H113Z" />
            <path d="M20 50 42 30 80 50 117 30 142 50" fill="none" />
          </>
        ) : k === "plate" ? (
          <path d="M37 45 112 24 129 51 55 73Z" />
        ) : (
          <path d="M22 55C32 17 77 27 140 53 95 71 42 76 22 55Z" />
        )}
      </g>
    </svg>
  );
}
