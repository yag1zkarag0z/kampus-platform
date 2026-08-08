"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          padding: "24px",
          boxSizing: "border-box",
          background: "#0b0b0c",
          color: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <title>KAMPÜS. | Bir şey ters gitti</title>
        <main style={{ width: "100%", maxWidth: "460px", textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: "52px",
              height: "52px",
              margin: "0 auto",
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "999px",
              color: "#ff6b3d",
              fontWeight: 900,
              fontSize: "18px",
            }}
          >
            K.
          </div>
          <p
            style={{
              margin: "24px 0 0",
              color: "#ff6b3d",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Beklenmeyen bir hata
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "clamp(28px, 7vw, 42px)",
              lineHeight: 1.05,
              letterSpacing: "-0.045em",
            }}
          >
            KAMPÜS şu anda açılamıyor.
          </h1>
          <p
            style={{
              margin: "14px auto 0",
              maxWidth: "380px",
              color: "rgba(255,255,255,0.68)",
              fontSize: "14px",
              lineHeight: 1.65,
            }}
          >
            Geçici bir sorun oluştu. Sayfayı yeniden yükleyerek tekrar
            deneyebilirsin.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              minHeight: "46px",
              marginTop: "26px",
              border: 0,
              borderRadius: "999px",
              padding: "0 22px",
              background: "#ffffff",
              color: "#101012",
              font: "inherit",
              fontSize: "14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Yeniden dene
          </button>
        </main>
      </body>
    </html>
  );
}
