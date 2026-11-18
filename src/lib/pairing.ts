import { db } from "@/lib/db";
import { sendMail } from "@/lib/email/mailer";
import {
  pairingEmailForMentee,
  pairingEmailForMentor,
  waitlistAdminEmail,
} from "@/lib/email/templates";

/**
 * Automatic mentor/mentee pairing.
 *
 * Matching priority (per programme rules):
 *   1. Same department — hard filter when the mentee requested it,
 *      otherwise a scoring bonus. Mentors who do not accept students
 *      from other departments are only eligible for same-department
 *      mentees.
 *   2. Shared interests — one point per common interest.
 *   3. Mentor availability — hours per week and remaining capacity.
 *   4. Random selection between equally scored candidates.
 *
 * Mentor capacity (maxMentees) is never exceeded; the capacity check is
 * re-run inside a transaction to avoid double-assignment races.
 */

export interface MentorCandidate {
  id: string;
  department: string;
  crossDepartment: boolean;
  hoursPerWeek: number;
  maxMentees: number;
  activeMentees: number;
  interestIds: string[];
}

export interface MenteeForPairing {
  id: string;
  department: string;
  sameDepartmentPreferred: boolean;
  interestIds: string[];
}

export interface ScoredMentor {
  mentor: MentorCandidate;
  score: number;
}

const WEIGHT_DEPARTMENT = 100;
const WEIGHT_INTEREST = 10;

