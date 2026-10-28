import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useJournal, pursuitStatus } from "../lib/journal";
import { useInterests } from "../lib/interests";
import { fetchMyStubs, type StubCard } from "../lib/stubs";
import { postCornerKey } from "../lib/cornerAlias";
import { allSubHobbies } from "../data/hobbies";
import type { Post } from "../data/posts";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Segmented } from "../components/ui/Segmented";
import { Ticket } from "../components/stub/Ticket";
import { StubViewer, stubColor, stubLayoutId } from "../components/you/StubViewer";
import { PostMediaCarousel } from "../components/PostMediaCarousel";
import { MomentDetail } from "../components/MomentDetail";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { EmptyState } from "../components/StateViews";
import { formatDate } from "../lib/dates";
import { plural } from "../lib/plural";
import { PAGE_FROM, PAGE_TO, page, staggerDelay } from "../lib/motionTokens";

type Tab = "stubs" | "pursuits" | "moments";
const TABS = [
  { value: "stubs", label: "Stubs" },
  { value: "pursuits", label: "Pursuits" },
  { value: "moments", label: "Moments" },
] as const;

/**
 * You (screen 9): who you are in one line, then three tabs. Stubs is a two column
 * grid of tickets, newest first, that open full screen. Pursuits lists active ones
 * first, then finished ones with their gold Stub. Moments is your Moments grouped
 * by Corner. Everything else (links, badges, followers) stays at /you/all.
 */
export function YouHome() {
  const { user, profile, isConfigured } = useAuth();
  const { myPosts } = useContent();
  const journal = useJournal();
  const { city } = useInterests();
  const [tab, setTab] = useState<Tab>("stubs");
  const [stubs, setStubs] = useState<StubCard[] | null>(null);
  const [open, setOpen] = useState<StubCard | null>(null);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchMyStubs(user.id, (ms) => formatDate(ms)).then((s) => live && setStubs(s));
    return () => {
      live = false;
    };
  }, [user?.id]);

  const byCorner = useMemo(() => {
    const groups = new Map<string, Post[]>();
    for (const p of [...myPosts].sort((a, b) => b.createdAt - a.createdAt)) {
      const k = postCornerKey(p) ?? "none";
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()];
  }, [myPosts]);

  if (isConfigured && !user) {
    return <SignUpPrompt title="Your Shelf lives here" body="Make an account and everything you log builds up here: Stubs, Pursuits and Moments." cta="Start my Shelf" />;
  }

  const name = profile?.display_name?.trim() || "You";
  const corners = byCorner.filter(([k]) => k !== "none").length;
  const line = [city || undefined, stubs ? plural(stubs.length, "Stub") : undefined, corners > 0 ? plural(corners, "Corner") : undefined].filter(Boolean).join(" · ");
  const active = journal.projects.filter((p) => pursuitStatus(p) === "active");
  const finished = journal.projects.filter((p) => pursuitStatus(p) === "complete");
  const entries = journal.progress ?? [];
  const loggedCount = (id: string) => entries.filter((e) => e.projectId === id).length;
  const goldFor = (title: string) => stubs?.find((s) => s.kind === "gold" && s.title === title.slice(0, 60));

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-6">
      <header className="mb-5 flex items-center gap-4">
        <Avatar className="size-16 shrink-0">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
          <AvatarFallback className="bg-accent text-title font-semibold text-accent-foreground">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title font-semibold">{name}</h1>
          {line && <p className="truncate text-small text-muted-foreground">{line}</p>}
        </div>
        <Link to="/settings" aria-label="Settings" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
          <SettingsIcon className="size-5" aria-hidden="true" />
        </Link>
      </header>

      <Segmented label="You" options={TABS} value={tab} onChange={setTab} className="mb-5" />

      {tab === "stubs" &&
        (stubs && stubs.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3">
            {stubs.map((s, i) => (
              <motion.li key={s.id} initial={PAGE_FROM} animate={PAGE_TO} transition={{ ...page, delay: staggerDelay(i) }}>
                <button type="button" onClick={() => setOpen(s)} aria-label={`${s.title}. Open`} className="block w-full text-left">
                  <Ticket compact layoutId={open?.id === s.id ? undefined : stubLayoutId(s.id)} variant={s.kind} serial={s.serial ?? undefined} title={s.title} meta={s.meta} color={stubColor(s)} />
                </button>
              </motion.li>
            ))}
          </ul>
        ) : (
          <EmptyState size="inline" line={stubs ? "No Stubs yet." : "Loading your Stubs."} hint="Log a Moment toward a Pursuit and you get one." action={{ label: "Log a Moment", to: "/create" }} />
        ))}

      {tab === "pursuits" &&
        (active.length + finished.length === 0 ? (
          <EmptyState size="inline" line="No Pursuits yet." hint="Start one from any Corner." action={{ label: "Go to Discover", to: "/discover" }} />
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((p) => (
              <Link key={p.id} to={`/pursuit/${p.id}`} className="block rounded-card bg-card p-4">
                <span className="block truncate text-body font-semibold">{p.title.slice(0, 60)}</span>
                <span className="block text-small text-muted-foreground">
                  {p.measure ? `${loggedCount(p.id)} of ${p.measure.target}` : "In progress"}
                </span>
              </Link>
            ))}
            {finished.map((p) => {
              const gold = goldFor(p.title);
              return (
                <Link key={p.id} to={`/pursuit/${p.id}/recap`} className="block">
                  {gold ? (
                    <Ticket compact variant="gold" serial={gold.serial ?? undefined} title={p.title.slice(0, 60)} meta="Finished" />
                  ) : (
                    <span className="block rounded-card bg-card p-4">
                      <span className="block truncate text-body font-semibold">{p.title.slice(0, 60)}</span>
                      <span className="block text-small text-muted-foreground">Finished</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

      {tab === "moments" &&
        (byCorner.length === 0 ? (
          <EmptyState size="inline" line="No Moments yet." hint="Anything you log shows up here." action={{ label: "Log a Moment", to: "/create" }} />
        ) : (
          <div className="flex flex-col gap-6">
            {byCorner.map(([key, posts]) => {
              const slug = key.split("/")[1];
              const label = key === "none" ? "No Corner" : (allSubHobbies.find((s) => s.slug === slug)?.label ?? slug);
              return (
                <section key={key} aria-label={label}>
                  <h2 className="mb-2 text-small font-semibold text-muted-foreground">{label}</h2>
                  <ul className="grid grid-cols-3 gap-2">
                    {posts.slice(0, 9).map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => setOpenPost(p)} aria-label={p.caption ? p.caption.slice(0, 60) : "Open this Moment"} className="block aspect-square w-full overflow-hidden rounded-control bg-card">
                          <PostMediaCarousel media={p.mediaUrls?.length ? p.mediaUrls : p.media ? [p.media] : []} type={p.type} hobbySlug={p.hobbySlug} seed={p.id} className="size-full object-cover" width={160} preview />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ))}

      <p className="mt-8 text-center">
        <Link to="/you/all" className="inline-flex min-h-11 items-center text-small text-accent-text underline-offset-4 hover:underline">
          Shelf, links and badges
        </Link>
      </p>

      <AnimatePresence>{open && <StubViewer key={open.id} stub={open} onClose={() => setOpen(null)} />}</AnimatePresence>
      <MomentDetail post={openPost} owned onOpenChange={(o) => !o && setOpenPost(null)} />
    </div>
  );
}
