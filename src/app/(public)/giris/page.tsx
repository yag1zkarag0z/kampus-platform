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
          Kampüse
          <span className="block font-serif font-normal italic text-[#ff7a45]">
            geri dön.
          </span>
        </>
      }
      description="Öğrenci e-postanla şifresiz giriş yap."
    >
      <LoginFlow />
    </AuthShell>
  );
}
