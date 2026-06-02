import type { Config } from 'tailwindcss'

// shadcn-vue 표준 + 디자인 토큰 (07-design-decisions.md §9 색상)
// + plan/24 Sprint A 적용 (Status semantic / Elevation tier 3 / Z-index 6 layer)
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,vue}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Status semantic (plan/24 Sprint A-3)
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        // Sprint c35 plan/28 옵션 C — 도메인 semantic colors (light/dark 자동 분기).
        // 사용 의도: text-emerald-500 → text-diff-add, text-violet-500 → text-ai-violet 등.
        // light 에서 진한 채도 (가독성 ↑), dark 에서 밝은 채도 (눈 부담 ↓).
        // Sprint c37 — `<alpha-value>` placeholder 추가로 `text-diff-add/80` 같은 alpha modifier 호환.
        'diff-add': 'hsl(var(--diff-add) / <alpha-value>)',
        'diff-delete': 'hsl(var(--diff-delete) / <alpha-value>)',
        'diff-rename': 'hsl(var(--diff-rename) / <alpha-value>)',
        'ai-violet': 'hsl(var(--ai-violet) / <alpha-value>)',
        'warning-amber': 'hsl(var(--warning-amber) / <alpha-value>)',
        'danger-rose': 'hsl(var(--danger-rose) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Elevation tier 4 (plan/24 Sprint A-4 → plan #44 A3: tooltip 추가)
        tooltip: 'var(--shadow-tooltip)',
        popover: 'var(--shadow-popover)',
        modal: 'var(--shadow-modal)',
        toast: 'var(--shadow-toast)',
      },
      zIndex: {
        // Layer 6 (plan/24 Sprint A-5)
        // 10 sticky header (SyncBar)
        // 20 sidebar overlay (future mobile)
        // 30 popover / dropdown / tooltip
        // 40 modal backdrop
        // 50 modal content
        // 60 toast (최상단)
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        '60': '60',
      },
      fontFamily: {
        // 2026-06-02 — Pretendard Variable 를 라틴+한글 통합 primary 로 (한글 폰트 전면 Pretendard 기본).
        // Pretendard 가 Latin/Korean cover → Roboto Flex + Noto Sans KR 제거.
        // 일본어 (Noto Sans CJK JP / Hiragino) / 중국어 간체 (SC / PingFang) / 번체 (TC) 는
        // bundled 안 함 (수 MB 부담) — OS system fallback 의존.
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '"Noto Sans CJK JP"',
          '"Hiragino Sans"',
          '"Yu Gothic"',
          '"Meiryo"',
          '"Noto Sans CJK SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK TC"',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'D2Coding',
          'Cascadia Code',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
