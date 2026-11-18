import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadActor } from "@/lib/rbac/actor";
import { visibleAnnouncementsWhere } from "@/services/announcements";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const session = await auth();

  const actor = await loadActor(session!.user.id);

  const announcements = await db.announcement.findMany({
    where: visibleAnnouncementsWhere(actor),
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Programme updates from the coordinators."
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          {announcements.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No announcements yet.
            </p>
          )}
          {announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-lg border p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{announcement.title}</h3>
                <Badge variant="secondary">{announcement.audience}</Badge>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {announcement.body}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {announcement.createdBy.name} ·{" "}
                {formatDateTime(announcement.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
