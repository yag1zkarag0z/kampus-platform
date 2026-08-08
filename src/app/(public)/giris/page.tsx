import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import LoginFlow from "@/components/LoginFlow";

export const metadata: Metadata = {
  title: "Giriş Yap | KAMPÜS.",
  description:
    "Yaşar öğrenci e-postanla doğrulama kodu al ve KAMPÜS hesabına giriş yap.",
};

export default function LoginPage() {
  return (
    <AuthShell
      mode="login"
      title={
        <>
          KAMPÜS’e giriş yap<span className="text-brand">.</span>
        </>
      }
      description="Öğrenci e-postanla devam et."
    >
      <LoginFlow />
    </AuthShell>
  );
}
