import { describe, expect, it } from "vitest";
import {
  loginSchema,
  meetingLogSchema,
  menteeRegistrationSchema,
  mentorRegistrationSchema,
  semesterSchema,
} from "@/lib/validators";

const validMentor = {
  role: "MENTOR" as const,
  name: "Alice Wanjiku",
  email: "ALICE@Example.com",
  password: "Password123",
  registrationNumber: "ENG/M/001/22",
  department: "Civil Engineering",
  programme: "BSc Civil Engineering",
  yearOfStudy: 4,
  strongModules: ["Structural Analysis"],
  interests: ["Football"],
  hoursPerWeek: 3,
  maxMentees: 3,
  crossDepartment: true,
};

const validMentee = {
  role: "MENTEE" as const,
  name: "David Kiprop",
  email: "david@example.com",
  password: "Password123",
  registrationNumber: "ENG/S/101/25",
  department: "Civil Engineering",
  programme: "BSc Civil Engineering",
  sameDepartmentPreferred: true,
  interests: ["Football"],
};

describe("mentorRegistrationSchema", () => {
  it("accepts a valid mentor and lowercases the email", () => {
    const parsed = mentorRegistrationSchema.parse(validMentor);
    expect(parsed.email).toBe("alice@example.com");
  });

  it("rejects weak passwords", () => {
    expect(
      mentorRegistrationSchema.safeParse({
        ...validMentor,
        password: "short",
      }).success
    ).toBe(false);
    expect(
      mentorRegistrationSchema.safeParse({
        ...validMentor,
        password: "alllowercase1",
      }).success
    ).toBe(false);
  });

  it("rejects out-of-range capacity", () => {
    expect(
      mentorRegistrationSchema.safeParse({ ...validMentor, maxMentees: 0 })
        .success
    ).toBe(false);
    expect(
      mentorRegistrationSchema.safeParse({ ...validMentor, maxMentees: 50 })
        .success
    ).toBe(false);
  });

  it("requires at least one interest and one strong module", () => {
    expect(
      mentorRegistrationSchema.safeParse({ ...validMentor, interests: [] })
        .success
    ).toBe(false);
    expect(
      mentorRegistrationSchema.safeParse({ ...validMentor, strongModules: [] })
        .success
    ).toBe(false);
  });

  // Departments are an admin-managed catalogue checked against the database
  // by /api/register; the schema only requires one to be chosen.
  it("requires a department", () => {
    expect(
      mentorRegistrationSchema.safeParse({
        ...validMentor,
        department: "",
      }).success
    ).toBe(false);
  });
});

describe("menteeRegistrationSchema", () => {
  it("accepts a valid mentee", () => {
    expect(menteeRegistrationSchema.safeParse(validMentee).success).toBe(true);
  });

  it("allows custom interests", () => {
    const parsed = menteeRegistrationSchema.parse({
      ...validMentee,
      interests: ["Underwater basket weaving"],
    });
    expect(parsed.interests[0]).toBe("Underwater basket weaving");
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(
      false
    );
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success
    ).toBe(true);
  });
});

describe("meetingLogSchema", () => {
  it("coerces date strings and numeric durations", () => {
    const parsed = meetingLogSchema.parse({
      pairingId: "p1",
      date: "2026-03-01T10:00",
      durationMinutes: "45",
      topics: "Exam prep",
    });
    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.durationMinutes).toBe(45);
  });

  it("rejects absurd durations", () => {
    expect(
      meetingLogSchema.safeParse({
        pairingId: "p1",
        date: "2026-03-01",
        durationMinutes: 1000,
        topics: "Too long",
      }).success
    ).toBe(false);
  });
});

describe("semesterSchema", () => {
  it("requires endDate after startDate", () => {
    expect(
      semesterSchema.safeParse({
        name: "2026 Semester 1",
        startDate: "2026-05-01",
        endDate: "2026-01-01",
      }).success
    ).toBe(false);
  });
});
