/**
 * Kafka-style room consumer hook.
 *
 * Holds a `seq` offset (last event we've seen) and continuously long-polls
 * /api/room/<code>/events?since=<seq>&wait=20000. Each batch advances the
 * offset; on every batch we re-fetch the room snapshot so React renders
 * fresh state.
 *
 * Why re-fetch the snapshot instead of applying events client-side: the
 * room state is small and turn-based, so a snapshot fetch is cheap and we
 * avoid maintaining two reducers (server + client) in lockstep. Events
 * still drive *when* to re-fetch — they're the wakeup signal.
 *
 * Connection states:
 *   'connecting' — initial snapshot in flight, no room yet
 *   'connected'  — at least one successful poll
 *   'error'      — last request failed; will retry with backoff
 */

import { useEffect, useRef, useState } from 'react';
import { api } from './apiClient.js';

const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 8000;

export function useRoomConsumer(code) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const seqRef = useRef(0);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!code) {
      setRoom(null);
      setStatus('connecting');
      return;
    }

    let cancelled = false;
    let retryDelay = RETRY_MIN_MS;

    async function loadSnapshot() {
      const data = await api.getRoom(code);
      if (cancelled) return;
      seqRef.current = data.seq ?? 0;
      setRoom(data.room);
      setStatus('connected');
      setError(null);
    }

    async function loop() {
      try {
        await loadSnapshot();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err.message);
        const delay = retryDelay;
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        setTimeout(loop, delay);
        return;
      }

      while (!cancelled) {
        const ac = new AbortController();
        abortRef.current = ac;
        try {
          const data = await api.fetchEvents(code, seqRef.current, {
            waitMs: 20_000,
            signal: ac.signal,
          });
          if (cancelled) return;
          if (data.events.length > 0) {
            seqRef.current = data.events[data.events.length - 1].seq;
            // New activity — pull a fresh snapshot.
            try {
              const snap = await api.getRoom(code);
              if (cancelled) return;
              if (snap.seq > seqRef.current) seqRef.current = snap.seq;
              setRoom(snap.room);
            } catch (err) {
              if (cancelled) return;
              setStatus('error');
              setError(err.message);
            }
          } else {
            // Long-poll timed out cleanly; just loop again. If the seq we
            // observed is ahead (server appended during our gap), re-snap.
            if (data.seq > seqRef.current) {
              seqRef.current = data.seq;
              try {
                const snap = await api.getRoom(code);
                if (cancelled) return;
                setRoom(snap.room);
              } catch {}
            }
          }
          retryDelay = RETRY_MIN_MS;
          setStatus('connected');
          setError(null);
        } catch (err) {
          if (cancelled || err.name === 'AbortError') return;
          setStatus('error');
          setError(err.message);
          await sleep(retryDelay);
          retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        }
      }
    }

    loop();

    return () => {
      cancelled = true;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [code]);

  return { room, status, error };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
