import { LANDING_COPY as COPY, type ExamplePick } from "./copy";

/**
 * An example ticket you can say yes to. Pure display: the stage that owns it
 * keeps the state. Nothing here is saved or sent anywhere.
 */
export function PickTicket({
  pick,
  swaps,
  torn,
  friend,
  badge,
  onGoing,
  onNah,
  onPlus,
  onUndo,
  inPanel = false,
}: {
  pick: ExamplePick;
  /** Counts picks shown so far; the text block replays its slide-in when it changes. */
  swaps: number;
  torn: boolean;
  friend: boolean;
  /** Shows the Good solo badge. Its space is kept when it is not shown. */
  badge: boolean;
  onGoing: () => void;
  onNah: () => void;
  onPlus: () => void;
  onUndo: () => void;
  inPanel?: boolean;
}) {
  const T = COPY.ticket;
  return (
    <article className={`lp-ticket ${inPanel ? "lp-ticket-panel" : ""} ${torn ? "is-torn" : ""}`}>
      <div className="lp-t-main">
        <div key={swaps} className={swaps > 0 ? "lp-t-info lp-swap" : "lp-t-info"}>
          <span className="lp-badge" style={badge ? undefined : { visibility: "hidden" }} aria-hidden={!badge}>
            {T.goodSolo}
          </span>
          {pick.kicker && <div className="lp-t-kicker">{pick.kicker}</div>}
          <h3 className="lp-t-title">{pick.title}</h3>
          <dl className="lp-t-meta">
            <dt>{T.when}</dt>
            <dd>{pick.when}</dd>
            <dt>{T.where}</dt>
            <dd>{pick.where}</dd>
            <dt>{T.cost}</dt>
            <dd>{pick.cost}</dd>
          </dl>
        </div>
        <div className="lp-t-actions">
          <button type="button" className="lp-t-yes" aria-pressed={torn} onClick={onGoing}>
            {torn ? T.gone : T.going}
          </button>
          {!torn && (
            <>
              <button type="button" onClick={onNah}>
                {T.nah}
              </button>
              <button type="button" aria-pressed={friend} onClick={onPlus}>
                {friend ? T.plusOn : T.plus}
              </button>
            </>
          )}
          {torn && (
            <button type="button" onClick={onUndo}>
              {T.undo}
            </button>
          )}
        </div>
      </div>
      <div className="lp-t-stub" aria-hidden="true">
        <span>{pick.day}</span>
        <b>{pick.time}</b>
        <span>{friend ? T.admitTwo : T.admitOne}</span>
      </div>
      {torn && <span className="lp-stamp">{T.stamp}</span>}
    </article>
  );
}
