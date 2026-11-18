import { db } from "@/lib/db";
import { platformPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResolveIssueButton } from "@/components/admin/resolve-issue-button";

export const metadata = { title: "Issue reports" };
export const dynamic = "force-dynamic";

export default async function AdminIssuesPage() {
  await platformPage(PERMISSIONS.ISSUE_MANAGE);
  const issues = await db.issueReport.findMany({
    include: { reporter: { select: { name: true, email: true, role: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Issue reports"
        description="Problems reported by mentors and mentees, straight to you."
      />
      <Card>
        <CardContent className="pt-6">
          {issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No issues have been reported.
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {issues.map((issue) => (
                  <div key={issue.id} className="rounded-lg border p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{issue.subject}</span>
                      <Badge variant={issue.status === "OPEN" ? "warning" : "success"}>
                        {issue.status === "OPEN" ? "Open" : "Resolved"}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {issue.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {issue.reporter.name} ({issue.reporter.email}) ·{" "}
                      {formatDateTime(issue.createdAt)}
                    </p>
                    {issue.status === "OPEN" && (
                      <div className="mt-3">
                        <ResolveIssueButton id={issue.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Reported</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Description
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(issue.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{issue.reporter.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {issue.reporter.email}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48">{issue.subject}</TableCell>
                      <TableCell className="hidden max-w-96 whitespace-pre-wrap lg:table-cell">
                        {issue.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={issue.status === "OPEN" ? "warning" : "success"}>
                          {issue.status === "OPEN" ? "Open" : "Resolved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {issue.status === "OPEN" && (
                          <ResolveIssueButton id={issue.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
