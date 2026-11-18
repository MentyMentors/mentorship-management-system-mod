import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mocks --------------------------------------------------------

const dbMock = vi.hoisted(() => ({
  semester: { findFirst: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  mentorProfile: { findFirst: vi.fn(), create: vi.fn() },
  menteeProfile: { findFirst: vi.fn(), create: vi.fn() },
  mentorInterest: { createMany: vi.fn() },
  menteeInterest: { createMany: vi.fn() },
  interest: { findFirst: vi.fn(), create: vi.fn() },
  department: { findFirst: vi.fn() },
  programme: { findFirst: vi.fn() },
  platformSetting: { findUnique: vi.fn() },
  mentorshipProgram: { findUnique: vi.fn() },
  programMembership: { upsert: vi.fn() },
  emailVerificationToken: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/email/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(true),
  sendBulkMail: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}));

import { POST } from "@/app/api/register/route";

// ---- Helpers ------------------------------------------------------

const menteePayload = {
  role: "MENTEE",
  name: "Test Mentee",
  email: `mentee-${Math.random()}@example.com`,
  password: "Password123",
  registrationNumber: "ENG/S/900/25",
  department: "Civil Engineering",
  programme: "BSc Civil Engineering",
  sameDepartmentPreferred: false,
  interests: ["Football"],
};

function request(body: unknown, ip = `10.0.0.${Math.floor(Math.random() * 250)}`) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

const openSemester = {
  id: "sem-1",
  name: "2026 S1",
  isActive: true,
  isArchived: false,
  registrationOpen: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.semester.findFirst.mockResolvedValue(openSemester);
  dbMock.user.findUnique.mockResolvedValue(null);
  dbMock.menteeProfile.findFirst.mockResolvedValue(null);
  dbMock.mentorProfile.findFirst.mockResolvedValue(null);
  dbMock.interest.findFirst.mockResolvedValue({ id: "int-1", name: "Football" });
  dbMock.department.findFirst.mockResolvedValue({ id: "d-1", name: "Civil Engineering" });
  dbMock.programme.findFirst.mockResolvedValue({ id: "p-1", name: "BSc Civil Engineering" });
  dbMock.platformSetting.findUnique.mockResolvedValue({ key: "legacy.default_program_id", value: "prog-1" });
  dbMock.mentorshipProgram.findUnique.mockResolvedValue({ id: "prog-1", institutionId: "inst-1" });
  dbMock.programMembership.upsert.mockResolvedValue({});
  dbMock.emailVerificationToken.create.mockResolvedValue({});
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) => {
    dbMock.user.create.mockResolvedValue({
      id: "user-1",
      name: "Test Mentee",
      email: menteePayload.email,
    });
    dbMock.menteeProfile.create.mockResolvedValue({ id: "profile-1" });
    return fn(dbMock);
  });
});

// ---- Tests --------------------------------------------------------

describe("POST /api/register", () => {
  it("creates a pending mentee account", async () => {
    const res = await POST(request(menteePayload));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/reviewed by an administrator/i);
    expect(dbMock.$transaction).toHaveBeenCalledOnce();
    // Only the default programme's cohorts are considered...
    expect(dbMock.semester.findFirst).toHaveBeenCalledWith({
      where: { isActive: true, isArchived: false, programId: "prog-1" },
    });
    // ...and the new account joins that programme as a PENDING mentee.
    expect(dbMock.programMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          programId: "prog-1",
          userId: "user-1",
          role: "MENTEE",
          status: "PENDING",
          cohortId: "sem-1",
        }),
      })
    );
  });

  it("rejects invalid payloads with 422", async () => {
    const res = await POST(request({ ...menteePayload, email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  it("rejects when registration is closed", async () => {
    dbMock.semester.findFirst.mockResolvedValue({
      ...openSemester,
      registrationOpen: false,
    });
    const res = await POST(request(menteePayload));
    expect(res.status).toBe(409);
  });

  it("rejects when no active semester exists", async () => {
    dbMock.semester.findFirst.mockResolvedValue(null);
    const res = await POST(request(menteePayload));
    expect(res.status).toBe(409);
  });

  it("rejects duplicate emails", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(request(menteePayload));
    expect(res.status).toBe(409);
  });

  it("rejects duplicate registration numbers in the same semester", async () => {
    dbMock.menteeProfile.findFirst.mockResolvedValue({ id: "existing" });
    const res = await POST(request(menteePayload));
    expect(res.status).toBe(409);
  });

  it("rate limits repeated attempts from the same IP", async () => {
    const ip = "192.168.9.9";
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      dbMock.user.findUnique.mockResolvedValue({ id: "existing" }); // short-circuit
      const res = await POST(request(menteePayload, ip));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
