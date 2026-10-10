import React, {
  Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import "./PayoutScene.css";
import "./RasterPayout.css";
import "./WinCelebration.css";

const PayoutFx = lazy(() => import("./PayoutFx.jsx"));
const wholeMoney = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const fractionMoney = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const names = {
  coinflip: "Coinflip", dice: "Dice", plinko: "Plinko",
  roulette: "Roulette", upgrader: "Upgrader", slots: "Bonanza", blackjack: "Blackjack", maskhouse: "Mask Hou$e", lecipher: "LeXof",
};

export function formatCents(cents) {
  return (cents % 100 === 0 ? wholeMoney : fractionMoney).format(cents / 100);
}

function useReducedMotion(explicit) {
  const [system, setSystem] = useState(() =>
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return Boolean(explicit || system);
}

class FxBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function describeRound(round) {
  const chargeCents = round.preview ? 0 : (round.chargeCents ?? round.stakeCents);
  const payoutCents = round.payoutCents;
  if (
    !Number.isSafeInteger(chargeCents) || chargeCents < 0 ||
    !Number.isSafeInteger(payoutCents) || payoutCents < 0
  ) throw new Error("PayoutScene requires non-negative integer cents.");

  const netCents = payoutCents - chargeCents;
  const positive = !round.preview && netCents > 0;
  const ratio = chargeCents > 0 ? netCents / chargeCents : 0;
  const tier = positive ? ratio >= 20 ? 4 : ratio >= 5 ? 3 : ratio >= 1 ? 2 : 1 : 0;
  const celebrated = !round.preview && payoutCents > 0;
  const fxTier = celebrated ? Math.max(1, tier) : 0;
  const durationMs = payoutCents === 0 ? 2400 : [2600, 2600, 3400, 4100, 4800][tier];

  return {
    chargeCents, payoutCents, netCents, positive, celebrated, tier, fxTier, durationMs,
    title: round.preview ? "Просмотр бонуса"
      : payoutCents === 0 ? "Раунд завершён"
        : tier >= 4 ? "SUPER WIN" : tier >= 3 ? "MEGA WIN" : tier >= 2 ? "BIG WIN" : "Поздравляем!",
    tone: positive ? "profit" : payoutCents > 0 ? "receipt" : "loss",
  };
}

// This component only presents a settled result.
// It never calls HallSession.begin/complete and never changes the balance.
export default function PayoutScene({
  round, onClose, audio, reducedMotion = false, currency = "АР",
}) {
  const facts = useMemo(() => describeRound(round), [round]);
  const reduced = useReducedMotion(reducedMotion);
  const dialogRef = useRef(null);
  const continueRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closedRef = useRef(false);
  const clockRef = useRef({ elapsed: 0, counted: false });
  const [frame, setFrame] = useState({
    elapsed: 0, amount: reduced ? facts.payoutCents : 0, counted: reduced,
  });
  onCloseRef.current = onClose;

  const key = [round.id, facts.chargeCents, facts.payoutCents, Boolean(round.preview)].join(":");
  const durationMs = reduced ? 2400 : facts.durationMs;
  const countMs = reduced ? 0 : Math.round(durationMs * 0.66);
  const titleId = "payout-title-" + String(round.id).replace(/[^a-z0-9_-]/gi, "");
  const descriptionId = titleId + "-description";

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    audio?.stopPayout();
    onCloseRef.current?.();
  }, [audio]);

  const reveal = useCallback(() => {
    if (closedRef.current) return;
    if (!clockRef.current.counted) {
      clockRef.current.elapsed = Math.max(clockRef.current.elapsed, countMs);
      clockRef.current.counted = true;
      setFrame({
        elapsed: clockRef.current.elapsed,
        amount: facts.payoutCents,
        counted: true,
      });
      if (facts.payoutCents > 0) {
        audio?.finishCountup({ tier: facts.fxTier, positive: facts.celebrated });
      }
    } else {
      close();
    }
  }, [audio, close, countMs, facts.payoutCents, facts.celebrated, facts.fxTier]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    closedRef.current = false;
    clockRef.current = { elapsed: 0, counted: reduced };
    setFrame({
      elapsed: 0,
      amount: reduced ? facts.payoutCents : 0,
      counted: reduced,
    });

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    continueRef.current?.focus({ preventScroll: true });

    if (facts.payoutCents > 0) {
      audio?.play(facts.celebrated ? "celebrate" : "payout", { tier: facts.fxTier, positive: facts.celebrated });
      if (!reduced) {
        audio?.beginCountup({
          durationMs: countMs, tier: facts.fxTier, positive: facts.celebrated,
        });
      }
    } else {
      audio?.play("loss");
    }

    let raf;
    let previousTime = performance.now();
    const tick = (now) => {
      if (closedRef.current) return;
      const delta = Math.min(100, Math.max(0, now - previousTime));
      previousTime = now;
      if (!document.hidden) {
        const clock = clockRef.current;
        clock.elapsed = Math.min(durationMs, clock.elapsed + delta);
        const progress = countMs === 0 ? 1 : Math.min(1, clock.elapsed / countMs);
        const eased = 1 - (1 - progress) ** 3;
        if (progress >= 1 && !clock.counted) {
          clock.counted = true;
          if (facts.payoutCents > 0) {
            audio?.finishCountup({ tier: facts.fxTier, positive: facts.celebrated });
          }
        }
        if (!reduced) {
          setFrame({
            elapsed: clock.elapsed,
            amount: Math.round(facts.payoutCents * eased),
            counted: clock.counted,
          });
        }
        if (clock.elapsed >= durationMs) {
          close();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const resetClock = () => { previousTime = performance.now(); };
    const keyboard = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "Tab") {
        const controls = Array.from(dialog.querySelectorAll("button:not(:disabled), [tabindex='0']"));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !event.target.closest("button")) {
        event.preventDefault();
        reveal();
      }
    };

    document.addEventListener("visibilitychange", resetClock);
    dialog.addEventListener("keydown", keyboard);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", resetClock);
      dialog.removeEventListener("keydown", keyboard);
      // Cancels both count-loop and transient chord sources on StrictMode cleanup.
      audio?.stopPayout();
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        !previousFocus.matches(":disabled")
      ) previousFocus.focus({ preventScroll: true });
    };
    // Monetary facts are represented by key. Parent onClose identity is kept in a ref.
  }, [key, reduced, audio, close, reveal, countMs, durationMs]);

  return (
    <dialog
      ref={dialogRef}
      className="payout-dialog payout-overlay"
      data-game={round.game}
      data-tone={facts.tone}
      data-tier={facts.fxTier}
      data-reduced={reduced}
      data-celebrate={facts.celebrated}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (!event.target.closest("button")) reveal(); }}
    >
      {!reduced && facts.fxTier > 0 && <div className="win-spectacle" aria-hidden="true"><i className="win-flash"/><div className="win-rays"/>{Array.from({length:18},(_,i)=><img key={i} className="win-flying-coin" src="/coinflip-heads-painted.png" alt="" style={{'--coin-x':(i*37%100)+'%','--coin-delay':(i%6)*.075+'s','--coin-rotation':(i*47)+'deg','--coin-duration':(1.4+i%4*.22)+'s'}}/>)}</div>}
      {!reduced && facts.fxTier > 0 && (
        <div className="payout-fx" aria-hidden="true">
          <FxBoundary>
            <Suspense fallback={null}>
              <PayoutFx tier={facts.fxTier} elapsed={frame.elapsed} />
            </Suspense>
          </FxBoundary>
        </div>
      )}
      <button type="button" className="payout-dismiss" onClick={close} aria-label="Закрыть результат">
        ×
      </button>
      <div className="payout-sheet">
        <img className="payout-mask-art payout-emblem" alt="" src={import.meta.env.BASE_URL + ({slots:"bonanza-anonymous-emblem.png",maskhouse:"maskhouse-cover.png",lecipher:"lecipher-cover.png",coinflip:"coinflip-crest.png",dice:"dice-crest.png",plinko:"plinko-crest.png",roulette:"roulette-minimal.png",blackjack:"blackjack-minimal.png",upgrader:"upgrader-ink.png"}[round.game] || "bonanza-anonymous-emblem.png")} />
        <p className="payout-game">
          {names[round.game] || round.game}{round.preview ? " · просмотр" : ""}
        </p>
        <h2 id={titleId} className="payout-title">{facts.title}</h2>
        {facts.celebrated && <span className="win-award-caption">Ваша выплата</span>}
        <div className="payout-amount" aria-hidden="true">
          <span>{formatCents(frame.amount)}</span>
          <span className="payout-currency">{currency}</span>
        </div>
        <span className="payout-sr-only">
          Выплата: {formatCents(facts.payoutCents)} {currency}.
        </span>
        <p id={descriptionId} className="payout-description">
          {round.preview ? "Демонстрационный результат. Баланс не изменился."
            : facts.payoutCents > 0 ? "Выплата зачислена на баланс." : "Раунд завершён."}
        </p>
        <button ref={continueRef} type="button" className="payout-continue" onClick={close}>
          Продолжить
        </button>
        <p className="payout-hint">
          {frame.counted ? ""
            : "Нажмите на сумму, чтобы пропустить подсчёт"}
          <span>Esc — закрыть</span>
        </p>
      </div>
    </dialog>
  );
}

