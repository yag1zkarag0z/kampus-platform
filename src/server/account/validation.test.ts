import { describe, expect, it } from "vitest";

import { AuthError } from "@/server/auth/errors";
import {
  parseAuthInput,
  registerSchema,
} from "@/server/auth/validation";

import {
  parseAccountInput,
  updateProfileSchema,
} from "./validation";

function expectInvalidInput(
  action: () => unknown,
  field: string,
) {
  let caughtError: unknown;

  try {
    action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({
    code: "INVALID_REQUEST",
    status: 400,
  });
  expect(
    (caughtError as AuthError).fieldErrors[field],
  ).toBeDefined();
}

const validRegistration = {
  registrationToken: "r".repeat(32),
  username: "test.user",
  displayName: "Test User",
  department: "Yazılım Mühendisliği",
  yearLabel: "2. sınıf",
  bio: "",
  showDepartment: false,
  termsAccepted: true as const,
};

describe("campus academic profile validation", () => {
  it("accepts valid full and partial profile updates", () => {
    expect(
      parseAccountInput(updateProfileSchema, {
        department: "Bilgisayar Programcılığı",
        year: "2. sınıf",
      }),
    ).toEqual({
      department: "Bilgisayar Programcılığı",
      year: "2. sınıf",
    });
    expect(
      parseAccountInput(updateProfileSchema, {
        department: "Lisansüstü program",
      }),
    ).toEqual({
      department: "Lisansüstü program",
    });
    expect(
      parseAccountInput(updateProfileSchema, {
        year: "Lisansüstü",
      }),
    ).toEqual({
      year: "Lisansüstü",
    });
  });

  it("rejects an unlisted department and unknown year with field errors", () => {
    expectInvalidInput(
      () =>
        parseAccountInput(updateProfileSchema, {
          department: "Hayalî Bölüm",
        }),
      "department",
    );
    expectInvalidInput(
      () =>
        parseAccountInput(updateProfileSchema, {
          year: "99. sınıf",
        }),
      "year",
    );
  });

  it("rejects a department and year combination that cannot coexist", () => {
    expectInvalidInput(
      () =>
        parseAccountInput(updateProfileSchema, {
          department: "Bilgisayar Programcılığı",
          year: "4. sınıf",
        }),
      "year",
    );
  });

  it("applies the same academic rules to registration", () => {
    expect(
      parseAuthInput(registerSchema, validRegistration),
    ).toMatchObject({
      department: "Yazılım Mühendisliği",
      yearLabel: "2. sınıf",
    });

    expectInvalidInput(
      () =>
        parseAuthInput(registerSchema, {
          ...validRegistration,
          department: "Lisansüstü program",
          yearLabel: "2. sınıf",
        }),
      "yearLabel",
    );
    expectInvalidInput(
      () =>
        parseAuthInput(registerSchema, {
          ...validRegistration,
          department: "Sahte Fakülte",
        }),
      "department",
    );
  });
});
