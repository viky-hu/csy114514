"use client";

export type MainSidebarToggleButtonProps = {
  controlsId: string;
  isCollapsed: boolean;
  onToggle: () => void;
};

export function MainSidebarToggleButton({
  controlsId,
  isCollapsed,
  onToggle,
}: MainSidebarToggleButtonProps) {
  const label = isCollapsed ? "展开主导航" : "收起主导航";

  return (
    <button
      aria-controls={controlsId}
      aria-expanded={!isCollapsed}
      aria-label={label}
      className="main-sidebar-toggle-button"
      data-collapsed={isCollapsed}
      onClick={onToggle}
      title={label}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="main-sidebar-toggle-svg"
        focusable="false"
        viewBox="0 0 44 44"
      >
        <circle className="main-sidebar-toggle-ring" cx="22" cy="22" r="15.5" />
        <g className="main-sidebar-toggle-icon">
          <path d="m26 14-8 8 8 8" />
        </g>
      </svg>
    </button>
  );
}
