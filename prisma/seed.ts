import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PREDEFINED_INTERESTS = [
  "Football",
  "Basketball",
  "Music",
  "Gaming",
  "Robotics",
  "Photography",
  "Reading",
  "Hiking",
  "Volunteering",
  "Entrepreneurship",
  "Chess",
  "Debate",
  "Art & Design",
  "Cooking",
  "Fitness",
];

async function main() {
  console.log("Seeding database...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@engineering.edu";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const samplePasswordHash = await bcrypt.hash("Password123!", 12);

  // ---- Interests -------------------------------------------------
  const interests: Record<string, string> = {};
  for (const name of PREDEFINED_INTERESTS) {
    const interest = await prisma.interest.upsert({
      where: { name },
      update: {},
      create: { name, isCustom: false },
    });
    interests[name] = interest.id;
  }

  // The programme created by the multi-tenant migration.
  const defaultProgram = await prisma.platformSetting.findUnique({
    where: { key: "legacy.default_program_id" },
  });
  if (!defaultProgram) {
    throw new Error("Run `prisma migrate deploy` before seeding: default programme missing.");
  }
  const programId = defaultProgram.value;

  // ---- Admin -----------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "System Administrator",
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.APPROVED,
      phone: "+254700000000",
      emailVerifiedAt: new Date(),
    },
  });

  // Super Admin on the platform and coordinator of the default programme.
  for (const [roleId, scope] of [
    ["role_super_admin", { scopeType: "PLATFORM" as const }],
    ["role_program_coordinator", { scopeType: "PROGRAM" as const, programId }],
  ] as const) {
    const existing = await prisma.roleAssignment.findFirst({
      where: { userId: admin.id, roleId, revokedAt: null },
    });
    if (!existing) {
      await prisma.roleAssignment.create({ data: { userId: admin.id, roleId, ...scope } });
    }
  }

  // ---- Semester --------------------------------------------------
  const semester = await prisma.semester.upsert({
    where: { name: "2026 Semester 1" },
    update: {},
    create: {
      name: "2026 Semester 1",
      startDate: new Date("2026-01-12"),
      endDate: new Date("2026-05-15"),
      isActive: true,
      registrationOpen: true,
      programId,
    },
  });

  // ---- Sample mentors --------------------------------------------
  const mentorsData = [
    {
      name: "Alice Wanjiku",
      email: "alice.mentor@students.engineering.edu",
      phone: "+254711000001",
      registrationNumber: "ENG/M/001/22",
      yearOfStudy: 4,
      programme: "BSc Civil Engineering",
      department: "Civil Engineering",
      strongModules: ["Structural Analysis", "Fluid Mechanics"],
      hoursPerWeek: 4,
      maxMentees: 3,
      crossDepartment: true,
      interests: ["Football", "Music", "Volunteering"],
    },
    {
      name: "Brian Otieno",
      email: "brian.mentor@students.engineering.edu",
      phone: "+254711000002",
      registrationNumber: "ENG/M/014/22",
      yearOfStudy: 4,
      programme: "BSc Electrical Engineering",
      department: "Electrical & Electronic Engineering",
      strongModules: ["Circuit Theory", "Digital Electronics"],
      hoursPerWeek: 3,
      maxMentees: 2,
      crossDepartment: false,
      interests: ["Gaming", "Robotics", "Chess"],
    },
    {
      name: "Cynthia Mwende",
      email: "cynthia.mentor@students.engineering.edu",
      phone: "+254711000003",
      registrationNumber: "ENG/M/032/23",
      yearOfStudy: 3,
      programme: "BSc Mechanical Engineering",
      department: "Mechanical Engineering",
      strongModules: ["Thermodynamics", "Engineering Drawing"],
      hoursPerWeek: 5,
      maxMentees: 4,
      crossDepartment: true,
      interests: ["Photography", "Hiking", "Reading"],
    },
  ];

  for (const m of mentorsData) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        name: m.name,
        email: m.email,
        phone: m.phone,
        passwordHash: samplePasswordHash,
        role: Role.MENTOR,
        status: UserStatus.APPROVED,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.programMembership.upsert({
      where: { programId_userId_role: { programId, userId: user.id, role: "MENTOR" } },
      update: {},
      create: { programId, userId: user.id, role: "MENTOR", status: "ACTIVE", cohortId: semester.id, joinedAt: new Date() },
    });

    const profile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        semesterId: semester.id,
        registrationNumber: m.registrationNumber,
        yearOfStudy: m.yearOfStudy,
        programme: m.programme,
        department: m.department,
        strongModules: m.strongModules,
        hoursPerWeek: m.hoursPerWeek,
        maxMentees: m.maxMentees,
        crossDepartment: m.crossDepartment,
      },
    });

    for (const interestName of m.interests) {
      await prisma.mentorInterest.upsert({
        where: {
          mentorProfileId_interestId: {
            mentorProfileId: profile.id,
            interestId: interests[interestName],
          },
        },
        update: {},
        create: {
          mentorProfileId: profile.id,
          interestId: interests[interestName],
        },
      });
    }
  }

  // ---- Sample mentees --------------------------------------------
  const menteesData = [
    {
      name: "David Kiprop",
      email: "david.mentee@students.engineering.edu",
      phone: "+254722000001",
      registrationNumber: "ENG/S/101/25",
      programme: "BSc Civil Engineering",
      department: "Civil Engineering",
      sameDepartmentPreferred: true,
      status: UserStatus.APPROVED,
      interests: ["Football", "Volunteering"],
    },
    {
      name: "Esther Njoki",
      email: "esther.mentee@students.engineering.edu",
      phone: "+254722000002",
      registrationNumber: "ENG/S/118/25",
      programme: "BSc Electrical Engineering",
      department: "Electrical & Electronic Engineering",
      sameDepartmentPreferred: false,
      status: UserStatus.APPROVED,
      interests: ["Gaming", "Music"],
    },
    {
      name: "Felix Mutua",
      email: "felix.mentee@students.engineering.edu",
      phone: "+254722000003",
      registrationNumber: "ENG/S/143/25",
      programme: "BSc Mechatronics Engineering",
      department: "Mechanical Engineering",
      sameDepartmentPreferred: false,
      status: UserStatus.PENDING,
      interests: ["Robotics", "Chess"],
    },
  ];

  for (const m of menteesData) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        name: m.name,
        email: m.email,
        phone: m.phone,
        passwordHash: samplePasswordHash,
        role: Role.MENTEE,
        status: m.status,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.programMembership.upsert({
      where: { programId_userId_role: { programId, userId: user.id, role: "MENTEE" } },
      update: {},
      create: {
        programId,
        userId: user.id,
        role: "MENTEE",
        status: m.status === UserStatus.APPROVED ? "ACTIVE" : "PENDING",
        cohortId: semester.id,
      },
    });

    const profile = await prisma.menteeProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        semesterId: semester.id,
        registrationNumber: m.registrationNumber,
        programme: m.programme,
        department: m.department,
        sameDepartmentPreferred: m.sameDepartmentPreferred,
      },
    });

    for (const interestName of m.interests) {
      await prisma.menteeInterest.upsert({
        where: {
          menteeProfileId_interestId: {
            menteeProfileId: profile.id,
            interestId: interests[interestName],
          },
        },
        update: {},
        create: {
          menteeProfileId: profile.id,
          interestId: interests[interestName],
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log("Sample mentor/mentee password: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
