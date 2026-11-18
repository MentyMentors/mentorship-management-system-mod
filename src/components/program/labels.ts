/** Display names for programme enums. */
export const DELIVERY_MODEL_LABEL: Record<string, string> = {
  PRESENTER_LED: "Presenter-led",
  ONE_TO_ONE: "One-to-one",
  HYBRID: "Hybrid",
};
export const DELIVERY_MODEL_HELP: Record<string, string> = {
  PRESENTER_LED:
    "Everyone who joins attends the same sessions, led by one or more mentors or guest speakers. No individual pairing.",
  ONE_TO_ONE: "Each mentee is paired with an individual mentor (manually, automatically, or both).",
  HYBRID: "Shared sessions for everyone, plus individual mentors for the participants you choose.",
};
export const DELIVERY_MODE_LABEL: Record<string, string> = {
  ONLINE: "Online",
  IN_PERSON: "In person",
  BLENDED: "Online and in person",
};
export const MATCHING_MODE_LABEL: Record<string, string> = {
  MANUAL: "Manual — coordinators pair people",
  AUTOMATIC: "Automatic — Menty suggests and assigns",
  HYBRID: "Hybrid — Menty suggests, coordinators approve",
};
export const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "Public — listed on Menty",
  UNLISTED: "Unlisted — anyone with the link",
  PRIVATE: "Private — members only",
};
export const ELIGIBILITY_LABEL: Record<string, string> = {
  OPEN: "Open to everyone",
  INSTITUTIONS: "Specific institutions",
  DEPARTMENTS: "Specific departments",
  YEARS_OF_STUDY: "Specific years of study",
  INVITE_ONLY: "By invitation only",
  CUSTOM: "Custom criteria",
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ACTIVE: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  SUSPENDED: "Suspended",
};
export const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "outline",
  ARCHIVED: "outline",
  SUSPENDED: "destructive",
};
export const OWNER_LABEL: Record<string, string> = {
  PLATFORM: "Run by Menty",
  INSTITUTION: "Institution programme",
  INDEPENDENT: "Independent programme",
};
