import { useAuth0 } from "@auth0/auth0-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

interface FadingStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  active?: boolean;
}

const techStack = [
  { name: "Gemini", logo: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=128" },
  { name: "Wolfram Alpha", logo: "https://www.google.com/s2/favicons?domain=wolframalpha.com&sz=128" },
  { name: "Desmos", logo: "https://www.google.com/s2/favicons?domain=desmos.com&sz=128" },
  { name: "Auth0", logo: "https://www.google.com/s2/favicons?domain=auth0.com&sz=128" },
];

function CurveIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 120 60" aria-hidden="true" className="h-10 w-20 text-cyan-600">
      <path d="M5 48 C30 8, 65 8, 115 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="5" cy="48" r="3" fill="currentColor" />
      <circle cx="115" cy="48" r="3" fill="currentColor" />
    </svg>
  );
}

function CompassIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-8 w-8 text-cyan-600">
      <path d="M32 8 L20 44 L32 34 L44 44 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 34 L32 56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

export default function LandingPage(): JSX.Element {
  const { isAuthenticated, logout } = useAuth0();
  const reduceMotion = useReducedMotion();
  const activeStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<FadingStroke[]>([]);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height:
      typeof window !== "undefined"
        ? Math.max(document.documentElement.scrollHeight, window.innerHeight)
        : 1080,
  }));

  useEffect(() => {
    const refreshSize = () => {
      setViewport({
        width: window.innerWidth,
        height: Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          window.innerHeight,
        ),
      });
    };

    refreshSize();
    window.addEventListener("resize", refreshSize);
    window.addEventListener("load", refreshSize);

    let observer: ResizeObserver | null = null;
    if (pageRef.current) {
      observer = new ResizeObserver(refreshSize);
      observer.observe(pageRef.current);
    }

    return () => {
      window.removeEventListener("resize", refreshSize);
      window.removeEventListener("load", refreshSize);
      observer?.disconnect();
    };
  }, []);

  const beginStroke = (pointerId: number, pageX: number, pageY: number) => {
    drawingRef.current = true;
    activePointerIdRef.current = pointerId;
    activeStrokeRef.current = [{ x: pageX, y: pageY }];
    setStrokes((prev) => [
      ...prev.filter((s) => s.id !== "active"),
      { id: "active", points: activeStrokeRef.current, active: true },
    ]);
  };

  const updateStroke = (pointerId: number, pageX: number, pageY: number) => {
    if (!drawingRef.current || activePointerIdRef.current !== pointerId) {
      return;
    }
    activeStrokeRef.current = [...activeStrokeRef.current, { x: pageX, y: pageY }];
    setStrokes((prev) => [
      ...prev.filter((s) => s.id !== "active"),
      { id: "active", points: activeStrokeRef.current, active: true },
    ]);
  };

  const endStroke = (pointerId: number) => {
    if (!drawingRef.current || activePointerIdRef.current !== pointerId) {
      return;
    }
    drawingRef.current = false;
    activePointerIdRef.current = null;
    const points = activeStrokeRef.current;
    activeStrokeRef.current = [];

    if (points.length < 2) {
      setStrokes((prev) => prev.filter((s) => s.id !== "active"));
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setStrokes((prev) => [...prev.filter((s) => s.id !== "active"), { id, points }]);
    window.setTimeout(() => {
      setStrokes((prev) => prev.filter((s) => s.id !== id));
    }, 1400);
  };

  const sectionVariant = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest("a,button,input,textarea,select,label,[role='button'],[contenteditable='true']"));
  };

  return (
    <div
      ref={pageRef}
      className="relative min-h-screen select-none overflow-x-hidden bg-slate-50 text-slate-900"
      onPointerDownCapture={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (isInteractiveTarget(e.target)) {
          return;
        }
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        beginStroke(e.pointerId, e.pageX, e.pageY);
      }}
      onPointerMoveCapture={(e) => updateStroke(e.pointerId, e.pageX, e.pageY)}
      onPointerUpCapture={(e) => {
        endStroke(e.pointerId);
        if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancelCapture={(e) => {
        endStroke(e.pointerId);
        if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <svg
        className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-full"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {strokes.map((stroke) => (
          <motion.polyline
            key={stroke.id}
            points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#0e7490"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 1 }}
            animate={{ opacity: stroke.active ? 1 : 0 }}
            transition={{ duration: stroke.active ? 0 : 1.15, ease: "easeOut" }}
          />
        ))}
      </svg>

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3" aria-label="Main navigation">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
            Derive AI
          </a>
          <div className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#about" className="hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">About</a>
            <a href="#tech" className="hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Tech</a>
            <a href="#demo" className="hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Demo</a>
          </div>
          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  aria-label="Log in"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  aria-label="Sign up"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                onClick={() =>
                  logout({
                    logoutParams: {
                      returnTo: window.location.origin,
                    },
                  })
                }
              >
                Log Out
              </button>
            )}
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial="hidden" animate="show" variants={sectionVariant}>
            <p className="mb-4 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              AI math workspace
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Think on a whiteboard.
              <span className="block text-cyan-700">Accelerate with AI.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Derive AI combines freeform math whiteboarding with intelligent derivations, hints, and checks, so you can move from messy ideas to clear solutions quickly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link
                  to="/app"
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Launch Whiteboard
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Login to Launch
                </Link>
              )}
              <a
                href="#about"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Learn more
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between" id="demo">
              <div className="flex items-center gap-2 text-slate-700">
                <CurveIcon />
                <p className="text-sm font-medium">Preview demo video</p>
              </div>
              <CompassIcon />
            </div>
            <motion.div
              whileHover={reduceMotion ? {} : { scale: 1.01 }}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <div className="aspect-video w-full bg-[linear-gradient(135deg,#e2e8f0,#cbd5e1)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/55 p-4 text-white transition group-hover:bg-black/70">
                  ▶
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2 text-xs text-white">
                Demo placeholder: hover to preview interaction
              </div>
            </motion.div>
          </motion.div>
        </section>

        <motion.section
          id="about"
          className="mx-auto w-full max-w-6xl px-5 py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariant}
        >
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">About Derive AI</h2>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 leading-7 text-slate-700 shadow-sm">
            <p>
              Derive AI was built during a hackathon to address a common problem: students and builders think visually on whiteboards, but most math tools force rigid input and break creative flow.
            </p>
            <p className="mt-4">
              The project aims to keep the freedom of sketching while adding AI guidance. You can write naturally, get fast derivation support, verify steps, and move from intuition to structured math without context switching.
            </p>
            <p className="mt-4">
              Our goal is to make advanced math tooling feel immediate, accessible, and trustworthy for learning, prototyping, and collaboration.
            </p>
          </div>
        </motion.section>

        <motion.section
          id="tech"
          className="mx-auto w-full max-w-6xl px-5 py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariant}
        >
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Technology Stack</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {techStack.map((tech) => (
              <div key={tech.name} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm">
                <img src={tech.logo} alt={`${tech.name} logo`} className="h-8 w-8 rounded-md" loading="lazy" />
                <span>{tech.name}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Derive AI</p>
          <p className="text-xs text-slate-500">Built at a hackathon to simplify real-world math workflows.</p>
        </div>
      </footer>
    </div>
  );
}
