import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { VISIBLE_STATUSES } from "@/lib/program-rules";

export interface MarketplaceFilters {
  q?: string;
  institution?: string; // institution id, "independent" or "menty"
  category?: string;
  model?: string;
  mode?: string;
  open?: boolean;
  audience?: string;
  tag?: string;
}

/**
 * Public programme directory: only PUBLIC programmes that are published (or
 * running, paused, completed). Unlisted and private programmes never appear.
 */
export async function searchPrograms(f: MarketplaceFilters) {
  const now = new Date();
  const and: Prisma.MentorshipProgramWhereInput[] = [
    { visibility: "PUBLIC" },
    { status: { in: VISIBLE_STATUSES } },
  ];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { tagline: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { careerTags: { has: f.q } },
        { institution: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.institution === "independent") and.push({ ownerType: "INDEPENDENT" });
  else if (f.institution === "menty") and.push({ ownerType: "PLATFORM" });
  else if (f.institution) and.push({ institutionId: f.institution });
  if (f.category) and.push({ category: { equals: f.category, mode: "insensitive" } });
  if (f.model && ["PRESENTER_LED", "ONE_TO_ONE", "HYBRID"].includes(f.model)) {
    and.push({ deliveryModel: f.model as "PRESENTER_LED" | "ONE_TO_ONE" | "HYBRID" });
  }
  if (f.mode && ["ONLINE", "IN_PERSON", "BLENDED"].includes(f.mode)) {
    // "Online" also matches blended programmes, and so does "in person".
    and.push({
      deliveryMode: { in: f.mode === "BLENDED" ? ["BLENDED"] : [f.mode as "ONLINE" | "IN_PERSON", "BLENDED"] },
    });
  }
  if (f.audience) and.push({ targetAudience: { contains: f.audience, mode: "insensitive" } });
  if (f.tag) and.push({ careerTags: { has: f.tag } });
  if (f.open) {
    and.push(
      { status: { in: ["PUBLISHED", "ACTIVE"] } },
      { OR: [{ registrationOpensAt: null }, { registrationOpensAt: { lte: now } }] },
      { OR: [{ registrationClosesAt: null }, { registrationClosesAt: { gte: now } }] }
    );
  }

  return db.mentorshipProgram.findMany({
    where: { AND: and },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      category: true,
      logoUrl: true,
      coverImageUrl: true,
      ownerType: true,
      deliveryModel: true,
      deliveryMode: true,
      targetAudience: true,
      durationLabel: true,
      status: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      verificationStatus: true,
      careerTags: true,
      institution: { select: { id: true, name: true, shortName: true } },
      owner: { select: { name: true } },
      themes: { where: { variant: "PUBLISHED" }, select: { primaryColor: true, primaryContrast: true } },
    },
    // Menty's own network first (PLATFORM is the first enum value), then newest.
    orderBy: [{ ownerType: "asc" }, { publishedAt: "desc" }],
    take: 120,
  });
}

/** Values for the filter controls, taken from what is actually listed. */
export async function marketplaceFacets() {
  const visible = { visibility: "PUBLIC" as const, status: { in: VISIBLE_STATUSES } };
  const [institutions, categories, tags] = await Promise.all([
    db.institution.findMany({
      where: { programs: { some: visible } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.mentorshipProgram.findMany({
      where: { ...visible, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
    db.mentorshipProgram.findMany({ where: visible, select: { careerTags: true } }),
  ]);
  return {
    institutions,
    categories: categories.map((c) => c.category!).sort(),
    tags: [...new Set(tags.flatMap((t) => t.careerTags))].sort().slice(0, 40),
  };
}
