import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Compass,
  Heart,
  MapPin,
  PenLine,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import { useCategories } from "../context/CategoriesContext";
import { useContent } from "../context/ContentContext";
import { useCircles } from "../context/CirclesContext";
import { useSocial } from "../context/SocialContext";
import { getHobby } from "../data/hobbies";
import { hobbyPhoto, spacePhoto } from "../data/hobbyPhotos";
import type { Post } from "../data/posts";
import { usePeopleInHobby, type Person } from "../lib/people";
import { GeneratedArt } from "../components/GeneratedArt";
import { MomentCard } from "../components/MomentCard";
import { PeopleRow } from "../components/PersonCard";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";

const JOIN_REASONS = ["Learn", "Make", "Meet people", "Attend events", "Find inspiration", "Practice"];
const JOIN_KEY = "sushii.space-memberships.v1";

type SpaceFixture = {
  id: string;
  hobbySlug: string;
  name: string;
  eyebrow: string;
  description: string;
  location: string;
  members: string;
  host: string;
  tags: string[];
};

type CategorySummary = { slug: string; name: string; description?: string };

const FIXTURES: Record<string, SpaceFixture> = {
  "the-mud-room": {
    id: "the-mud-room",
    hobbySlug: "crafts-making",
    name: "The Mud Room",
    eyebrow: "STUDIO · COMMUNITY",
    description: "An open studio for people who love making things with clay.",
    location: "Brooklyn, New York",
    members: "284 members",
    host: "Ari & the Mud Room team",
    tags: ["Pottery", "Ceramics", "Community"],
  },
};

const EVENTS = [
  { type: "CLASS", title: "Beginner Pottery", date: "Sat, Oct 19 · 10:00 AM", note: "Start with the wheel and make room for a first attempt." },
  { type: "OPEN STUDIO", title: "Open Studio", date: "Sun, Oct 20 · 1:00 PM", note: "Bring a work in progress or come find one." },
];

