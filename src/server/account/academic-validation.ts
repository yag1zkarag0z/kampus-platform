import "server-only";

import {
  getCampusYearOptions,
  isListedYasarDepartment,
  yasarDepartmentGroups,
} from "@/data/yasarDepartments";

export type CampusAcademicDetails = {
  department?: string;
  year?: string;
};

export type CampusAcademicIssue = {
  field: "department" | "year";
  message: string;
};

const campusYearOptions = new Set(
  yasarDepartmentGroups.flatMap((group) =>
    group.departments.flatMap((department) =>
      getCampusYearOptions(department),
    ),
  ),
);

export function getCampusAcademicIssues({
  department,
  year,
}: CampusAcademicDetails): CampusAcademicIssue[] {
  const issues: CampusAcademicIssue[] = [];
  const hasValidDepartment =
    department === undefined || isListedYasarDepartment(department);
  const hasValidYear =
    year === undefined || campusYearOptions.has(year);

  if (!hasValidDepartment) {
    issues.push({
      field: "department",
      message: "Listeden geçerli bir Yaşar programı seç.",
    });
  }

  if (!hasValidYear) {
    issues.push({
      field: "year",
      message: "Listeden geçerli bir sınıf seç.",
    });
  }

  if (
    department !== undefined &&
    year !== undefined &&
    hasValidDepartment &&
    hasValidYear &&
    !getCampusYearOptions(department).includes(year)
  ) {
    issues.push({
      field: "year",
      message: "Seçilen sınıf, bölüm bilgisiyle uyumlu değil.",
    });
  }

  return issues;
}

export function toCampusAcademicFieldErrors(
  issues: CampusAcademicIssue[],
  {
    yearField = "year",
  }: {
    yearField?: "year" | "yearLabel";
  } = {},
) {
  return issues.reduce<Record<string, string[]>>((fieldErrors, issue) => {
    const field = issue.field === "year" ? yearField : issue.field;

    fieldErrors[field] = [
      ...(fieldErrors[field] ?? []),
      issue.message,
    ];

    return fieldErrors;
  }, {});
}
