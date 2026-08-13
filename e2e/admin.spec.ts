import { expect, test } from "@playwright/test";

import { promoteE2eUserToAdmin } from "./helpers/database";
import {
  createUniqueStudentIdentity,
  loginMemberSession,
  seedMemberSession,
} from "./helpers/session";

test("an admin can change a member role with a recorded reason", async ({
  browser,
  page,
}) => {
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  const member = createUniqueStudentIdentity("moderation-target");

  try {
    await seedMemberSession(memberPage, member);
  } finally {
    await memberContext.close();
  }

  const admin = createUniqueStudentIdentity("admin");
  await seedMemberSession(page, admin);
  await promoteE2eUserToAdmin(admin.email);
  await page.context().clearCookies();
  await loginMemberSession(page, admin);

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "KAMPÜS Moderasyon" }),
  ).toBeVisible();
  const adminPanel = page.locator(
    'section[aria-labelledby="admin-panel-title"]',
  );
  await adminPanel.getByRole("button", { name: "Kullanıcılar" }).click();

  const memberRow = adminPanel
    .getByRole("listitem")
    .filter({ hasText: `@${member.username}` });
  await expect(memberRow).toBeVisible();
  await memberRow
    .getByPlaceholder("Rol veya hesap işlemi gerekçesi")
    .fill("E2E moderasyon görevlendirmesi.");
  await memberRow.getByRole("combobox").selectOption("moderator");

  const confirmation = page.getByRole("dialog", {
    name: `@${member.username} rolü değiştirilsin mi?`,
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Rolü değiştir" }).click();
  await expect(memberRow.getByRole("combobox")).toHaveValue("moderator");

  await adminPanel.getByRole("button", { name: /Geçmiş/ }).click();
  const historyEntry = adminPanel
    .getByRole("listitem")
    .filter({ hasText: `@${member.username}` });
  await expect(
    historyEntry.getByText(
      "member → moderator · E2E moderasyon görevlendirmesi.",
    ),
  ).toBeVisible();
});
