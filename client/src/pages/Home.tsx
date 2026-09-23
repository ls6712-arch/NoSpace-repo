import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronRight,
  Circle,
  Compass,
  Flower2,
  Grid2X2,
  Heart,
  Menu,
  MessageCircle,
  MoveUpRight,
  Plus,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";

const imagery = {
  hero: "/manus-storage/sushii-multi-interest-hero_76ba0381.png",
  identity: "/manus-storage/sushii-identity-brand_35962dc6.jpg",
  ceramics: "/manus-storage/sushii-ceramics_0c673685.jpg",
  garden: "/manus-storage/sushii-garden_91fc05a6.jpg",
  reading: "/manus-storage/sushii-reading_4ff1bf6d.jpg",
};

const moments = [
  { label: "A softer blue", type: "Studio notes", image: imagery.ceramics, tint: "orange" },
  { label: "First tomatoes", type: "Garden", image: imagery.garden, tint: "green" },
  { label: "Margin notes", type: "Reading", image: imagery.reading, tint: "plum" },
];

function MiniAvatar({ name, color }: { name: string; color: string }) {
  return <span className="mini-avatar" style={{ background: color }}>{name}</span>;
}

function ActionLink({ children, dark = false, href = "https://www.trynospace.com" }: { children: React.ReactNode; dark?: boolean; href?: string }) {
  return (
    <a className={`button-link ${dark ? "button-link-dark" : ""}`} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      <span>{children}</span><ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
    </a>
  );
}

function ProductTopbar({ active = "My Space" }: { active?: string }) {
  return (
    <div className="product-topbar">
      <div className="product-mark"><span className="mark-dot" />Sushii</div>
      <div className="product-tabs">
        {['Discover', 'My Space', 'Circles'].map((tab) => <span className={tab === active ? "is-active" : ""} key={tab}>{tab}</span>)}
      </div>
      <div className="product-avatar">MA</div>
    </div>
  );
}

function SpaceScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`product-frame space-screen ${compact ? "is-compact" : ""}`}>
      <ProductTopbar />
      <div className="space-body">
        <aside className="product-rail" aria-hidden="true">
          <div className="rail-icon active"><Grid2X2 size={15} /></div>
          <div className="rail-icon"><Compass size={15} /></div>
          <div className="rail-icon"><UsersRound size={15} /></div>
          <div className="rail-rule" />
          <div className="rail-icon"><Plus size={15} /></div>
        </aside>
        <main className="space-main">
          <div className="space-heading">
            <div>
              <p className="product-kicker">MY SPACE</p>
              <h3>Marin’s Space</h3>
              <p className="space-subline">Little records of a life in progress.</p>
            </div>
            <button className="moment-add" type="button"><Plus size={14} /> Add a moment</button>
          </div>
          <div className="space-feature">
            <div className="feature-copy">
              <span className="feature-date">SEPTEMBER · 12 MOMENTS</span>
              <h4>Making room<br />for the good stuff.</h4>
              <span className="feature-tag">{compact ? "Ceramics" : "This week"}</span>
            </div>
            <img src={imagery.ceramics} alt="Pottery moment" />
          </div>
          <div className="moment-intro"><span>RECENT MOMENTS</span><button type="button">View all <ChevronRight size={13} /></button></div>
          <div className="moment-row">
            {moments.map((moment) => (
              <article className={`moment-card ${moment.tint}`} key={moment.label}>
                <img src={moment.image} alt="" />
                <div><small>{moment.type}</small><strong>{moment.label}</strong></div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function MomentScreen() {
  return (
    <div className="product-frame moment-screen">
      <ProductTopbar active="My Space" />
      <div className="moment-layout">
        <div className="moment-page-copy">
          <button className="back-link" type="button">← My Space</button>
          <p className="product-kicker">MOMENT · SEPTEMBER 14</p>
          <h3>First tomatoes</h3>
          <p>They finally went red overnight. Ate two straight from the garden, still warm from the sun.</p>
          <div className="tag-list"><span>Garden</span><span>Small win</span></div>
          <div className="moment-byline"><MiniAvatar name="M" color="#d98661" /><span>Added to Marin’s Space</span></div>
        </div>
        <img className="moment-photo" src={imagery.garden} alt="Garden harvest" />
      </div>
      <div className="moment-footer">
        <span><Heart size={14} /> A thing worth keeping</span>
        <span>11:42 AM</span>
      </div>
    </div>
  );
}

function PursuitScreen() {
  const steps = [
    ["1", "Begin", "Make a place for the thing you want to do."],
    ["2", "Keep going", "Add a moment every time you return to it."],
    ["3", "Look back", "See what the practice became."],
  ];
  return (
    <div className="product-frame pursuit-screen">
      <ProductTopbar active="My Space" />
      <div className="pursuit-layout">
        <div className="pursuit-intro">
          <p className="product-kicker">PURSUIT</p>
          <h3>Throwing<br />a better cup.</h3>
          <div className="pursuit-progress"><span /><span /><span className="waiting" /><span className="waiting" /></div>
          <p>7 sessions · Started in May</p>
          <button type="button" className="quiet-button"><Plus size={14} /> Add progress</button>
        </div>
        <div className="pursuit-story">
          {steps.map(([number, title, copy], index) => (
            <div className={`story-step ${index === 2 ? "faded" : ""}`} key={number}>
              <span className="story-number">{number}</span>
              <div><strong>{title}</strong><p>{copy}</p></div>
              {index === 1 && <img src={imagery.ceramics} alt="" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CirclesScreen() {
  return (
    <div className="product-frame circles-screen">
      <ProductTopbar active="Circles" />
      <div className="circle-header">
        <div><p className="product-kicker">CIRCLES</p><h3>People making<br />things slowly.</h3></div>
        <button type="button" className="quiet-button"><Plus size={14} /> Find a circle</button>
      </div>
      <div className="circle-content">
        <article className="circle-card circle-card-feature">
          <div className="circle-card-art"><img src={imagery.reading} alt="" /></div>
          <div className="circle-card-info"><span className="circle-count">42 people</span><h4>Books in the margins</h4><p>For the passages that followed you around all day.</p><div className="avatar-stack"><MiniAvatar name="A" color="#B58668" /><MiniAvatar name="L" color="#808B70" /><MiniAvatar name="P" color="#7B5766" /><span>+39</span></div></div>
        </article>
        <div className="circle-notes">
          <div className="note-card"><MiniAvatar name="R" color="#B06D55" /><p>“The book chose me in a thrift shop. The first page had a grocery list tucked inside.”</p><small>Rae · 16m</small></div>
          <div className="note-card peach"><MiniAvatar name="S" color="#567969" /><p>“New to watercolors. The tiny orange is my eighth try.”</p><small>Simon · 1h</small></div>
        </div>
      </div>
    </div>
  );
}

function SocialProof() {
  return (
    <div className="proof-line">
      <div className="proof-avatars"><MiniAvatar name="M" color="#D38C6B" /><MiniAvatar name="A" color="#7B8D6B" /><MiniAvatar name="R" color="#917184" /></div>
      <span>For the many ways to be a person.</span>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="site-shell">
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="Sushii home"><span className="brand-orbit" />Sushii</a>
        <nav className={menuOpen ? "mobile-open" : ""} aria-label="Primary navigation">
          <a href="#space" onClick={() => setMenuOpen(false)}>My Space</a>
          <a href="#moments" onClick={() => setMenuOpen(false)}>Moments</a>
          <a href="#pursuits" onClick={() => setMenuOpen(false)}>Pursuits</a>
          <a href="#circles" onClick={() => setMenuOpen(false)}>Circles</a>
        </nav>
        <div className="nav-cta"><a href="https://www.trynospace.com" target="_blank" rel="noreferrer">Log in</a><ActionLink>Create your Space</ActionLink></div>
        <button className="menu-toggle" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-intro">
            <p className="eyebrow"><span /> A PLACE FOR THE MANY SIDES OF YOU</p>
            <h1>Your interests are <em>part of</em> your story.</h1>
            <p className="hero-copy">A place to keep track of what you are into, what you are learning, making, exploring, and doing.</p>
            <div className="hero-actions"><ActionLink dark href="#moments">Start exploring</ActionLink><a href="#how-it-works" className="text-link">See how Sushii works <ArrowDown size={15} /></a></div>
            <SocialProof />
          </div>
          <div className="hero-visual" aria-label="A collection of interests and activities coming together">
            <div className="hero-visual-caption"><span>01</span> many interests, one story</div>
            <div className="hero-image-wrap"><img src={imagery.hero} alt="A collection of creative interests, hobbies, and moments" /></div>
            <div className="hero-visual-note"><span>02</span> keep exploring</div>
          </div>
        </section>

        <section className="moments-section section-wrap" id="moments">
          <div className="section-label"><span>02</span><p>MOMENTS</p></div>
          <div className="split-heading"><h2>Keep the moments<br />that make up <em>your story.</em></h2><p>Photos, discoveries, little projects, places, meals, books, experiments, and everything in between.</p></div>
          <div className="moment-product-stage"><div className="stage-side-note"><Camera size={17} /><span>A place for<br />what happened.</span></div><MomentScreen /><div className="stage-date"><span>SEPT</span><strong>14</strong><i>2026</i></div></div>
        </section>

        <section className="pursuits-section section-wrap" id="pursuits">
          <div className="pursuit-copy-block"><div className="section-label"><span>03</span><p>PURSUITS</p></div><h2>Turn interests into things you <em>actually do.</em></h2><p>Create Pursuits for the things you are learning, making, practicing, or working toward. Add moments as you go.</p><div className="pursuit-pullquote"><span>“</span><p>Every return is part of the work.</p></div></div>
          <div className="pursuit-product-stage"><PursuitScreen /><div className="scrap-label">small<br />progress<br />counts <MoveUpRight size={15} /></div></div>
        </section>

        <section className="core-idea section-wrap" id="space">
          <div className="section-label"><span>01</span><p>YOUR SPACE</p></div>
          <div className="core-copy"><div><h2>Bring it all together.<br /><em>Make room for your story.</em></h2><a className="text-link space-secondary-link" href="https://www.trynospace.com" target="_blank" rel="noreferrer">Make a Space <ArrowUpRight size={15} /></a></div><p>Your Space brings your Moments and Pursuits together in one place. See the things you care about begin to feel like a life.</p></div>
          <div className="archive-scene">
            <div className="archive-caption"><span>MARIN’S SPACE</span><strong>September, so far</strong><p>12 small things, kept close.</p></div>
            <div className="archive-polaroid is-one"><img src={imagery.ceramics} alt="A pottery moment" /><span>A softer blue</span></div>
            <div className="archive-polaroid is-two"><img src={imagery.garden} alt="A garden moment" /><span>First tomatoes</span></div>
            <div className="archive-polaroid is-three"><img src={imagery.reading} alt="A reading moment" /><span>Margin notes</span></div>
            <div className="archive-mark"><Sparkles size={18} /> <span>KEEP BECOMING</span></div>
          </div>
        </section>

        <section className="circles-section section-wrap" id="circles">
          <div className="circles-text"><div className="section-label"><span>04</span><p>CIRCLES</p></div><h2>Find people who are doing the <em>same things.</em></h2><p>Circles are smaller communities built around shared interests and actually doing things together.</p><a href="https://www.trynospace.com" target="_blank" rel="noreferrer" className="text-link">Meet the circles <ArrowUpRight size={15} /></a></div>
          <div className="circles-product-stage"><CirclesScreen /></div>
        </section>

        <section className="difference-section" id="how-it-works">
          <div className="brand-statement section-wrap">
            <div className="brand-statement-image"><img src={imagery.identity} alt="A table of many interests and creative practices" /></div>
            <div className="brand-statement-copy"><p className="eyebrow"><span /> A WIDER WAY TO BE A PERSON</p><h2>Your interests do not have to fit <em>one identity.</em></h2><p>You can be a gardener and a reader, a beginner and an expert, a maker and a wanderer. Sushii gives every part of your curiosity somewhere to live.</p><div className="difference-lines"><p><span>01</span> No endless scrolling.</p><p><span>02</span> No popularity contest.</p><p><span>03</span> Just the things you care about—and the people who care about them too.</p></div></div>
          </div>
        </section>

        <section className="montage-section section-wrap">
          <div className="montage-heading"><div><p className="eyebrow"><span /> A PLACE WITH ROOM TO GROW</p><h2>All the pieces<br />of <em>your Space.</em></h2></div><p>Different views of the same life, held together in one place.</p></div>
          <div className="screen-montage">
            <div className="montage-card montage-space"><span>01 / MY SPACE</span><SpaceScreen compact /></div>
            <div className="montage-card montage-moment"><span>02 / MOMENTS</span><MomentScreen /></div>
            <div className="montage-card montage-pursuit"><span>03 / PURSUITS</span><PursuitScreen /></div>
            <div className="montage-card montage-circles"><span>04 / CIRCLES</span><CirclesScreen /></div>
          </div>
        </section>

        <section className="final-cta section-wrap">
          <div className="final-orbit orbit-a" /><div className="final-orbit orbit-b" />
          <div className="cta-content"><p className="eyebrow"><span /> KEEP EXPLORING</p><h2>Explore the things<br />that make <em>you.</em></h2><p>Start keeping track of what you’re into, one Moment at a time.</p><ActionLink dark href="#moments">Explore Sushii</ActionLink><a className="text-link cta-secondary-link" href="https://www.trynospace.com" target="_blank" rel="noreferrer">Make a Space <ArrowUpRight size={15} /></a><small>Free to begin. Kept private unless you choose otherwise.</small></div>
          <div className="cta-moments" aria-hidden="true"><div><Flower2 size={20} /><span>begin anywhere</span></div><div><BookOpen size={20} /><span>keep what matters</span></div><div><MessageCircle size={20} /><span>find your people</span></div></div>
        </section>
      </main>

      <footer className="site-footer section-wrap"><a className="brand" href="#top"><span className="brand-orbit" />Sushii</a><p>A personal space for the things that make you, you.</p><div><a href="#space">My Space</a><a href="#circles">Circles</a><a href="https://www.trynospace.com" target="_blank" rel="noreferrer">Create your Space</a></div></footer>
    </div>
  );
}
