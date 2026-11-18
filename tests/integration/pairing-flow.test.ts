import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  menteeProfile: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  mentorProfile: { findMany: vi.fn() },
  pairing: { count: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/email/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
  sendBulkMail: vi.fn(),
}));

import { attemptPairing } from "@/lib/pairing";

const approvedMentee = {
  id: "mentee-1",
  semesterId: "sem-1",
  semester: { programId: "prog-1" },
  department: "Civil Engineering",
  sameDepartmentPreferred: false,
  user: { id: "u-mentee", name: "Mentee", email: "mentee@x.com", status: "APPROVED" },
  interests: [{ interestId: "i1" }],
  pairings: [],
};

const availableMentor = {
  id: "mentor-1",
  userId: "u-mentor",
  semesterId: "sem-1",
  department: "Civil Engineering",
  crossDepartment: true,
  hoursPerWeek: 4,
  maxMentees: 3,
  user: { id: "u-mentor", name: "Mentor", email: "mentor@x.com", status: "APPROVED" },
  interests: [{ interestId: "i1" }],
  pairings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.menteeProfile.findUnique.mockResolvedValue(approvedMentee);
  dbMock.mentorProfile.findMany.mockResolvedValue([availableMentor]);
  dbMock.menteeProfile.update.mockResolvedValue({});
  dbMock.user.findMany.mockResolvedValue([
    { id: "admin-1", email: "admin@x.com", name: "Admin" },
  ]);
  dbMock.notification.createMany.mockResolvedValue({ count: 1 });
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => {
      dbMock.pairing.count.mockResolvedValue(0);
      dbMock.pairing.create.mockResolvedValue({ id: "pairing-1" });
      return fn(dbMock);
    }
  );
});

describe("attemptPairing", () => {
  it("pairs an approved mentee with an available mentor and emails both", async () => {
    const result = await attemptPairing("mentee-1");
    expect(result.status).toBe("paired");
    expect(result.pairingId).toBe("pairing-1");
    // clears the waitlist flag
    expect(dbMock.menteeProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { waitlisted: false, waitlistedAt: null },
      })
    );
    // the pairing is recorded in the mentee's programme
    expect(dbMock.pairing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ programId: "prog-1" }),
    });
    // one email each to mentee and mentor
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("waitlists the mentee and notifies admins when no mentor fits", async () => {
    dbMock.mentorProfile.findMany.mockResolvedValue([]);
    const result = await attemptPairing("mentee-1");
    expect(result.status).toBe("waitlisted");
    expect(dbMock.menteeProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ waitlisted: true }),
      })
    );
    expect(dbMock.notification.createMany).toHaveBeenCalled();
    // Only staff of the mentee's own programme are told.
    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      where: {
        status: "APPROVED",
        roleAssignments: { some: { programId: "prog-1", revokedAt: null } },
      },
    });
    expect(sendMail).toHaveBeenCalled(); // admin alert
  });

  it("skips unapproved mentees", async () => {
    dbMock.menteeProfile.findUnique.mockResolvedValue({
      ...approvedMentee,
      user: { ...approvedMentee.user, status: "PENDING" },
    });
    const result = await attemptPairing("mentee-1");
    expect(result.status).toBe("skipped");
  });

  it("skips mentees who already have an active pairing", async () => {
    dbMock.menteeProfile.findUnique.mockResolvedValue({
      ...approvedMentee,
      pairings: [{ id: "existing" }],
    });
    const result = await attemptPairing("mentee-1");
    expect(result.status).toBe("skipped");
  });

  it("never exceeds mentor capacity", async () => {
    dbMock.mentorProfile.findMany.mockResolvedValue([
      { ...availableMentor, maxMentees: 1, pairings: [{ id: "p" }] },
    ]);
    const result = await attemptPairing("mentee-1");
    expect(result.status).toBe("waitlisted");
    expect(dbMock.pairing.create).not.toHaveBeenCalled();
  });
});
