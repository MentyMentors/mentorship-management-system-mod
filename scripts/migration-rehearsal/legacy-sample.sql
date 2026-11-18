-- Synthetic pre-multitenant data shaped like production (no real people).
-- Used only to rehearse migrations on a local or Neon-branch database.
INSERT INTO "User" (id,name,email,"passwordHash",role,status,"emailVerifiedAt","updatedAt") VALUES
 ('u_admin','Admin One','admin@example.org','x','ADMIN','APPROVED',now(),now()),
 ('u_admin2','Admin Two','admin2@example.org','x','ADMIN','APPROVED',now(),now()),
 ('u_mentor1','Mentor One','m1@example.org','x','MENTOR','APPROVED',now(),now()),
 ('u_mentor2','Mentor Two','m2@example.org','x','MENTOR','APPROVED',now(),now()),
 ('u_mentor3','Mentor Pending','m3@example.org','x','MENTOR','PENDING',null,now()),
 ('u_mentee1','Mentee One','e1@example.org','x','MENTEE','APPROVED',now(),now()),
 ('u_mentee2','Mentee Two','e2@example.org','x','MENTEE','APPROVED',now(),now()),
 ('u_mentee3','Mentee Rejected','e3@example.org','x','MENTEE','REJECTED',now(),now()),
 ('u_mentee4','Mentee Old','e4@example.org','x','MENTEE','APPROVED',now(),now());
INSERT INTO "Semester" (id,name,"startDate","endDate","isActive","registrationOpen","isArchived","updatedAt") VALUES
 ('s_old','2025/26 Semester 1','2025-09-01','2026-01-31',false,false,true,now()),
 ('s_cur','2026/27 Semester 1','2026-09-01','2027-01-31',true,true,false,now());
INSERT INTO "Interest" (id,name) VALUES ('i_ai','AI'),('i_web','Web');
INSERT INTO "MentorProfile" (id,"userId","semesterId","registrationNumber","yearOfStudy",programme,department,"strongModules","hoursPerWeek","maxMentees","updatedAt") VALUES
 ('mp1','u_mentor1','s_cur','R001',4,'BSc Eng','Computer Eng','{}',3,2,now()),
 ('mp2','u_mentor2','s_old','R002',4,'BSc Eng','Civil Eng','{}',2,1,now()),
 ('mp3','u_mentor3','s_cur','R003',3,'BSc Eng','Civil Eng','{}',2,1,now());
INSERT INTO "MenteeProfile" (id,"userId","semesterId","registrationNumber",programme,department,"updatedAt") VALUES
 ('ep1','u_mentee1','s_cur','R101','BSc Eng','Computer Eng',now()),
 ('ep2','u_mentee2','s_cur','R102','BSc Eng','Civil Eng',now()),
 ('ep3','u_mentee3','s_cur','R103','BSc Eng','Civil Eng',now()),
 ('ep4','u_mentee4','s_old','R104','BSc Eng','Civil Eng',now());
INSERT INTO "MentorInterest" VALUES ('mp1','i_ai');
INSERT INTO "MenteeInterest" VALUES ('ep1','i_ai');
INSERT INTO "Pairing" (id,"mentorProfileId","menteeProfileId","semesterId",status,"matchScore","endedAt") VALUES
 ('p1','mp1','ep1','s_cur','ACTIVE',110,null),
 ('p2','mp2','ep4','s_old','ENDED',100,'2026-01-31');
INSERT INTO "Meeting" (id,"pairingId",date,"durationMinutes",topics,"createdById","updatedAt") VALUES
 ('mt1','p1','2026-10-01',60,'Intro','u_mentor1',now()),
 ('mt2','p2','2025-10-01',45,'CV','u_mentor2',now());
INSERT INTO "Announcement" (id,title,body,audience,"semesterId","createdById") VALUES
 ('a1','Welcome','Hello','ALL','s_cur','u_admin'),
 ('a2','Global','No semester','MENTORS',null,'u_admin');
INSERT INTO "Message" (id,"senderId","recipientId",body) VALUES ('msg1','u_mentor1','u_mentee1','Hi');
INSERT INTO "AuditLog" (id,"actorId",action) VALUES ('al1','u_admin','user.approve');
