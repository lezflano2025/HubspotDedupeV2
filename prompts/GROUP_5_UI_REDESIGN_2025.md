# Claude Code Prompt: Group 5 - 2025 UI Redesign

## 🎯 Objective

Modernize the HubSpot Dedupe Tool's UI with a **2025-focused design language** that is:
- **Clean & Minimal** - Reduced visual noise, generous whitespace
- **Tech-Forward** - Monospace accents, terminal aesthetics, developer-friendly
- **Dark Mode First** - Optimized for dark theme with elegant light mode fallback
- **Glassmorphism & Depth** - Subtle blur effects, layered surfaces
- **Micro-interactions** - Smooth transitions, hover states, loading animations

This assumes all previous improvements have been merged:
- ✅ Phone/domain normalization (Group 1)
- ✅ Retry with exponential backoff (Group 2)
- ✅ Dry-run mode for merges (Group 3)
- ✅ CSV export & real-time progress (Group 4)

---

## 📁 Files to Modify

| File | Purpose |
|------|---------|
| `src/renderer/index.css` | Global styles, CSS variables, animations |
| `tailwind.config.cjs` | Extended theme with 2025 design tokens |
| `src/renderer/components/Button.tsx` | Modern button variants |
| `src/renderer/components/Card.tsx` | Glassmorphism cards |
| `src/renderer/components/Badge.tsx` | Refined status badges |
| `src/renderer/components/Input.tsx` | Modern input fields |
| `src/renderer/components/ProgressBar.tsx` | NEW: Animated progress component |
| `src/renderer/components/Tooltip.tsx` | NEW: Modern tooltip system |
| `src/renderer/components/Modal.tsx` | NEW: Glassmorphism modals |
| `src/renderer/components/StatusIndicator.tsx` | NEW: Connection/sync status |
| `src/renderer/pages/ConnectPage.tsx` | Redesigned auth flow |
| `src/renderer/pages/ResultsPage.tsx` | Complete dashboard overhaul |
| `src/renderer/components/ComparisonView.tsx` | Modern comparison UI |

---

## 🎨 Design System: 2025 Aesthetic

### Color Palette

```css
/* tailwind.config.cjs - Extended colors */
colors: {
  // Primary: Electric Indigo
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',  /* Main */
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Accent: Cyber Teal
  accent: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',  /* Main */
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  // Surfaces: Dark mode optimized
  surface: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    800: '#18181b',
    900: '#0f0f10',
    950: '#09090b',
  },
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
}
```

### Typography

```css
/* index.css */
:root {
  /* Display font for headers */
  --font-display: 'Inter', system-ui, sans-serif;

  /* Monospace for data, IDs, technical info */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

  /* Base sizing */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
}

/* Add JetBrains Mono from Google Fonts in index.html or import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Glassmorphism & Depth

```css
/* index.css - Glassmorphism utilities */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.surface-elevated {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.surface-inset {
  box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.1);
}

/* Gradient mesh background */
.mesh-gradient {
  background:
    radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(20, 184, 166, 0.1) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.1) 0px, transparent 50%);
}
```

### Animation System

```css
/* index.css - Micro-interactions */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.4s ease-out;
}

