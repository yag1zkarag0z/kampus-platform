import { expect, test } from "@playwright/test";

test("guest can send product feedback from the application shell", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByRole("button", { name: "Misafir olarak göz at" }).click();
  await expect(page).toHaveURL(/\/akis$/);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "Hesap menüsünü aç" }).click();
    await page.getByRole("menuitem", { name: "Geri bildirim" }).click();
  } else {
    await page.getByRole("button", { name: "Geri bildirim" }).click();
  }

  const dialog = page.getByRole("dialog", {
    name: "Bir şey mi fark ettin?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Hata" }).click();
  await dialog
    .getByPlaceholder("Ne oldu veya neyi daha iyi yapabiliriz?")
    .fill("Mobil menü açıldığında odak önceki düğmede kalıyor.");
  await dialog
    .getByRole("button", { name: "Geri bildirim gönder" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Teşekkürler." }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Teşekkürler." })
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
});
