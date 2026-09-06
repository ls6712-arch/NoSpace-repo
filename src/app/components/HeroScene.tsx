/**
 * The NoSpace hero scene: three people mid-hobby on a small island of green —
 * one throwing a pot, one holding up the thing they just finished, one tending
 * a plant. Read left to right it says make things, find your people, keep going.
 *
 * The ground is a stack of soft islands rather than a hillside with a straight
 * bottom edge, so the scene floats on the sky band with no seam and no crop.
 *
 * Drawn in the brand palette only: forest for structure and detail, coral for
 * clothing, cream for highlights, yellow for the small sparks. Skin tones are
 * the one place other hues are allowed — they're artwork, not UI.
 *
 * Motion is per-element and slow: figures breathe on a 6.5s cycle, plants sway
 * on 7.5s, clouds drift on 34s, sparkles pulse on 3.4s. The periods are
 * deliberately mismatched so the scene never syncs up and starts looking
 * mechanical. Every one of those classes is switched off under
 * prefers-reduced-motion in theme.css.
 */
export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 96 640 444"
      className={className}
      role="img"
      aria-label="Three people on a green island: one throwing a pot, one holding up a finished piece, one tending a plant"
    >
      {/* ── Sky furniture ──────────────────────────────────────────────── */}
      <g transform="translate(0,84)">
      <g className="ns-drift" fill="#F8F4EB" opacity=".85">
        <ellipse cx="118" cy="74" rx="46" ry="21" />
        <ellipse cx="156" cy="62" rx="32" ry="17" />
        <ellipse cx="86" cy="64" rx="26" ry="14" />
      </g>
      <g className="ns-drift" style={{ animationDuration: "46s" }} fill="#F8F4EB" opacity=".7">
        <ellipse cx="522" cy="104" rx="38" ry="17" />
        <ellipse cx="554" cy="94" rx="26" ry="13" />
      </g>

      <g fill="#F5C542">
        <path className="ns-twinkle" d="M452 74l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" />
        <path
          className="ns-twinkle"
          style={{ animationDelay: "1.1s" }}
          d="M248 62l3.6 9.4 9.4 3.6-9.4 3.6-3.6 9.4-3.6-9.4-9.4-3.6 9.4-3.6z"
        />
        <path
          className="ns-twinkle"
          style={{ animationDelay: "2.2s" }}
          d="M596 196l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"
        />
      </g>

      </g>

      {/* ── The island ─────────────────────────────────────────────────── */}
      <ellipse cx="322" cy="452" rx="314" ry="94" fill="#2C7A57" />
      <ellipse cx="300" cy="474" rx="266" ry="70" fill="#1B6244" />
      <ellipse cx="336" cy="490" rx="196" ry="46" fill="#0E4D3A" />

      {/* pines, set back on the island so they read as depth, not scenery */}
      <g fill="#0E4D3A">
        <rect x="592" y="392" width="8" height="26" rx="3" />
        <path d="M596 306l24 46h-48zM596 336l27 50h-54zM596 364l30 54h-60z" />
      </g>
      <g fill="#1B6244">
        <rect x="76" y="404" width="7" height="26" rx="3" />
        <path d="M79.5 322l23 44h-46zM79.5 350l26 48h-52zM79.5 378l29 52h-58z" />
      </g>

      {/* ── Make things — at the wheel ─────────────────────────────────── */}
      <g className="ns-breathe">
        <ellipse cx="150" cy="450" rx="52" ry="9" fill="#0B3E2E" opacity=".2" />
        {/* wheel and stool */}
        <rect x="144" y="418" width="12" height="30" fill="#0E4D3A" />
        <ellipse cx="150" cy="414" rx="36" ry="10" fill="#0B3E2E" />
        <ellipse cx="150" cy="409" rx="36" ry="10" fill="#1B6244" />
        {/* the pot taking shape */}
        <path
          d="M136 372c0-10 6-16 14-16s14 6 14 16c8 5 12 12 12 19 0 11-11 17-26 17s-26-6-26-17c0-7 4-14 12-19Z"
          fill="#F8F4EB"
        />
        <path d="M134 392h32M138 400h24" stroke="#C43F22" strokeWidth="3" strokeLinecap="round" />
        {/* body */}
        <path d="M124 350c0-16 12-26 26-26s26 10 26 26l-4 32h-44Z" fill="#FF6B4A" />
        {/* arms brought in to the clay */}
        <path
          d="M127 350c-13 11-11 25 1 32"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="130" cy="384" r="7.5" fill="#E8A87C" />
        <path
          d="M173 350c13 11 11 25-1 32"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="170" cy="384" r="7.5" fill="#E8A87C" />
        {/* head */}
        <circle cx="150" cy="318" r="21" fill="#E8A87C" />
        <path d="M129 316c0-14 9-23 21-23s21 9 21 21c0 5-3 6-7 4-7-4-21-5-30 1-3 2-5 2-5-3Z" fill="#0E4D3A" />
        <circle cx="143" cy="318" r="1.9" fill="#0E4D3A" />
        <circle cx="158" cy="318" r="1.9" fill="#0E4D3A" />
        <path
          d="M146 326c3 2.6 6 2.6 9 0"
          stroke="#0E4D3A"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* ── Find your people — holding the finished piece up ───────────── */}
      <g className="ns-breathe" style={{ animationDelay: "1.4s", animationDuration: "7.2s" }}>
        <ellipse cx="330" cy="472" rx="44" ry="8" fill="#0B3E2E" opacity=".2" />
        <path d="M312 398l-10 68a5 5 0 0 0 4 6l9 1 8-73Z" fill="#0E4D3A" />
        <path d="M340 396l10 70 9-2a5 5 0 0 0 4-6l-9-62Z" fill="#0E4D3A" />
        <path d="M296 470c0-5 6-8 14-8s14 3 14 8-28 5-28 0Z" fill="#F8F4EB" />
        <path d="M346 472c0-5 6-8 14-8s14 3 14 8-28 5-28 0Z" fill="#F8F4EB" />
        <path d="M304 332c0-14 11-23 26-23s26 9 26 23l-5 68h-42Z" fill="#FF6B4A" />
        {/* One arm up and out with the piece, one hand on the hip — held to
            the side so the silhouette reads as showing something off rather
            than balancing it on their head. */}
        <path
          d="M310 342C296 356 293 370 300 380"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="302" cy="383" r="7.5" fill="#C68A5E" />
        <path
          d="M350 342C372 324 385 300 391 276"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="393" cy="270" r="7.5" fill="#C68A5E" />
        {/* the piece they made, held aloft */}
        <g className="ns-twinkle" style={{ animationDuration: "5.6s" }}>
          <path
            d="M379 240c0-8 6-13 14-13s14 5 14 13c6 4 9 9 9 15 0 8-10 12-23 12s-23-4-23-12c0-6 3-11 9-15Z"
            fill="#F8F4EB"
          />
          <path d="M379 256h28" stroke="#C43F22" strokeWidth="3" strokeLinecap="round" />
          <path d="M393 216v9M406 222l-5 7M380 222l5 7" stroke="#F5C542" strokeWidth="3.4" strokeLinecap="round" />
        </g>
        {/* head */}
        <circle cx="330" cy="300" r="21" fill="#C68A5E" />
        <path d="M309 298c0-14 9-23 21-23s21 9 21 21c0 5-3 6-7 4-7-4-21-5-30 1-3 2-5 2-5-3Z" fill="#0E4D3A" />
        <circle cx="343" cy="278" r="7" fill="#0E4D3A" />
        <circle cx="323" cy="300" r="1.9" fill="#0E4D3A" />
        <circle cx="338" cy="300" r="1.9" fill="#0E4D3A" />
        <path
          d="M325 308c3.4 3.2 7.6 3.2 11 0"
          stroke="#0E4D3A"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* ── Keep going — tending the plant ─────────────────────────────── */}
      <g className="ns-breathe" style={{ animationDelay: "2.8s", animationDuration: "6.9s" }}>
        <ellipse cx="470" cy="476" rx="42" ry="8" fill="#0B3E2E" opacity=".2" />
        <path d="M452 412l-8 58a5 5 0 0 0 4 6l9 1 6-63Z" fill="#0E4D3A" />
        <path d="M482 410l9 60 9-2a5 5 0 0 0 4-6l-8-52Z" fill="#0E4D3A" />
        <path d="M438 474c0-5 6-8 14-8s14 3 14 8-28 5-28 0Z" fill="#F8F4EB" />
        <path d="M488 476c0-5 6-8 14-8s14 3 14 8-28 5-28 0Z" fill="#F8F4EB" />
        <path d="M446 358c0-14 11-23 25-23s25 9 25 23l-4 56h-42Z" fill="#FF6B4A" />
        {/* one arm out to the sapling, one resting */}
        <path
          d="M493 362c14 12 20 28 22 44"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="517" cy="412" r="7.5" fill="#8B5A3C" />
        <path
          d="M449 362c-11 10-15 22-16 34"
          stroke="#FF6B4A"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="432" cy="402" r="7.5" fill="#8B5A3C" />
        {/* head */}
        <circle cx="471" cy="326" r="21" fill="#8B5A3C" />
        <path d="M450 324c0-14 9-23 21-23s21 9 21 21c0 5-3 6-7 4-7-4-21-5-30 1-3 2-5 2-5-3Z" fill="#0E4D3A" />
        <circle cx="464" cy="326" r="1.9" fill="#0E4D3A" />
        <circle cx="479" cy="326" r="1.9" fill="#0E4D3A" />
        <path
          d="M466 334c3.4 3.2 7.6 3.2 11 0"
          stroke="#0E4D3A"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* the sapling being tended */}
      <g className="ns-sway">
        <path d="M528 440h46l-6 40a6 6 0 0 1-6 5h-22a6 6 0 0 1-6-5Z" fill="#FF6B4A" />
        <rect x="524" y="429" width="54" height="13" rx="4" fill="#C43F22" />
        <path d="M551 429v-46" stroke="#0E4D3A" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M551 406c-2-14-13-22-28-21 0 15 13 24 28 21ZM551 394c2-15 13-23 28-22 0 15-13 24-28 22Z"
          fill="#1B6244"
        />
        <path d="M551 418c-2-11-11-17-22-16 0 12 10 18 22 16Z" fill="#2C7A57" />
      </g>

      {/* wildflowers */}
      <g>
        <path
          d="M236 492c7-13 7-25 3-37M258 498c-2-14 1-26 9-35"
          stroke="#1B6244"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#FF6B4A" className="ns-sway" style={{ animationDuration: "9s" }}>
          <circle cx="239" cy="448" r="7" />
          <circle cx="230" cy="456" r="6.4" />
          <circle cx="248" cy="456" r="6.4" />
          <circle cx="267" cy="458" r="7" />
          <circle cx="258" cy="466" r="6.4" />
          <circle cx="276" cy="466" r="6.4" />
        </g>
        <circle cx="239" cy="456" r="3.6" fill="#F5C542" />
        <circle cx="267" cy="466" r="3.6" fill="#F5C542" />
      </g>
    </svg>
  );
}
