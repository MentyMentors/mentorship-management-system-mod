export const ROLE_LABEL: Record<string, string> = {
  MENTOR: "Mentor",
  MENTEE: "Mentee",
  PRESENTER: "Presenter",
  FACILITATOR: "Facilitator",
  PARTICIPANT: "Participant",
};
export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting approval",
  ACTIVE: "Active",
  WAITLISTED: "Waiting list",
  REJECTED: "Not accepted",
  WITHDRAWN: "Withdrawn",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  REMOVED: "Removed",
};
export const MEMBERSHIP_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  ACTIVE: "success",
  WAITLISTED: "secondary",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
  INACTIVE: "outline",
  SUSPENDED: "destructive",
  REMOVED: "outline",
};
