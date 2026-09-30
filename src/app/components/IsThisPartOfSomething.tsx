import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { startProject } from "../lib/journal";
import { attachPostToPursuit, mirrorPursuit } from "../lib/pursuitsRemote";
import { Post } from "../data/posts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/**
 * Shown at most once per session, right after saving a Moment that isn't
 * already in a Pursuit (see §4 of the Step 3 brief) — never the word
 * "Pursuit" itself, since naming it is the whole ask. A name quietly starts
 * one with the existing minimal creation path (lib/journal.ts's
 * startProject — the same "just a name" call CreatePursuit.tsx's own last
 * step and Log.tsx's inline "type a new one" both already use) and attaches
 * this Moment to it; "Not now" is an equal-weight way out, not a lesser one.
 *
 * The per-session gate lives at module scope, not component state — so it
 * holds across this component unmounting and remounting for the *next*
 * eligible Moment in the same tab, and only resets on an actual reload.
 */
let shownThisSession = false;

export function hasOfferedIsThisPartOfSomethingThisSession() {
  return shownThisSession;
}

export function IsThisPartOfSomething({ post, onDone }: { post: Post; onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const finish = () => {
    shownThisSession = true;
    onDone();
  };

  const notNow = () => finish();

  const next = async () => {
    const title = name.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const project = startProject({
        title,
        hobbySlug: post.hobbySlug,
        subHobby: post.subHobby,
        inspiredByPostId: post.id,
      });
      void attachPostToPursuit(post.id, project.id);
      if (user) void mirrorPursuit(user.id, project);
    } finally {
      setCreating(false);
      finish();
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
        Is this part of something?
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 80))}
        placeholder="Give it a name, like Sourdough"
        autoFocus
        maxLength={80}
        onKeyDown={(e) => e.key === "Enter" && next()}
        className="mt-2.5"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">Your next moments can go with it.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={notNow} disabled={creating}>
          Not now
        </Button>
        <Button variant="coral" onClick={next} disabled={!name.trim() || creating}>
          {creating ? "Adding…" : "Next"}
        </Button>
      </div>
    </div>
  );
}
