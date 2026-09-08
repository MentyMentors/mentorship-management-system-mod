"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  body: string;
}

export function AnnouncementsCarousel({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [index, setIndex] = useState(0);

  if (announcements.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing new.</p>;
  }

  const current = announcements[index];

  return (
    <div>
      <div className="flex gap-3 rounded-xl bg-green/10 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green/20">
          <Megaphone className="h-4 w-4 text-green-deep" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{current.title}</p>
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
            {current.body}
          </p>
        </div>
      </div>
      {announcements.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {announcements.slice(0, 5).map((a, i) => (
            <button
              key={a.id}
              onClick={() => setIndex(i)}
              aria-label={`Show announcement ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-green" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
