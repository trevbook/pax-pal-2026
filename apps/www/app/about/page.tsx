import { CheckCircle, ExternalLink, Mail } from "lucide-react";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <title>GitHub</title>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — PAX Pal 2026",
  description: "Learn about PAX Pal, a companion app for PAX East 2026.",
};

const features = [
  {
    title: "Smart Search",
    description:
      "Hybrid text + AI-powered semantic search to find games by vibe, not just keywords.",
  },
  {
    title: "Personalized Recommendations",
    description: "Watchlist a few games and get AI-driven picks tailored to your taste.",
  },
  {
    title: "Interactive Expo Map",
    description: "Tap booths to see what\u2019s there, or find any game\u2019s booth on the map.",
  },
  {
    title: "Track Your PAX",
    description: "Watchlist games before the show, mark them as played, rate your favorites.",
  },
  {
    title: "Mobile-First",
    description: "Designed to use on your phone while walking the expo floor.",
  },
];

const links = [
  {
    label: "GitHub",
    href: "https://github.com/trevbook/pax-pal-2026",
    icon: GithubIcon,
  },
  {
    label: "Email",
    href: "mailto:trevormhubbard@gmail.com",
    icon: Mail,
  },
  {
    label: "Twitter / X",
    href: "https://x.com/trevbook",
    icon: ExternalLink,
  },
  {
    label: "BlueSky",
    href: "https://bsky.app/profile/trevbook.bsky.social",
    icon: ExternalLink,
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">About PAX Pal</h1>

      <p className="mt-4 leading-relaxed text-muted-foreground">
        I built PAX Pal to help PAX East attendees find cool games on the show floor! The official{" "}
        <a
          href="https://east.paxsite.com/en-us/expo-hall/expo-hall-demos.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Expo Hall Demos page
        </a>{" "}
        is a great list of games, but it can be hard to find the ones that are interesting to you.
        PAX Pal lets you explore games through search, filtering, and personalized recommendations.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Key Features</h2>
      <ul className="mt-3 space-y-3">
        {features.map((feature) => (
          <li key={feature.title} className="flex gap-3">
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <span className="font-medium">{feature.title}</span>
              <span className="text-muted-foreground"> — {feature.description}</span>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Third Year Running</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        This is the third annual PAX Pal! What started as a{" "}
        <span className="text-foreground">Streamlit prototype in 2024</span> became a{" "}
        <span className="text-foreground">React + Vite app in 2025</span>, and is now a{" "}
        <span className="text-foreground">Next.js + AWS serverless app in 2026</span>. Each year it
        gets a little more ambitious — this year features AI-powered semantic search, personalized
        recommendations, and an interactive expo hall map.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Get in Touch</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <link.icon className="size-4" />
            {link.label}
          </a>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Built with Next.js, Tailwind CSS, AWS, and Claude.
      </p>

      <div className="mt-6">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
