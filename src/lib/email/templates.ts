import { escapeHtml } from "@/lib/sanitize";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Menty";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mentmw.org";

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#1d4ed8;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">${escapeHtml(APP_NAME)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#64748b;">
                  Menty ·
                  <a href="${APP_URL}" style="color:#1d4ed8;">Open dashboard</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;">
    <a href="${href}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block;">${escapeHtml(label)}</a>
  </p>
  <p style="margin:0 0 24px;font-size:12px;color:#64748b;">
    Or paste this link into your browser:<br/>
    <a href="${href}" style="color:#1d4ed8;word-break:break-all;">${escapeHtml(href)}</a>
  </p>`;
}

export function accountApprovedEmail(name: string) {
  return {
    subject: `${APP_NAME}: Your account has been approved`,
    html: layout(
      "Account approved 🎉",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Your account has been approved. You can now log in to the mentorship platform.</p>
       ${button(`${APP_URL}/login`, "Log in")}`
    ),
  };
}

export function accountRejectedEmail(name: string) {
  return {
    subject: `${APP_NAME}: Registration update`,
    html: layout(
      "Registration not approved",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Unfortunately your registration for the mentorship programme was not approved at this time. If you believe this is a mistake, please contact the programme coordinator.</p>`
    ),
  };
}

export function verifyEmailEmail(name: string, verifyUrl: string) {
  return {
    subject: `Please verify your ${APP_NAME} email address`,
    html: layout(
      "Verify your email",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Thanks for registering for ${escapeHtml(APP_NAME)}, the peer mentorship platform. Before we can review your registration, we need to confirm this email address belongs to you.</p>
       ${button(verifyUrl, "Verify email address")}
       <p>This link stays valid for 24 hours. Once verified, an administrator will review your registration and email you again once it has been approved.</p>
       <p>If you did not create an account with ${escapeHtml(APP_NAME)}, you can safely ignore this message.</p>`
    ),
  };
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>We received a request to reset the password on your ${escapeHtml(APP_NAME)} account. If this was you, choose a new password using the link below, it stays valid for one hour.</p>
       ${button(resetUrl, "Reset password")}
       <p>If you did not request a password reset, no action is needed, your existing password keeps working and this link will simply expire.</p>`
    ),
  };
}

export function pairingEmailForMentee(
  menteeName: string,
  mentorName: string,
  mentorEmail: string
) {
  return {
    subject: `${APP_NAME}: You have been matched with a mentor`,
    html: layout(
      "You have a mentor!",
      `<p>Hi ${escapeHtml(menteeName)},</p>
       <p>You have been paired with <strong>${escapeHtml(mentorName)}</strong> (${escapeHtml(mentorEmail)}).</p>
       <p>Log in to view their profile, send a message and plan your first meeting.</p>
       ${button(`${APP_URL}/mentee`, "View my mentor")}`
    ),
  };
}

export function pairingEmailForMentor(
  mentorName: string,
  menteeName: string,
  menteeEmail: string
) {
  return {
    subject: `${APP_NAME}: A new mentee has been assigned to you`,
    html: layout(
      "New mentee assigned",
      `<p>Hi ${escapeHtml(mentorName)},</p>
       <p><strong>${escapeHtml(menteeName)}</strong> (${escapeHtml(menteeEmail)}) has been assigned to you as a mentee.</p>
       <p>Please reach out within the next few days to arrange an introductory meeting.</p>
       ${button(`${APP_URL}/mentor`, "View my mentees")}`
    ),
  };
}

export function issueReportedEmail(
  reporterName: string,
  reporterEmail: string,
  subject: string,
  description: string
) {
  const paragraphs = description
    .split(/\n+/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return {
    subject: `${APP_NAME}: Issue reported — ${subject}`,
    html: layout(
      "New issue reported",
      `<p><strong>${escapeHtml(reporterName)}</strong> (${escapeHtml(reporterEmail)}) reported an issue:</p>
       <p><strong>${escapeHtml(subject)}</strong></p>
       ${paragraphs}
       ${button(`${APP_URL}/admin/issues`, "View issue")}`
    ),
  };
}

export function waitlistAdminEmail(menteeName: string, department: string) {
  return {
    subject: `${APP_NAME}: Mentee waitlisted — no mentor available`,
    html: layout(
      "Mentee added to waitlist",
      `<p><strong>${escapeHtml(menteeName)}</strong> (${escapeHtml(department)}) was approved but no suitable mentor with free capacity was found.</p>
       <p>They have been placed on the waitlist. Pairing will retry automatically when a new mentor becomes available, or you can assign one manually.</p>
       ${button(`${APP_URL}/admin/pairings`, "Manage pairings")}`
    ),
  };
}

export function weeklyReminderEmail(name: string, role: "MENTOR" | "MENTEE") {
  const action =
    role === "MENTOR"
      ? "check in with your mentees and log any meetings you have held"
      : "reach out to your mentor if you have not met recently";
  return {
    subject: `${APP_NAME}: Weekly mentorship reminder`,
    html: layout(
      "Weekly reminder",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>This is your weekly nudge to ${action}.</p>
       ${button(APP_URL, "Open dashboard")}`
    ),
  };
}

