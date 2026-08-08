import { ImageResponse } from "next/og";

export const alt = "KAMPÜS. | Yaşar Öğrencileri İçin Sosyal Ağ";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b0b0c",
          backgroundImage:
            "radial-gradient(ellipse 120% 80% at 82% -8%, rgba(255,122,69,0.22) 0%, transparent 55%), radial-gradient(ellipse 90% 70% at -8% 112%, rgba(94,74,196,0.18) 0%, transparent 58%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: "#ffffff",
          }}
        >
          <span>KAMP</span>

          <svg
            width="88"
            height="106"
            viewBox="0 0 30 36"
            style={{ margin: "0 4px 6px" }}
          >
            <path
              d="M5.2 19.5c1.1 8.2 4.7 12.4 9.8 12.4s8.7-4.2 9.8-12.4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="5.2"
              strokeLinecap="round"
            />
            <rect
              x="6.6"
              y="2"
              width="6.8"
              height="9.3"
              rx="3.4"
              transform="rotate(-5 10 6.65)"
              fill="#4a2c39"
              stroke="#ff6b3d"
              strokeWidth="0.85"
            />
            <rect
              x="16.9"
              y="1.5"
              width="6.8"
              height="9.6"
              rx="3.4"
              transform="rotate(5 20.3 6.3)"
              fill="#4a2c39"
              stroke="#ff6b3d"
              strokeWidth="0.85"
            />
          </svg>

          <span>S</span>
          <span style={{ color: "#ff6b3d" }}>.</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#ff6b3d",
            textTransform: "uppercase",
          }}
        >
          Yaşar öğrencilerinin bağımsız kampüs ağı
        </div>
      </div>
    ),
    { ...size },
  );
}
