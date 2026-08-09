import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import RegisterFlow from "@/components/RegisterFlow";

export const metadata: Metadata = {
  title: "Kayıt Ol | KAMPÜS.",
  description:
    "Yaşar öğrenci e-postanı doğrula ve KAMPÜS hesabını oluştur.",
};

export default async function RegisterPage({
  searchParams,
}: PageProps<"/kayit">) {
  const query = await searchParams;
  const previewProfileStep =
    process.env.NODE_ENV !== "production" && query.preview === "profile";
  const previewAvatarStep =
    process.env.NODE_ENV !== "production" && query.preview === "avatar";

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
      <RegisterFlow
        previewAvatarStep={previewAvatarStep}
        previewProfileStep={previewProfileStep}
      />
    </AuthShell>
  );
}
