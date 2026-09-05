// Consistent line-weight icon set (stroke 1.8, no fills mixed in) used
// throughout the app instead of pulling in an icon-font dependency.
function Svg({ size = 20, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  )
}

export const HomeIcon = (p) => <Svg {...p}><path d="M4 11.5L12 4l8 7.5" /><path d="M6 10v9a1 1 0 001 1h3v-6h4v6h3a1 1 0 001-1v-9" /></Svg>
export const StatsIcon = (p) => <Svg {...p}><path d="M5 19V10M12 19V5M19 19v-7" /></Svg>
export const LogIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>
export const RoutinesIcon = (p) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9h8M8 13h5" /></Svg>
export const SettingsIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" /></Svg>
export const BackIcon = (p) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
export const ChevronRightIcon = (p) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
export const CalendarIcon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
export const CheckIcon = (p) => <Svg {...p}><path d="M5 13l4 4L19 7" /></Svg>
export const XIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const ClockIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Svg>
export const SearchIcon = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
export const TrashIcon = (p) => <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></Svg>
export const EditIcon = (p) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></Svg>
export const GripIcon = (p) => <Svg {...p}><circle cx="8" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="16" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="8" cy="18" r="1.3" fill="currentColor" stroke="none" /><circle cx="16" cy="18" r="1.3" fill="currentColor" stroke="none" /></Svg>
export const UploadIcon = (p) => <Svg {...p}><path d="M12 3v12M7 8l5-5 5 5" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></Svg>
export const DownloadIcon = (p) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></Svg>
export const ShareIcon = (p) => <Svg {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></Svg>
export const QuestionIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2 1.8-2.3 3" /><circle cx="12" cy="16.5" r=".3" fill="currentColor" /></Svg>
export const DotIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /></Svg>