/** Pure scoring/selection logic — unit tested in isolation. */
export function rankMentors(
  mentee: MenteeForPairing,
  mentors: MentorCandidate[],
  random: () => number = Math.random
): ScoredMentor | null {
  const eligible = mentors.filter((m) => {
    if (m.activeMentees >= m.maxMentees) return false;
    const sameDepartment = m.department === mentee.department;
    // Mentee insists on same department.
    if (mentee.sameDepartmentPreferred && !sameDepartment) return false;
    // Mentor does not accept other departments.
    if (!m.crossDepartment && !sameDepartment) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const menteeInterests = new Set(mentee.interestIds);

  const scored: ScoredMentor[] = eligible.map((mentor) => {
    let score = 0;
    if (mentor.department === mentee.department) score += WEIGHT_DEPARTMENT;
    const shared = mentor.interestIds.filter((id) =>
      menteeInterests.has(id)
    ).length;
    score += shared * WEIGHT_INTEREST;
    // Availability: free slots and weekly hours break near-ties.
    score += (mentor.maxMentees - mentor.activeMentees) * 2;
    score += Math.min(mentor.hoursPerWeek, 10);
    return { mentor, score };
  });

  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best);
  // Random tie-break.
  return top[Math.floor(random() * top.length)];
}

export interface PairingResult {
  status: "paired" | "waitlisted" | "skipped";
  pairingId?: string;
  mentorUserId?: string;
}

/**
 * Attempt to pair a single approved mentee. Called right after admin
 * approval and again whenever a new mentor becomes available.
 */
export async function attemptPairing(
  menteeProfileId: string
): Promise<PairingResult> {
  const mentee = await db.menteeProfile.findUnique({
    where: { id: menteeProfileId },
    include: {
      user: true,
      interests: true,
      semester: { select: { programId: true } },
      pairings: { where: { status: "ACTIVE" } },
    },
  });

  if (!mentee || mentee.user.status !== "APPROVED") {
    return { status: "skipped" };
  }
  if (mentee.pairings.length > 0) {
    return { status: "skipped" };
  }

  // Candidates come from the mentee's own cohort, which belongs to exactly
  // one programme, so a pairing can never cross programmes.
  const mentors = await db.mentorProfile.findMany({
    where: {
      semesterId: mentee.semesterId,
      user: { status: "APPROVED" },
    },
    include: {
      user: true,
      interests: true,
      pairings: { where: { status: "ACTIVE" } },
    },
  });

  const candidates: MentorCandidate[] = mentors.map((m) => ({
    id: m.id,
    department: m.department,
    crossDepartment: m.crossDepartment,
    hoursPerWeek: m.hoursPerWeek,
    maxMentees: m.maxMentees,
    activeMentees: m.pairings.length,
    interestIds: m.interests.map((i) => i.interestId),
  }));

  const choice = rankMentors(
    {
      id: mentee.id,
      department: mentee.department,
      sameDepartmentPreferred: mentee.sameDepartmentPreferred,
      interestIds: mentee.interests.map((i) => i.interestId),
    },
    candidates
  );

  if (!choice) {
    await waitlistMentee(
      mentee.id,
      mentee.user.name,
      mentee.department,
      mentee.semester.programId
    );
    return { status: "waitlisted" };
  }

  const chosenMentor = mentors.find((m) => m.id === choice.mentor.id)!;

  // Transaction with a re-checked capacity guard: another request may
  // have assigned a mentee to this mentor between read and write.
  const pairing = await db.$transaction(async (tx) => {
    const activeCount = await tx.pairing.count({
      where: { mentorProfileId: chosenMentor.id, status: "ACTIVE" },
    });
    if (activeCount >= chosenMentor.maxMentees) {
      return null;
    }
    return tx.pairing.create({
      data: {
        mentorProfileId: chosenMentor.id,
        menteeProfileId: mentee.id,
        semesterId: mentee.semesterId,
        programId: mentee.semester.programId,
        matchScore: choice.score,
      },
    });
  });

  if (!pairing) {
    // Lost the race — retry once against the remaining pool.
    return attemptPairing(menteeProfileId);
  }

  await db.menteeProfile.update({
    where: { id: mentee.id },
    data: { waitlisted: false, waitlistedAt: null },
  });

  const menteeMail = pairingEmailForMentee(
    mentee.user.name,
    chosenMentor.user.name,
    chosenMentor.user.email
  );
  const mentorMail = pairingEmailForMentor(
    chosenMentor.user.name,
    mentee.user.name,
    mentee.user.email
  );
  await Promise.all([
    sendMail({ to: mentee.user.email, ...menteeMail }),
    sendMail({ to: chosenMentor.user.email, ...mentorMail }),
  ]);

  return {
    status: "paired",
    pairingId: pairing.id,
    mentorUserId: chosenMentor.userId,
  };
}

async function waitlistMentee(
  menteeProfileId: string,
  menteeName: string,
  department: string,
  programId: string | null
): Promise<void> {
  await db.menteeProfile.update({
    where: { id: menteeProfileId },
    data: { waitlisted: true, waitlistedAt: new Date() },
  });

  // Tell the programme's own staff — not every administrator on Menty.
  const admins = programId
    ? await db.user.findMany({
        where: {
          status: "APPROVED",
          roleAssignments: { some: { programId, revokedAt: null } },
        },
      })
    : [];

  await db.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "WAITLIST" as const,
      title: "Mentee waitlisted",
      body: `${menteeName} (${department}) could not be paired — no mentor with free capacity.`,
    })),
  });

  const mail = waitlistAdminEmail(menteeName, department);
  await Promise.all(
    admins.map((admin) => sendMail({ to: admin.email, ...mail }))
  );
}

/**
 * Retry pairing for every waitlisted mentee in a semester — invoked
 * when a new mentor is approved or a pairing is ended/reassigned.
 * Oldest waitlist entries get priority.
 */
export async function retryWaitlist(semesterId: string): Promise<number> {
  const waitlisted = await db.menteeProfile.findMany({
    where: {
      semesterId,
      waitlisted: true,
      user: { status: "APPROVED" },
    },
    orderBy: { waitlistedAt: "asc" },
    select: { id: true },
  });

  let paired = 0;
  for (const mentee of waitlisted) {
    const result = await attemptPairing(mentee.id);
    if (result.status === "paired") paired += 1;
  }
  return paired;
}