.animate-pulse-glow {
  animation: pulse-glow 2s infinite;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## 🔧 Component Implementations

### 1. Modern Button

```typescript
// src/renderer/components/Button.tsx
import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    relative inline-flex items-center justify-center gap-2
    font-medium transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    focus-visible:ring-offset-surface-900 focus-visible:ring-primary-500
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-primary-600 to-primary-500
      hover:from-primary-500 hover:to-primary-400
      text-white shadow-lg shadow-primary-500/25
      hover:shadow-xl hover:shadow-primary-500/30
    `,
    secondary: `
      bg-surface-800 border border-surface-700
      hover:bg-surface-700 hover:border-surface-600
      text-gray-100
    `,
    ghost: `
      bg-transparent hover:bg-white/5
      text-gray-300 hover:text-white
    `,
    danger: `
      bg-gradient-to-r from-red-600 to-red-500
      hover:from-red-500 hover:to-red-400
      text-white shadow-lg shadow-red-500/25
    `,
    success: `
      bg-gradient-to-r from-emerald-600 to-emerald-500
      hover:from-emerald-500 hover:to-emerald-400
      text-white shadow-lg shadow-emerald-500/25
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
}
```

### 2. Glassmorphism Card

```typescript
// src/renderer/components/Card.tsx
import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className,
  variant = 'default',
  padding = 'md'
}: CardProps) {
  const variants = {
    default: 'bg-surface-900 border border-surface-800',
    glass: 'glass',
    elevated: 'bg-surface-900 surface-elevated',
    bordered: 'bg-transparent border-2 border-dashed border-surface-700',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'rounded-2xl transition-all duration-200',
        variants[variant],
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('pb-4 mb-4 border-b border-surface-800', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={clsx('text-lg font-semibold text-white', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-400 mt-1">{children}</p>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('pt-4 mt-4 border-t border-surface-800 flex items-center justify-end gap-3', className)}>
      {children}
    </div>
  );
}
```

### 3. Status Badge

```typescript
// src/renderer/components/Badge.tsx
import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'premium';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  className
}: BadgeProps) {
  const variants = {
    default: 'bg-surface-800 text-gray-300 border-surface-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    premium: 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-primary-300 border-primary-500/30',
  };

  const dotColors = {
    default: 'bg-gray-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    premium: 'bg-primary-400',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full',
          dotColors[variant],
          pulse && 'animate-pulse'
        )} />
      )}
      {children}
    </span>
  );
}
```

### 4. Animated Progress Bar (New)

```typescript
// src/renderer/components/ProgressBar.tsx
import React from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default',
  size = 'md',
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barVariants = {
    default: 'bg-primary-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    gradient: 'bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 bg-[length:200%_100%]',
  };

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-300">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-mono text-gray-400">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={clsx(
        'w-full rounded-full bg-surface-800 overflow-hidden',
        heights[size]
      )}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            barVariants[variant],
            animated && variant === 'gradient' && 'animate-shimmer'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

### 5. Modern Input

```typescript
// src/renderer/components/Input.tsx
import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  error,
  icon,
  iconPosition = 'left',
  className,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full px-4 py-3 rounded-xl',
            'bg-surface-800 border border-surface-700',
            'text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
            'transition-all duration-200',
            'font-mono text-sm',
            icon && iconPosition === 'left' && 'pl-10',
            icon && iconPosition === 'right' && 'pr-10',
            error && 'border-red-500 focus:ring-red-500/50 focus:border-red-500',
            className
          )}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}
      </div>
      {(helperText || error) && (
        <p className={clsx(
          'mt-2 text-sm',
          error ? 'text-red-400' : 'text-gray-500'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
```

### 6. Status Indicator (New)

```typescript
// src/renderer/components/StatusIndicator.tsx
import React from 'react';
import { clsx } from 'clsx';

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  label?: string;
  showPulse?: boolean;
}

export function StatusIndicator({ status, label, showPulse = true }: StatusIndicatorProps) {
  const statusConfig = {
    connected: {
      color: 'bg-emerald-500',
      text: 'Connected',
      textColor: 'text-emerald-400',
    },
    disconnected: {
      color: 'bg-gray-500',
      text: 'Disconnected',
      textColor: 'text-gray-400',
    },
    syncing: {
      color: 'bg-amber-500',
      text: 'Syncing...',
      textColor: 'text-amber-400',
    },
    error: {
      color: 'bg-red-500',
      text: 'Error',
      textColor: 'text-red-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {showPulse && status === 'connected' && (
          <span className={clsx(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            config.color
          )} />
        )}
        <span className={clsx(
          'relative inline-flex rounded-full h-2.5 w-2.5',
          config.color
        )} />
      </span>
      <span className={clsx('text-sm font-medium', config.textColor)}>
        {label || config.text}
      </span>
    </div>
  );
}
```

---

## 🖥️ Page Redesigns

### ConnectPage - Auth Flow

```typescript
// Key design elements for ConnectPage:
// 1. Centered card with glassmorphism
// 2. Animated gradient background
// 3. Terminal-style API key input
// 4. Step indicator for setup process

<div className="min-h-screen bg-surface-950 mesh-gradient flex items-center justify-center p-4">
  {/* Ambient glow effects */}
  <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
  <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />

  <Card variant="glass" className="max-w-md w-full animate-fade-in relative z-10">
    {/* Logo/Icon */}
    <div className="flex justify-center mb-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
        <svg className="w-8 h-8 text-white" /* HubSpot or dedupe icon */ />
      </div>
    </div>

    {/* Title */}
    <h1 className="text-2xl font-bold text-center text-white mb-2">
      HubSpot Deduplicator
    </h1>
    <p className="text-center text-gray-400 mb-8">
      Connect your HubSpot account to get started
    </p>

    {/* API Key Input with terminal aesthetic */}
    <Input
      type="password"
      label="Private App Token"
      placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx"
      icon={<KeyIcon />}
      className="font-mono"
    />

    <Button variant="primary" className="w-full mt-6">
      <span>Connect to HubSpot</span>
      <ArrowRightIcon />
    </Button>
  </Card>
</div>
```

### ResultsPage - Dashboard

```typescript
// Key design elements for ResultsPage:
// 1. Sidebar navigation (optional) or top nav
// 2. Stats cards with live data
// 3. Modern table/list for duplicate groups
// 4. Command palette style (⌘K) for actions

// Top Stats Bar
<div className="grid grid-cols-4 gap-4 mb-8">
  <Card variant="glass" padding="sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">Total Records</p>
        <p className="text-2xl font-bold text-white font-mono">12,847</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
        <UsersIcon className="w-5 h-5 text-primary-400" />
      </div>
    </div>
  </Card>
  {/* Similar cards for Duplicates Found, Merged, Pending Review */}
</div>

// Action Bar
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-4">
    {/* Object type tabs */}
    <div className="flex bg-surface-800 rounded-xl p-1">
      <button className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium">
        Contacts
      </button>
      <button className="px-4 py-2 rounded-lg text-gray-400 text-sm font-medium hover:text-white">
        Companies
      </button>
    </div>

    {/* Dry-run toggle */}
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700">
      <span className="text-sm text-gray-400">Dry Run</span>
      <Switch checked={dryRunMode} onChange={setDryRunMode} />
    </div>
  </div>

  <div className="flex items-center gap-3">
    <Button variant="ghost" icon={<DownloadIcon />}>Export CSV</Button>
    <Button variant="secondary">Import Data</Button>
    <Button variant="primary" icon={<SparklesIcon />}>Run Analysis</Button>
  </div>
</div>

// Duplicate Groups List
<Card variant="default" padding="none">
  <div className="divide-y divide-surface-800">
    {groups.map(group => (
      <div
        key={group.id}
        className="p-4 hover:bg-surface-800/50 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Confidence indicator */}
            <div className={clsx(
              'w-1 h-12 rounded-full',
              group.confidence === 'high' && 'bg-emerald-500',
              group.confidence === 'medium' && 'bg-amber-500',
              group.confidence === 'low' && 'bg-red-500',
            )} />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{group.displayName}</span>
                <Badge variant={group.confidence} size="sm">
                  {group.similarityScore}% match
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="font-mono">{group.records.length} records</span>
                <span>•</span>
                <span>Matched on: {group.matchedFields.join(', ')}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Review →
          </Button>
        </div>
      </div>
    ))}
  </div>
</Card>
```

---

## ✅ Acceptance Criteria

### Visual Design
- [ ] Dark mode is the default and primary theme
- [ ] Glassmorphism effects work on all cards/modals
- [ ] Gradient backgrounds render correctly
- [ ] Animations are smooth (60fps)
- [ ] Typography uses Inter + JetBrains Mono

### Components
- [ ] All existing components refactored
- [ ] New ProgressBar component created
- [ ] New StatusIndicator component created
- [ ] Hover states and transitions work
- [ ] Loading states are animated

### Pages
- [ ] ConnectPage has modern auth flow
- [ ] ResultsPage has dashboard layout
- [ ] ComparisonView modernized
- [ ] All new features (dry-run, export, progress) integrated

### Accessibility
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA
- [ ] Interactive elements have hover/active states
- [ ] Screen reader friendly

### Performance
- [ ] No layout shift on load
- [ ] Animations use GPU acceleration
- [ ] Lazy load heavy components

---

## 🧪 Testing Checklist

1. **Dark Mode**: Verify all components look correct
2. **Light Mode**: Toggle and verify fallback styles
3. **Animations**: Check for smooth 60fps transitions
4. **Responsiveness**: Test on different screen sizes
5. **Glassmorphism**: Verify backdrop-filter works
6. **Typography**: Confirm fonts load correctly
7. **Accessibility**: Tab through all interactive elements

---

## 📝 Design Philosophy Notes

### 2025 Design Trends Applied:
1. **Neomorphism → Glassmorphism** - Softer, more ethereal surfaces
2. **Monospace as Accent** - Technical credibility, developer-friendly
3. **Gradient Mesh Backgrounds** - Depth without complexity
4. **Micro-interactions** - Every interaction feels responsive
5. **Reduced Chrome** - Minimal borders, shadow-based hierarchy
6. **Dark Mode First** - Easier on eyes, more premium feel

### Technical Aesthetic:
- HubSpot IDs shown in monospace font
- Terminal-style API key input
- Code-like status indicators (connected, syncing)
- Clean data tables with technical precision

---

## 🚀 When Done

1. Run `npm run build` to verify no errors
2. Test in both dark and light mode
3. Verify all existing functionality works
4. Check animations on lower-end hardware
5. Commit with message: `feat(ui): modernize design with 2025 aesthetic - glassmorphism, gradients, and micro-interactions`