function readMemberships(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(JOIN_KEY) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function fixtureFor(id: string, categories: CategorySummary[]): SpaceFixture {
  const known = FIXTURES[id];
  if (known) return known;
  const hobby = getHobby(id);
  const category = categories.find((item) => item.slug === id);
  return {
    id,
    hobbySlug: hobby?.slug ?? category?.slug ?? id,
    name: hobby?.name ?? category?.name ?? id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    eyebrow: "SPACE · COMMUNITY",
    description: hobby?.description ?? category?.description ?? "A place to keep doing the thing that pulls you in.",
    location: "Online",
    members: "A growing group",
    host: "Sushii community",
    tags: hobby ? hobby.subItems.slice(0, 3).map((item) => item.label) : ["Interest", "Practice", "Community"],
  };
}

export function SpacePage() {
  const { spaceId = "" } = useParams();
  const { categories } = useCategories();
  const space = fixtureFor(spaceId, categories);
  const { publicFeedByHobby } = useContent();
  const { people, loading: peopleLoading } = usePeopleInHobby(space.hobbySlug);
  const { circlesByHobby } = useCircles();
  const social = useSocial();
  const [tab, setTab] = useState("Home");
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [joined, setJoined] = useState(() => !!readMemberships()[space.id]);

  const hobby = getHobby(space.hobbySlug);
  const posts = publicFeedByHobby(space.hobbySlug).slice(0, 6);
  const photo = spacePhoto(space.hobbySlug, 1600) ?? hobby?.coverImage;
  const circles = circlesByHobby(space.hobbySlug);
  const followed = social.isFollowingHobby(`space:${space.hobbySlug}`);
  const momentsLabel = posts.length === 1 ? "1 recent Moment" : `${posts.length} recent Moments`;

  const toggleFollow = () => {
    social.toggleHobbyFollow(`space:${space.hobbySlug}`, space.name);
    setNotice(followed ? "You will no longer receive Space updates." : "You will receive updates from this Space.");
  };

  const toggleJoin = () => {
    if (!joined) {
      setJoinOpen(true);
      return;
    }
    const next = readMemberships();
    delete next[space.id];
    window.localStorage.setItem(JOIN_KEY, JSON.stringify(next));
    setJoined(false);
    setNotice("You left this Space. You can join again any time.");
  };

  const completeJoin = () => {
    const next = readMemberships();
    next[space.id] = selectedReasons;
    window.localStorage.setItem(JOIN_KEY, JSON.stringify(next));
    setJoined(true);
    setJoinOpen(false);
    setNotice("You joined this Space. Preferences are saved locally until membership persistence is connected.");
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/spaces/${space.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Space link copied.");
    } catch {
      setNotice(url);
    }
  };

  const tabs = ["Home", "Events", "Moments", "People", "Pursuits", "About"];

  return (
    <div className="min-h-screen bg-surface">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[var(--surface-muted)]" />
        {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/80 to-transparent" />
        <div className="relative container mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1fr_360px] md:items-end md:py-24">
          <div>
            <Link to="/discover" className="mb-10 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><Compass className="size-3.5" /> Back to Discover</Link>
            <p className="ns-section-kicker mb-4">{space.eyebrow}</p>
            <h1 className="max-w-3xl text-5xl leading-[.95] tracking-[-.04em] sm:text-7xl" style={{ fontFamily: "var(--font-serif)" }}>{space.name}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground/80">{space.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{space.location}</span><span>·</span><span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{space.members}</span><span>·</span><span>Hosted by {space.host}</span></div>
            <div className="mt-7 flex flex-wrap gap-2">{space.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs">{tag}</span>)}</div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/85 p-3 shadow-xl backdrop-blur-sm"><GeneratedArt hobbySlug={space.hobbySlug} seed={`${space.id}-space`} className="aspect-[4/3] w-full rounded-xl object-cover" /><div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4"><p className="text-xs text-muted-foreground">A place to practice without an audience.</p><Link to="/spaces/new" className="shrink-0 text-xs text-accent hover:underline">Create a Space <ArrowUpRight className="inline size-3" /></Link></div></div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4"><div className="flex flex-wrap gap-1.5">{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${tab === item ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>{item}</button>)}</div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={toggleFollow}>{followed ? <Check className="size-3.5" /> : <Heart className="size-3.5" />}{followed ? "Following" : "Follow"}</Button><Button variant="brand" size="sm" onClick={toggleJoin}>{joined ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{joined ? "Leave Space" : "Join Space"}</Button><Button variant="outline" size="icon" onClick={share} aria-label="Share this Space"><Share2 className="size-4" /></Button></div></div>
        {notice && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}
        {tab === "Home" && <HomeTab space={space} posts={posts} people={people} peopleLoading={peopleLoading} circlesCount={circles.length} momentsLabel={momentsLabel} />}
        {tab === "Events" && <EventsTab />}
        {tab === "Moments" && <MomentsTab posts={posts} />}
        {tab === "People" && <PeopleTab people={people} loading={peopleLoading} />}
        {tab === "Pursuits" && <PursuitsTab hobbySlug={space.hobbySlug} />}
        {tab === "About" && <AboutTab space={space} />}
      </div>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Join {space.name}</DialogTitle><DialogDescription>Choose a few things that bring you here. You can change this later.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2 py-3">{JOIN_REASONS.map((reason) => { const selected = selectedReasons.includes(reason); return <button key={reason} type="button" aria-pressed={selected} onClick={() => setSelectedReasons((current) => selected ? current.filter((item) => item !== reason) : [...current, reason])} className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}>{selected && <Check className="mr-1 inline size-3" />}{reason}</button>; })}</div><Button variant="brand" onClick={completeJoin}>Join the Space <ArrowUpRight className="size-4" /></Button><p className="text-[11px] text-muted-foreground">Membership persistence is isolated for the existing account layer.</p></DialogContent></Dialog>
    </div>
  );
}

function HomeTab({ space, posts, people, peopleLoading, circlesCount, momentsLabel }: { space: SpaceFixture; posts: Post[]; people: Person[]; peopleLoading: boolean; circlesCount: number; momentsLabel: string }) {
  return <div className="space-y-20 py-12 sm:py-16"><section className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center"><div><p className="ns-section-kicker mb-3">FEATURED IN THIS SPACE</p><h2 className="text-4xl leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>Make room for <em className="text-accent">the next thing.</em></h2><p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">There is always another small thing worth trying. Start with a class, a conversation, or an hour at the wheel.</p><div className="mt-7 flex flex-wrap gap-2"><Link to={`/create?hobby=${space.hobbySlug}`}><Button variant="brand"><PenLine className="size-4" /> Create a Moment</Button></Link><Link to={`/pursuits/new?title=${encodeURIComponent("Learning pottery")}`}><Button variant="outline">Start a Pursuit <ArrowUpRight className="size-4" /></Button></Link></div></div><div className="overflow-hidden rounded-2xl border border-border bg-card"><img src={hobbyPhoto("pottery", space.hobbySlug, 1200)} alt="Hands shaping clay" className="aspect-[16/9] w-full object-cover" /><p className="px-5 py-3 text-[11px] uppercase tracking-[.18em] text-muted-foreground">The work is the way in.</p></div></section><section className="grid gap-12 border-t border-border pt-10 lg:grid-cols-[1.2fr_.8fr]"><div><div className="flex items-end justify-between gap-4"><div><p className="ns-section-kicker mb-3">RECENT MOMENTS</p><h2 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>{momentsLabel}</h2></div><Link to={`/create?hobby=${space.hobbySlug}`} className="text-xs text-accent hover:underline">Add yours <ArrowUpRight className="inline size-3" /></Link></div>{posts.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{posts.slice(0, 4).map((post) => <MomentCard key={post.id} post={post} surface="discover" size="standard" />)}</div> : <EmptyState title="The first Moment is waiting." copy="Share a photo, thought, discovery, or small win with this Space." href={`/create?hobby=${space.hobbySlug}`} action="Create a Moment" />}</div><div className="space-y-10"><section><p className="ns-section-kicker mb-3">ACTIVE PURSUITS</p><h2 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>Keep going together.</h2><div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card"><PursuitRow title="Learning Pottery" copy="Add a Moment each time you return to it." hobbySlug={space.hobbySlug} /><PursuitRow title="Making My First Bowl" copy="A small practice with room to grow." hobbySlug={space.hobbySlug} /></div></section><section><p className="ns-section-kicker mb-3">PEOPLE</p><h2 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>Find your people.</h2>{peopleLoading ? <p className="mt-4 text-sm text-muted-foreground">Looking for people in this Space…</p> : people.length ? <div className="mt-4"><PeopleRow people={people.slice(0, 6)} /></div> : <p className="mt-4 text-sm text-muted-foreground">People will appear here as they share Moments and explore this Space.</p>}<p className="mt-4 text-xs text-muted-foreground">{circlesCount ? `${circlesCount} Circles connected to this Space.` : "Circles can gather around the things people are doing here."}</p></section></div></section></div>;
}

function EventsTab() { return <div className="py-12 sm:py-16"><SectionIntro kicker="UPCOMING EVENTS" title="Find your way in." copy="Classes, meetups, open studios, and other ways to spend time with the people here." /><div className="mt-8 grid gap-4 md:grid-cols-2">{EVENTS.map((event) => <article key={event.title} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between text-[11px] uppercase tracking-[.16em] text-muted-foreground"><span>{event.type}</span><CalendarDays className="size-4" /></div><h3 className="mt-8 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>{event.title}</h3><p className="mt-2 text-sm text-muted-foreground">{event.date}</p><p className="mt-5 text-sm leading-relaxed">{event.note}</p><Button variant="outline" size="sm" className="mt-6" onClick={() => window.alert("Event RSVP is ready for the existing events integration.")}>View event <ArrowUpRight className="size-3.5" /></Button></article>)}</div><p className="mt-6 text-xs text-muted-foreground">Event creation, attendance, calendar actions, and pricing are isolated for the existing authenticated event system.</p></div>; }

function MomentsTab({ posts }: { posts: Post[] }) { return <div className="py-12 sm:py-16"><SectionIntro kicker="MOMENTS" title="What people are keeping." copy="Moments remain part of the existing Sushii Moment system. This Space is a place to find them." /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{posts.length ? posts.map((post) => <MomentCard key={post.id} post={post} surface="discover" size="standard" />) : <EmptyState title="No Moments here yet." copy="Be the first to share something from this Space." href="/create" action="Create a Moment" />}</div></div>; }

function PeopleTab({ people, loading }: { people: Person[]; loading: boolean }) { return <div className="py-12 sm:py-16"><SectionIntro kicker="PEOPLE" title="People doing the thing." copy="Open an existing Sushii profile to see the interests, Moments, and Pursuits they have chosen to share." />{loading ? <p className="mt-8 text-sm text-muted-foreground">Looking for people…</p> : people.length ? <div className="mt-8 max-w-3xl"><PeopleRow people={people} /></div> : <EmptyState title="The room is still quiet." copy="Share a Moment or follow this Space to begin finding your people." href="/create" action="Create a Moment" />}</div>; }

function PursuitsTab({ hobbySlug }: { hobbySlug: string }) { return <div className="py-12 sm:py-16"><SectionIntro kicker="PURSUITS" title="Turn an interest into something you do." copy="Start a Pursuit solo or invite friends. Your Moments can keep the record going." /><div className="mt-8 grid gap-4 md:grid-cols-2"><PursuitRow title="Learning Pottery" copy="Start with a first class, then keep returning to the wheel." hobbySlug={hobbySlug} /><PursuitRow title="Making My First Bowl" copy="A practice with a clear next step and room for friends." hobbySlug={hobbySlug} /></div><Link to={`/pursuits/new?title=${encodeURIComponent("Learning Pottery")}`}><Button variant="brand" className="mt-8"><Plus className="size-4" /> Start a Pursuit</Button></Link></div>; }

function AboutTab({ space }: { space: SpaceFixture }) { return <div className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_360px]"><div><SectionIntro kicker="ABOUT THIS SPACE" title="A place built around practice." copy={space.description} /><dl className="mt-8 grid gap-4 sm:grid-cols-2">{[["Hosted by", space.host], ["Based in", space.location], ["Members", space.members], ["Format", "Online + physical community"]].map(([term, value]) => <div key={term} className="border-t border-border pt-3"><dt className="text-xs uppercase tracking-[.16em] text-muted-foreground">{term}</dt><dd className="mt-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>{value}</dd></div>)}</dl></div><div className="rounded-2xl border border-border bg-card p-5"><Users className="size-5 text-accent" /><h3 className="mt-8 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Make room for your version of it.</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Create a Space for a community, studio, practice, or physical place you want to bring together.</p><Link to="/spaces/new"><Button variant="outline" className="mt-6">Create a Space <ArrowUpRight className="size-4" /></Button></Link></div></div>; }

function PursuitRow({ title, copy, hobbySlug }: { title: string; copy: string; hobbySlug: string }) { return <div className="flex items-center gap-3 p-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent"><PenLine className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-base" style={{ fontFamily: "var(--font-serif)" }}>{title}</p><p className="mt-1 text-xs text-muted-foreground">{copy}</p></div><Link to={`/pursuits/new?title=${encodeURIComponent(title)}&hobby=${encodeURIComponent(hobbySlug)}`} className="shrink-0 text-xs text-accent hover:underline">Start <ArrowUpRight className="inline size-3" /></Link></div>; }
function SectionIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) { return <div className="max-w-2xl"><p className="ns-section-kicker mb-3">{kicker}</p><h2 className="text-4xl leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>{title}</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy}</p></div>; }
function EmptyState({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) { return <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8"><h3 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>{title}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{copy}</p><Link to={href}><Button variant="outline" size="sm" className="mt-5">{action} <ArrowUpRight className="size-3.5" /></Button></Link></div>; }

export function SpaceHomeRedirectNote() { return null; }
