import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  Facebook,
  GraduationCap,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessagesSquare,
  Phone,
  Twitter,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/constants";
import { MobileNav } from "@/components/landing/mobile-nav";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { Testimonials } from "@/components/landing/testimonials";

const features = [
  {
    icon: Zap,
    tint: "teal" as const,
    title: "Automatic pairing",
    description:
      "Mentees are matched to mentors the moment they are approved — by department, shared interests and availability.",
  },
  {
    icon: Users,
    tint: "navy" as const,
    title: "Semester cohorts",
    description:
      "One cohort per semester with controlled registration windows and full archives of past programmes.",
  },
  {
    icon: MessagesSquare,
    tint: "green" as const,
    title: "Built-in messaging",
    description:
      "Chat inside the platform, or jump straight to email and WhatsApp with one click.",
  },
  {
    icon: CalendarCheck,
    tint: "green" as const,
    title: "Meeting logs",
    description:
      "Mentors log every session — dates, duration, topics and notes — visible to programme admins.",
  },
  {
    icon: UserCheck,
    tint: "navy" as const,
    title: "Admin approval",
    description:
      "Every account is reviewed before it can log in, keeping the cohort authentic and safe.",
  },
  {
    icon: GraduationCap,
    tint: "teal" as const,
    title: "Faculty-wide analytics",
    description:
      "Pairing statistics, meeting activity and interest trends at a glance, with CSV import/export.",
  },
];

const tintClasses: Record<"teal" | "navy" | "green", string> = {
  teal: "bg-teal/10 text-teal dark:bg-teal/15",
  navy: "bg-navy/10 text-navy dark:bg-white/10 dark:text-foreground",
  green: "bg-green/15 text-green-deep dark:bg-green/20 dark:text-green",
};

const steps = [
  {
    icon: ClipboardList,
    title: "Apply in minutes",
    description:
      "Tell us your department, year of study and what you're hoping to figure out this semester.",
  },
  {
    icon: Users,
    title: "Get matched",
    description:
      "We pair you with a senior mentor by department, shared interests and availability.",
  },
  {
    icon: CalendarCheck,
    title: "Meet, weekly",
    description:
      "Regular check-ins for the full cohort, logged and visible to programme admins.",
  },
];

const events = [
  {
    badge: "Workshop",
    title: "Resume & LinkedIn Masterclass",
    when: "To be Announced",
    where: "To be Announced",
  },
  {
    badge: "Webinar",
    title: "Navigating Your First Graceweek",
    when: "To be Announced",
    where: "To be Announced",
  },
  {
    badge: "Networking",
    title: "Menty Open House",
    when: "To be Announced",
    where: "To be Announced",
  },
];

const faqs = [
  {
    question: "Is Menty free for mentees?",
    answer:
      "Absolutely! But to keep the platform sustainable, as a mentee you'll be required to register as a mentor once you reach upper years. First come, first served.",
  },
  {
    question: "What is the criteria for volunteering as a mentor?",
    answer:
      "You must be in upper years and passionate about guiding others. Grades aren't the only criteria, though we do encourage students with strong academic standing to register as mentors.",
  },
  {
    question: "What's in it for me if I volunteer as a mentor?",
    answer:
      "Menty is recognised by partners like the Malawi Engineering Institute MUBAS Chapter as a platform for excellence and skills-building. Contributing here gives you standing with those partners — a real boost for career growth.",
  },
];

