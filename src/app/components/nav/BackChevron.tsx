import { ChevronLeft } from "lucide-react";
import { NAV_COPY } from "../../lib/navCopy";
import { useBack } from "../../lib/useBack";
import { useBackChevronState } from "./BackChevronContext";

/**
 * The back control for every pushed page: a bare chevron, no text, in a 44px
 * round hit area. The shell (Root) draws it; pages never do. It sits in the
 * row PageShell reserves above the title, so no title moves, and on a hero page
 * it floats over the photo, below the safe area.
 *
 * `rail`: the page sits right of the left rail, so the row starts there too.
 * The container mirrors PageShell's own (same gutters, same top offset), is
 * transparent to the pointer, and only the button takes taps.
 */
export function BackChevron({ rail = false }: { rail?: boolean }) {
  const goBack = useBack();
  const variant = useBackChevronState();
  const onMedia = variant === "onMedia";
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 ${rail ? "rail:left-[72px] railwide:left-[240px]" : ""} px-4 pt-2 tab:px-6 desk:px-8 max-desk:pt-[calc(var(--safe-top)+0.5rem)]`}>
      <div className="mx-auto w-full max-w-[1040px]">
        <button
          type="button"
          onClick={goBack}
          aria-label={NAV_COPY.backLabel}
          data-back-chevron={variant}
          // 44px hit area. Plain: the 24px icon sits on the content edge, centred in the 24px row above the title. On media: the circle sits inside the photo's corner.
          className={`pointer-events-auto inline-flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ${onMedia ? "mt-1.5" : "-ml-2.5 -mt-0.5"}`}
        >
          {onMedia ? (
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-scrim-solid/40 text-on-media">
              <ChevronLeft className="size-6" strokeWidth={2} aria-hidden="true" />
            </span>
          ) : (
            <ChevronLeft className="size-6 text-foreground" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
