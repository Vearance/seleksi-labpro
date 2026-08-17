import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface MenuAction {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

interface PopCoords {
  top: number;
  right: number;
  openUp: boolean;
}

/**
 * Small "three dots" row-action menu. Closes on outside click, scroll, and
 * resize. The popup is positioned `fixed` against the viewport because table
 * cells clip absolutely-positioned children (`td { overflow: hidden }`).
 */
export default function RowMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopCoords | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: Event) {
      if (event instanceof MouseEvent && ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    // keep the fixed popup anchored: close on any scroll/resize
    window.addEventListener("scroll", onOutside, true);
    window.addEventListener("resize", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onOutside, true);
      window.removeEventListener("resize", onOutside);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const buttonEl = ref.current?.querySelector("button");
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      // flip above the button when the menu would overflow the viewport
      const openUp = rect.bottom + 200 > window.innerHeight;
      setCoords({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
        openUp,
      });
    }
    setOpen(true);
  }

  return (
    <div className="menu" ref={ref}>
      <button
        className="icon-btn"
        aria-label="Actions"
        onClick={toggle}
      >
        <MoreVertical size={16} />
      </button>
      {open && coords && (
        <div
          className="menu-pop"
          style={{
            top: coords.top,
            right: coords.right,
            transform: coords.openUp ? "translateY(-100%)" : undefined,
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              className={action.danger ? "menu-item menu-item-danger" : "menu-item"}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
