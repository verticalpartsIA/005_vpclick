
import React from 'react';
import { TaskPriority } from './types';

export const COLORS = {
  primary: '#ffce05',
  graphite: '#2c3e50',
  lightGray: '#f3f4f6',
  white: '#ffffff',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.BAIXA]: 'bg-slate-100 text-slate-500',
  [TaskPriority.MEDIA]: 'bg-cyan-100 text-cyan-600',
  [TaskPriority.ALTA]: 'bg-orange-100 text-orange-600',
  [TaskPriority.URGENTE]: 'bg-red-100 text-red-600',
};

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

export const Icons = {
  Home: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
  ),
  Check: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Folder: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  List: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
  ),
  Calendar: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  Plus: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
  ),
  ChevronRight: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
  ),
  Clock: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Users: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  ),
  Chart: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  Paperclip: ({ className = "w-5 h-5", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" /></svg>
  ),
  Trash: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
  ),
  Eye: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1.933 12.5C3.9 7.943 7.7 5 12 5c4.3 0 8.1 2.943 10.067 7.5-1.967 4.557-5.767 7.5-10.067 7.5-4.3 0-8.1-2.943-10.067-7.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  ),
  EyeOff: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.477 10.49A3 3 0 0 0 13.5 13.5M9.88 5.293A10.735 10.735 0 0 1 12 5c4.3 0 8.1 2.943 10.067 7.5a13.186 13.186 0 0 1-3.168 4.421M6.228 6.234C4.343 7.451 2.85 9.481 1.933 12.5c1.967 4.557 5.767 7.5 10.067 7.5 1.52 0 2.978-.367 4.312-1.044" />
    </svg>
  ),
  Document: ({ className = "w-8 h-8", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
  ),
  ChevronUp: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
  ),
  ChevronDown: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  ),
  ImageIcon: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} /><circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} /><polyline points="21 15 16 10 5 21" strokeWidth={2} /></svg>
  ),
  LinkIcon: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeWidth={2} /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeWidth={2} /></svg>
  ),
  FileText: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth={2} /><polyline points="14 2 14 8 20 8" strokeWidth={2} /><line x1="16" y1="13" x2="8" y2="13" strokeWidth={2} /><line x1="16" y1="17" x2="8" y2="17" strokeWidth={2} /><polyline points="10 9 9 9 8 9" strokeWidth={2} /></svg>
  ),
  CircleDashed: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path d="M10.1 2.182a10 10 0 0 1 3.8 0" strokeWidth={2} /><path d="M13.9 2.182a10 10 0 0 1 3.818 3.818" strokeWidth={2} /><path d="M17.718 5.9a10 10 0 0 1 2.1 3.8" strokeWidth={2} /><path d="M19.818 9.7a10 10 0 0 1 0 3.8" strokeWidth={2} /><path d="M19.818 13.5a10 10 0 0 1-2.1 3.818" strokeWidth={2} /><path d="M17.718 17.3a10 10 0 0 1-3.818 2.1" strokeWidth={2} /><path d="M13.9 19.4a10 10 0 0 1-3.8 0" strokeWidth={2} /><path d="M10.1 19.4a10 10 0 0 1-3.818-2.1" strokeWidth={2} /><path d="M6.282 17.3a10 10 0 0 1-2.1-3.818" strokeWidth={2} /><path d="M4.182 13.5a10 10 0 0 1 0-3.8" strokeWidth={2} /><path d="M4.182 9.7a10 10 0 0 1 2.1-3.818" strokeWidth={2} /><path d="M6.282 5.9a10 10 0 0 1 3.818-2.1" strokeWidth={2} /></svg>
  ),
  Timer: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><line x1="10" y1="2" x2="14" y2="2" strokeWidth={2} /><line x1="12" y1="14" x2="15" y2="11" strokeWidth={2} /><circle cx="12" cy="14" r="8" strokeWidth={2} /></svg>
  ),
  CheckCircle2: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeWidth={2} /><path d="m9 12 2 2 4-4" strokeWidth={2} /></svg>
  ),
  Grip: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
  ),
  Edit: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
  ),
  Settings: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  Search: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  Anchor: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /><circle cx="12" cy="5" r="3" /></svg>
  ),
  ShoppingBag: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
  ),
  Briefcase: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg>
  ),
  Cpu: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><path d="m9 9 3 3-3 3" /><path d="m15 9-3 3 3 3" /><path d="M2 9h2" /><path d="M2 15h2" /><path d="M20 9h2" /><path d="M20 15h2" /><path d="M9 2v2" /><path d="M15 2v2" /><path d="M9 20v2" /><path d="M15 20v2" /></svg>
  ),
  Monitor: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>
  ),
  Smartphone: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
  ),
  Printer: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" /><rect width="12" height="8" x="6" y="14" rx="1" /></svg>
  ),
  Mouse: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="12" height="18" x="6" y="3" rx="6" /><path d="M12 3v7" /></svg>
  ),
  Layout: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" /></svg>
  ),
  Target: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
  ),
  Heart: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
  ),
  Zap: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
  ),
  Activity: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
  ),
  Code: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
  ),
  Database: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></svg>
  ),
  Globe: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20" /><path d="M12 2a14.5 14.5 0 0 1 0 20" /><path d="M2 12h20" /><path d="M12 2a14.5 14.5 0 0 0 0 20" /><path d="M12 2a14.5 14.5 0 0 1 0 20" /></svg>
  ),
  Truck: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="13" x="2" y="8" rx="2" /><path d="M16 8h4.4a2 2 0 0 1 1.6 1.1L24 13" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
  ),
  ShoppingCart: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
  ),
  Star: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
  ),
  Bell: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  ),
  Columns: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
  ),
  GanttIcon: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="3" rx="1.5" /><rect x="2" y="10.5" width="9" height="3" rx="1.5" /><rect x="6" y="17" width="15" height="3" rx="1.5" /></svg>
  ),
  Shield: ({ className = "w-4 h-4", size, color = "currentColor", style, onClick }: IconProps) => (
    <svg className={className} width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" style={style} onClick={onClick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
  ),
};
