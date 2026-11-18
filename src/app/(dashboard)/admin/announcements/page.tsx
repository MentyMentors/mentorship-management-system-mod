import { db } from "@/lib/db";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { BulkEmailForm } from "@/components/admin/bulk-email-form";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const { scope } = await programPage(PERMISSIONS.ANNOUNCEMENT_SEND);
  const announcements = await db.announcement.findMany({
    where: { programId: scope.programId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <>
      <PageHeader
        title="Announcements & bulk email"
        description="Publish programme announcements and send bulk email to mentors and mentees."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnnouncementForm />
        <BulkEmailForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent announcements</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {announcement.emailSent && (
                  <Badge variant="success">Emailed</Badge>
                )}
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
