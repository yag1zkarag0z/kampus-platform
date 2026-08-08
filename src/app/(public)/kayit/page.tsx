import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import RegisterFlow from "@/components/RegisterFlow";

export const metadata: Metadata = {
  title: "Kayıt Ol | KAMPÜS.",
  description:
    "Yaşar öğrenci e-postanı doğrula ve KAMPÜS hesabını oluştur.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      mode="register"
      title={
        <>
          Hesabını oluştur<span className="text-brand">.</span>
        </>
      }
      description="Öğrenci e-postanı doğrula, profilini tamamla."
    >
      <RegisterFlow />
    </AuthShell>
  );
}