const socials = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Twitter, href: "#", label: "Twitter / X" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: APP_NAME,
  url: "https://www.mentmw.org",
  logo: "https://www.mentmw.org/images/menty-logo-full.png",
  description:
    "Menty pairs university students with a mentor who's already walked their road — automated matching, weekly check-ins and meeting logs for campus mentorship programmes.",
  email: "mailto:admin@mentmw.org",
  areaServed: "MW",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "admin@mentmw.org",
      telephone: "+265985370226",
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {/* ---------- Sticky glass header ---------- */}
      <header className="sticky top-0 z-50 border-b border-border/50">
        <div className="glass relative">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="shrink-0">
              <Logo size={26} />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <a href="#how">How it works</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#events">Events</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#features">Features</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#testimonials">Stories</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#faq">FAQ</a>
              </Button>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="accent" size="sm" asChild>
                <Link href="/register">
                  Get started <ArrowRight className="hidden h-4 w-4 sm:inline" />
                </Link>
              </Button>
              <MobileNav />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
               {/* ---------- Hero ---------- */}
        <section className="relative flex min-h-[640px] items-center overflow-hidden sm:min-h-[720px]">
          {/* full-bleed photo background */}
          <div className="absolute inset-0">
            <Image
              src="/images/Hero.jpg"
              alt="Menty mentorship group"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          </div>
          <div aria-hidden className="absolute inset-0 bg-mesh-photo-overlay" />

          {/* soft arch accents echoing the Menty mark, per brand guide */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-32 h-[420px] w-[420px] rounded-full border-[56px] border-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 right-24 h-[340px] w-[340px] rounded-full border border-white/15"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-1/3 h-[260px] w-[260px] rounded-full bg-green/10 blur-2xl"
          />

          <div className="container relative flex flex-col items-center gap-7 py-24 text-center sm:py-28">
            <h1 className="max-w-3xl text-balance font-display text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-white sm:text-6xl sm:leading-[1.02]">
              Find your guide on campus
            </h1>
            <p className="max-w-xl text-balance text-lg text-white/80">
              Menty pairs you with a fellow student who&apos;s already walked
              your road. They know better, so they guide better.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" variant="accent" asChild>
                <Link href="/register?role=mentee">
                  Join as a mentee <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                asChild
              >
                <Link href="/register?role=mentor">Become a mentor</Link>
              </Button>
            </div>
          </div>
        </section>


        {/* ---------- About / Positioning ---------- */}
        <section id="about" className="relative overflow-hidden bg-navy py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-24 h-[380px] w-[380px] rounded-full border border-white/10"
          />
          <div className="container relative grid items-center gap-14 md:grid-cols-2">
            <div className="relative order-2 aspect-[4/5] overflow-hidden rounded-3xl shadow-glass-lg md:order-1">
              <Image
                src="/images/Mentees.jpg"
                alt="Mentees learning from senior students"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-xs font-bold uppercase tracking-widest text-green">
                About
              </p>
              <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight text-white sm:text-5xl">
                Experience shouldn&apos;t graduate and disappear
              </h2>
              <p className="mt-6 leading-relaxed text-white/70">
                The questions that cost first-years months of anxiety — which
                lecturers to approach, how to study modules, when to start
                applying for internships — have already been answered by the
                students two years ahead of them. {APP_NAME} builds the bridge.
              </p>
              <p className="mt-4 leading-relaxed text-white/70">
                Through structured pairings, regular check-ins and a growing
                community of student mentors, {APP_NAME} keeps knowledge
                moving up the year groups instead of walking out at
                graduation.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Auto-matching", "Weekly check-ins", "Admin-reviewed"].map(
                  (chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80"
                    >
                      {chip}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it Works ---------- */}
        <section id="how" className="py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                How it Works
              </p>
              <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                Three steps to your first session
              </h2>
              <p className="mt-3 text-muted-foreground">
                No lengthy onboarding — just apply, get matched, and start meeting.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <Card
                  key={step.title}
                  className="animate-fade-in-up rounded-3xl hover:shadow-glass-lg"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal dark:bg-teal/15">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Founder ---------- */}
        <section id="founder" className="py-20">
          <div className="container">
            <div className="grid items-start gap-14 md:grid-cols-[1fr_1.4fr]">
              <div className="md:sticky md:top-24">
                <div className="relative aspect-[3/4] overflow-hidden rounded-3xl shadow-glass-lg">
                  <Image
                    src="/images/founder.jpg"
                    alt="Muwemi Ndovie, founder of Menty"
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/95 to-transparent p-6 pt-16">
                    <p className="font-display text-lg font-bold text-white">
                      Muwemi Ndovie
                    </p>
                    <p className="text-sm text-white/70">
                      Founder, {APP_NAME}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal">
                  Meet the Founder
                </p>
                <h2 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                  Why I Created {APP_NAME}
                </h2>
                <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
                  <p>
                    Hi, I&apos;m Muwe! In 2025, I contested to be the Director
                    of Academics at MUBAS with the motto &quot;Resources for
                    Every Student, success for all&quot;. My core belief is
                    that every student has the potential of academic
                    excellence given enough resources and direction.
                  </p>
                  <p>
                    That&apos;s when the idea of pioneering a mentorship
                    program platform began. Through this platform, I hope
                    every first year student never has to feel lost and
                    unguided because they joined {APP_NAME}!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Mentor CTA row ---------- */}
        <section className="py-20">
          <div className="container grid items-center gap-10 sm:grid-cols-2">
            <div>
              <span className="mb-3 inline-block rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
                For senior students
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-3xl">
                Share your experience with first year students
              </h3>
              <p className="mt-4 text-muted-foreground">
                Imagine everything you have learned and gone through while
                trying to adapt to uni life. Surely, there must be a greater
                purpose for facing all those trials and tribulations. Share
                with the younger generation and let&apos;s grow together!
              </p>
              <Button size="lg" variant="navy" className="mt-6" asChild>
                <Link href="/register?role=mentor">Volunteer as a mentor</Link>
              </Button>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-glass-lg">
              <Image
                src="/images/mentor.jpeg"
                alt="Mentor sharing experience with students"
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* ---------- Mentee CTA row ---------- */}
        <section className="py-20">
          <div className="container grid items-center gap-10 sm:grid-cols-2">
            <div className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl shadow-glass-lg sm:order-1">
              <Image
                src="/images/Mentees.jpg"
                alt="Mentees learning from senior students"
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="order-1 sm:order-2">
              <span className="mb-3 inline-block rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green-deep dark:text-green">
                For first years
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-3xl">
                Learn from senior students
              </h3>
              <p className="mt-4 text-muted-foreground">
                Navigating uni for the first time can be quite the rocky
                road. Who better to learn from than students who&apos;ve
                passed that road and come out victorious?
              </p>
              <Button size="lg" variant="accent" className="mt-6" asChild>
                <Link href="/register?role=mentee">Join as a mentee</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------- Events ---------- */}
        <section id="events" className="py-20">
          <div className="container">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal">
                  What&apos;s On
                </p>
                <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                  Upcoming events
                </h2>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {events.map((event, i) => (
                <Card
                  key={event.title}
                  className="animate-fade-in-up rounded-3xl hover:shadow-glass-lg"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <CardHeader>
                    <Badge
                      variant="secondary"
                      className={
                        event.badge === "Networking"
                          ? "mb-3 w-fit bg-green/15 text-green-deep dark:bg-green/20 dark:text-green"
                          : "mb-3 w-fit"
                      }
                    >
                      {event.badge}
                    </Badge>
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 pt-1">
                      <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                      {event.when}
                    </CardDescription>
                    <CardDescription className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {event.where}
                    </CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Feature grid ---------- */}
        <section id="features" className="py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                Everything a mentorship programme needs
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built for institutions, designed for the students who use it
                every day.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <Card
                  key={feature.title}
                  className="animate-fade-in-up rounded-3xl hover:shadow-glass-lg"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <CardHeader>
                    <div
                      className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${tintClasses[feature.tint]}`}
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Testimonials ---------- */}
        <section id="testimonials" className="relative overflow-hidden bg-navy py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 bottom-0 h-[300px] w-[300px] rounded-full border border-white/10"
          />
          <div className="container relative">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-green">
                Stories
              </p>
              <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">
                What mentees say
              </h2>
            </div>
            <Testimonials />
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="py-20">
          <div className="container grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                FAQ
              </p>
              <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                Questions we get a lot
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Can&apos;t find your answer? Reach us below — we respond
                within 48 hours.
              </p>
            </div>
            <FaqAccordion faqs={faqs} />
          </div>
        </section>

        {/* ---------- Contact ---------- */}
        <section id="contact" className="bg-secondary/40 py-20">
          <div className="container grid items-start gap-14 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                Get in Touch
              </p>
              <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
                Let&apos;s get you paired
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Apply as a mentee, volunteer as a mentor, or ask us anything —
                we&apos;re always up for a good conversation.
              </p>
              <div className="mt-8 space-y-4">
                <a
                  href="mailto:admin@mentmw.org"
                  className="flex items-center gap-4 text-sm font-medium text-navy hover:text-teal dark:text-foreground"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                    <Mail className="h-4 w-4" />
                  </span>
                  admin@mentmw.org
                </a>
                <a
                  href="tel:+265985370226"
                  className="flex items-center gap-4 text-sm font-medium text-navy hover:text-teal dark:text-foreground"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                    <Phone className="h-4 w-4" />
                  </span>
                  +265 985 370 226
                </a>
              </div>
            </div>

            <form
              action="mailto:admin@mentmw.org"
              method="post"
              encType="text/plain"
              className="space-y-5 rounded-3xl bg-card p-8 shadow-glass sm:p-10"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" name="First name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="Last name" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="Email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="Message" rows={4} required />
              </div>
              <Button type="submit" size="lg" variant="navy" className="w-full">
                Send Message
              </Button>
            </form>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="bg-navy py-16 text-white/70">
        <div className="container">
          <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-4">
            <div>
              <Logo variant="markWhite" size={24} wordmarkClassName="text-white" />
              <p className="mt-4 text-sm text-white/50">
                Peer-to-peer mentorship for university students.
              </p>
              <div className="mt-5 flex gap-3">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <social.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                Programme
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="#how" className="hover:text-white">How it works</a></li>
                <li><Link href="/register?role=mentee" className="hover:text-white">Apply as Mentee</Link></li>
                <li><Link href="/register?role=mentor" className="hover:text-white">Become a Mentor</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                Community
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="#events" className="hover:text-white">Events</a></li>
                <li><a href="#testimonials" className="hover:text-white">Stories</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                Organisation
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="#about" className="hover:text-white">About {APP_NAME}</a></li>
                <li><a href="#founder" className="hover:text-white">Founder</a></li>
                <li><a href="#contact" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-white/40 sm:flex-row">
            <p>
              © {new Date().getFullYear()} {APP_NAME} · Peer Mentorship
              Program Platform
            </p>
            <div className="flex gap-6">
              <span>Privacy Policy</span>
              <span>Terms of Use</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