export function meetingReminderEmail(
  name: string,
  otherName: string,
  when: string,
  zoomJoinUrl?: string | null
) {
  return {
    subject: `${APP_NAME}: Upcoming mentorship meeting`,
    html: layout(
      "Meeting reminder",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>You have a mentorship meeting with <strong>${escapeHtml(otherName)}</strong> on <strong>${escapeHtml(when)}</strong>.</p>
       ${zoomJoinUrl ? button(zoomJoinUrl, "Join Zoom meeting") : ""}`
    ),
  };
}

export function announcementEmail(title: string, body: string) {
  const paragraphs = body
    .split(/\n+/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return {
    subject: `${APP_NAME}: ${title}`,
    html: layout(title, paragraphs),
  };
}

export function bulkEmail(subject: string, body: string) {
  const paragraphs = body
    .split(/\n+/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return { subject, html: layout(subject, paragraphs) };
}

/** Someone with no Menty account has been invited to a programme or institution role. */
export function roleInviteEmail(input: {
  inviterName: string;
  roleName: string;
  targetName: string;
  acceptUrl: string;
}) {
  return {
    subject: `${APP_NAME}: You're invited to help run ${input.targetName}`,
    html: layout(
      "You're invited",
      `<p>${escapeHtml(input.inviterName)} has invited you to join <strong>${escapeHtml(input.targetName)}</strong> on ${escapeHtml(APP_NAME)} as <strong>${escapeHtml(input.roleName)}</strong>.</p>
       <p>Accept the invitation to set up your account. The link works once and expires in 7 days.</p>
       ${button(input.acceptUrl, "Accept invitation")}`
    ),
  };
}

/** An existing user has been given a programme or institution role. */
export function roleGrantedEmail(input: {
  name: string;
  roleName: string;
  targetName: string;
  manageUrl: string;
}) {
  return {
    subject: `${APP_NAME}: You are now ${input.roleName} of ${input.targetName}`,
    html: layout(
      "New role",
      `<p>Hi ${escapeHtml(input.name)},</p>
       <p>You have been made <strong>${escapeHtml(input.roleName)}</strong> of <strong>${escapeHtml(input.targetName)}</strong>.</p>
       ${button(input.manageUrl, "Open")}`
    ),
  };
}

/** Outcome of an institution registration request. */
export function institutionDecisionEmail(input: {
  name: string;
  institutionName: string;
  approved: boolean;
}) {
  return {
    subject: `${APP_NAME}: ${input.institutionName} ${input.approved ? "approved" : "registration update"}`,
    html: layout(
      input.approved ? "Institution approved" : "Institution registration",
      input.approved
        ? `<p>Hi ${escapeHtml(input.name)},</p>
           <p><strong>${escapeHtml(input.institutionName)}</strong> is now on ${escapeHtml(APP_NAME)}, and you are its administrator. You can create programmes and appoint coordinators.</p>
           ${button(`${APP_URL}/manage`, "Open Menty")}`
        : `<p>Hi ${escapeHtml(input.name)},</p>
           <p>We could not approve the registration of <strong>${escapeHtml(input.institutionName)}</strong> at this time. Reply to this email if you would like to discuss it.</p>`
    ),
  };
}

/** Confirmation after someone registers for a programme. */
export function joinReceivedEmail(input: { name: string; programName: string; status: "ACTIVE" | "PENDING" | "WAITLISTED"; url: string }) {
  const body =
    input.status === "ACTIVE"
      ? `<p>You have joined <strong>${escapeHtml(input.programName)}</strong>. Welcome!</p>`
      : input.status === "WAITLISTED"
        ? `<p>Your registration for <strong>${escapeHtml(input.programName)}</strong> is on the waiting list because the programme is full. We will let you know if a place opens.</p>`
        : `<p>Your registration for <strong>${escapeHtml(input.programName)}</strong> has been received. The programme team will review it and you will get an email with their decision.</p>`;
  return {
    subject: `${APP_NAME}: ${input.status === "ACTIVE" ? "Welcome to" : "Registration received —"} ${input.programName}`,
    html: layout(input.status === "ACTIVE" ? "You're in" : "Registration received", `<p>Hi ${escapeHtml(input.name)},</p>${body}${button(input.url, "Open my programme")}`),
  };
}

/** A coordinator's decision on a registration. */
export function joinDecisionEmail(input: {
  name: string;
  programName: string;
  decision: "approve" | "reject" | "waitlist" | "remove";
  note?: string | null;
  url: string;
}) {
  const lines: Record<typeof input.decision, string> = {
    approve: `Your registration for <strong>${escapeHtml(input.programName)}</strong> has been approved. Welcome!`,
    reject: `Your registration for <strong>${escapeHtml(input.programName)}</strong> was not accepted this time.`,
    waitlist: `You are on the waiting list for <strong>${escapeHtml(input.programName)}</strong>. We will let you know if a place opens.`,
    remove: `You are no longer a participant in <strong>${escapeHtml(input.programName)}</strong>.`,
  };
  return {
    subject: `${APP_NAME}: ${input.programName} — registration update`,
    html: layout(
      "Registration update",
      `<p>Hi ${escapeHtml(input.name)},</p><p>${lines[input.decision]}</p>${input.note ? `<p><em>${escapeHtml(input.note)}</em></p>` : ""}${input.decision === "approve" ? button(input.url, "Open my programme") : ""}`
    ),
  };
}

/** Email verification for accounts created with the general sign-up. */
export function signupVerifyEmail(name: string, verifyUrl: string) {
  return {
    subject: `${APP_NAME}: Confirm your email address`,
    html: layout(
      "Confirm your email",
      `<p>Hi ${escapeHtml(name)},</p><p>Welcome to ${escapeHtml(APP_NAME)}. Confirm your email address to finish creating your account. The link expires in 24 hours.</p>${button(verifyUrl, "Confirm email")}`
    ),
  };
}
