"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/*
 * Animated example chat for the home hero phone.
 * Plays 3 short example conversations (request -> posted & shared -> business reply -> confirmed)
 * one bubble at a time, with typing dots, and loops. Purely decorative (the stage is aria-hidden).
 * prefers-reduced-motion: shows one complete conversation as a static frame.
 */

export type ChatMsg =
  | { k: 'out'; text: string }
  | { k: 'card'; title: string; text: string; badge: string }
  | { k: 'in'; from: string; text: string }
  | { k: 'ok'; text: string };

export type ChatScript = { push: string; msgs: ChatMsg[] };

type Item = { id: number; m: ChatMsg | null; typing?: boolean; from?: string };

const AppMark = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M18 20v16c0 8 5 12 14 12s14-4 14-12V20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" transform="rotate(180 32 32)" />
  </svg>
);

export function AppIcon({ className = '' }: { className?: string }) {
  return <span className={`f-appicon ${className}`}><AppMark /></span>;
}

function Bubble({ m }: { m: ChatMsg }) {
  if (m.k === 'out') return <div className="f-b f-b-out">{m.text}</div>;
  if (m.k === 'in') return <div className="f-b f-b-in"><small>{m.from}</small>{m.text}</div>;
  if (m.k === 'ok') return <div className="f-b f-b-ok">{m.text}</div>;
  return <div className="f-b f-b-card"><b>✓ {m.title}</b><span>{m.text}</span><em>{m.badge}</em></div>;
}

// delay (ms) before each message of a conversation appears; replies from a business get typing dots first
const BEFORE: Record<ChatMsg['k'], number> = { out: 1000, card: 1000, in: 700, ok: 900 };
const TYPING_MS = 1500;
const HOLD_MS = 2600;

export function HeroChat({ scripts, day, pushLabel, pushNow }: { scripts: ChatScript[]; day: string; pushLabel: string; pushNow: string }) {
  const [convo, setConvo] = useState(0);
  const [items, setItems] = useState<Item[]>(() => [{ id: 1, m: scripts[0].msgs[0] }]);
  const [push, setPush] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // auto-scroll: keep the newest bubble in view, following the list as each bubble grows in
  useIsoLayoutEffect(() => {
    const view = viewRef.current;
    const list = listRef.current;
    if (!view || !list) return;
    const measure = () => setShift(Math.max(0, list.offsetHeight - view.clientHeight));
    measure();
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(view);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) {
      setItems(scripts[0].msgs.map((m, i) => ({ id: i + 1, m })));
      return;
    }
    let cancelled = false;
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let uid = 10;
    const io = 'IntersectionObserver' in window && rootRef.current
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 })
      : null;
    if (io && rootRef.current) io.observe(rootRef.current);

    // wait helper that also holds while the phone is off-screen or the tab is hidden
    const wait = (ms: number) => new Promise<void>((resolve) => {
      const tick = () => {
        if (cancelled) return;
        if (!visible || document.hidden) { timer = setTimeout(tick, 400); return; }
        resolve();
      };
      timer = setTimeout(tick, ms);
    });

    const play = async () => {
      let c = 0;
      let first = true;
      while (!cancelled) {
        const s = scripts[c];
        setConvo(c);
        if (!first) {
          setItems([]);
          setLeaving(false);
          await wait(250);
        }
        for (let i = first ? 1 : 0; i < s.msgs.length; i++) {
          const m = s.msgs[i];
          await wait(i === 0 ? 300 : BEFORE[m.k]);
          if (cancelled) return;
          if (m.k === 'in') {
            const id = ++uid;
            setItems((prev) => [...prev, { id, m: null, typing: true }]);
            await wait(TYPING_MS);
            if (cancelled) return;
            setItems((prev) => prev.map((it) => (it.id === id ? { id, m } : it)));
          } else {
            const id = ++uid;
            setItems((prev) => [...prev, { id, m }]);
          }
          if (m.k === 'card') {
            // the business side gets the lead as a push notification
            wait(700).then(() => { if (!cancelled) setPush(true); });
            wait(4200).then(() => { if (!cancelled) setPush(false); });
          }
        }
        first = false;
        await wait(HOLD_MS);
        if (cancelled) return;
        setPush(false);
        setLeaving(true);
        await wait(420);
        c = (c + 1) % scripts.length;
      }
    };
    play();
    return () => { cancelled = true; if (timer) clearTimeout(timer); io?.disconnect(); };
  }, [scripts]);

  return (
    <div className="f-chatwrap" ref={rootRef}>
      <div className={`f-push${push ? ' on' : ''}`}>
        <AppIcon className="f-push-icon" />
        <div><small>{pushLabel} · {pushNow}</small><span>{scripts[convo].push}</span></div>
      </div>
      <div className={`f-chat${leaving ? ' leaving' : ''}`} ref={viewRef}>
        <div className="f-chat-list" ref={listRef} style={{ transform: `translateY(${-shift}px)` }}>
        <span className="f-chat-day">{day}</span>
        {items.map((it) => (
          <div className="f-m" key={it.id}>
            <div className="f-m-in">
              {it.typing || !it.m ? <div className="f-typing"><i /><i /><i /></div> : <Bubble m={it.m} />}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
