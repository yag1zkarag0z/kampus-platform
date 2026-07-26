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
          Kampüse
          <span className="block font-serif font-normal italic text-[#7d3c2d] dark:text-[#d09272]">
            katıl.
          </span>
        </>
      }
      description="Yaşar öğrenci e-postanı doğrula ve hesabını oluştur."
    >
      <RegisterFlow />
    </AuthShell>
  );
}
