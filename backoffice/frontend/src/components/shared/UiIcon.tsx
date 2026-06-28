import type { CSSProperties } from 'react';

interface UiIconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
}

export default function UiIcon({ name, className = '', style }: UiIconProps) {
  const icons: Record<string, string> = {
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    arrowLeft: '<path d="M19 12H5" /><path d="m11 18-6-6 6-6" />',
    arrowRight: '<path d="M5 12h14" /><path d="m13 6 6 6-6 6" />',
    audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" />',
    bank: '<path d="m3 10 9-6 9 6" /><path d="M4 10h16" /><path d="M6 10v8" /><path d="M10 10v8" /><path d="M14 10v8" /><path d="M18 10v8" /><path d="M4 18h16" />',
    calendar: '<path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" />',
    check: '<path d="M20 6 9 17l-5-5" />',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />',
    list: '<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" />',
    target: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />',
    chevronDown: '<path d="m6 9 6 6 6-6" />',
    clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    close: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    clearSelection: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9l6 6" /><path d="m15 9-6 6" />',
    clipboard: '<path d="M9 5h6" /><path d="M9 3h6v4H9z" /><path d="M6 5H5v16h14V5h-1" /><path d="M9 13h6" /><path d="M9 17h4" />',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />',
    document: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />',
    download: '<path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" />',
    dots: '<circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />',
    filter: '<path d="M3 5h18" /><path d="M7 12h10" /><path d="M10 19h4" />',
    fileCheck: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /><path d="m9 15 2 2 4-5" />',
    edit: '<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />',
    home: '<path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M9.5 20v-6h5v6" />',
    headset: '<path d="M4 18v-5a8 8 0 0 1 16 0v5" /><path d="M4 17a3 3 0 0 0 3 3h1v-8H7a3 3 0 0 0-3 3Zm16 0a3 3 0 0 1-3 3h-1v-8h1a3 3 0 0 1 3 3Z" />',
    help: '<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M12 15v2" />',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />',
    monitor: '<rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 16v5" />',
    smartphone: '<rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 5h4" /><path d="M11 18h2" />',
    handshake: '<path d="m11 17 2 2a2 2 0 0 0 3-3l-3-3" /><path d="m14 14 2 2a2 2 0 0 0 3-3l-4-4" /><path d="m3 7 4-4 5 5-4 4z" /><path d="m21 7-4-4-5 5 4 4z" /><path d="m8 12 3-3a2 2 0 0 1 3 0" />',
    barChart: '<path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20V7" />',
    minus: '<path d="M5 12h14" />',
    note: '<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />',
    plus: '<path d="M12 5v14" /><path d="M5 12h14" />',
    percent: '<path d="m19 5-14 14" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" />',
    info: '<circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" />',
    phone: '<path d="M22 16.9v2.6a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.2 3.9 2 2 0 0 1 4.2 1.7h2.6a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.3a2 2 0 0 1-.4 2.1L7.8 9a16 16 0 0 0 7.2 7.2l1.2-1.2a2 2 0 0 1 2.1-.4c.7.3 1.5.5 2.3.6a2 2 0 0 1 1.7 2.1Z" />',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" />',
    flag: '<path d="M6 3v18" /><path d="M6 4h10l-1.5 3L16 10H6" />',
    cart: '<circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /><path d="M3 4h2l2.5 11h9.8l2-8H7" />',
    cube: '<path d="m12 2 8 4v12l-8 4-8-4V6l8-4Z" /><path d="M12 2v20" /><path d="M4 6l8 4 8-4" />',
    scale: '<path d="m16 16 3-7 3 7c-.9.7-1.9 1-3 1s-2.1-.3-3-1Z" /><path d="m2 16 3-7 3 7c-.9.7-1.9 1-3 1s-2.1-.3-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 9h18" />',
    selectAll: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 2.5 2.5L16 9" />',
    search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />',
    shieldX: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 9 6 6" /><path d="m15 9-6 6" />',
    sort: '<path d="M8 6h12" /><path d="M8 12h8" /><path d="M8 18h4" /><path d="m4 8 2-2 2 2" /><path d="m4 16 2 2 2-2" />',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />',
    trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" />',
    trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" />',
    trash: '<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" />',
    upload: '<path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" />',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
    wallet: '<path d="M4 7h16v12H4z" /><path d="M4 9l12-4h2v2" /><path d="M16 13h4" />',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />',
  };

  return (
    <svg
      className={`ui-icon ${className}`}
      style={style}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: (icons[name] || icons.document) as string }}
    />
  );
}
