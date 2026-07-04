import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},

  			/* ===== Serene Navigator (DESIGN.md) ===== */
  			surface: '#FAF9F4',
  			'surface-dim': '#DBDAD5',
  			'surface-bright': '#FAF9F4',
  			'surface-container-lowest': '#FFFFFF',
  			'surface-container-low': '#F5F4EF',
  			'surface-container': '#EFEEE9',
  			'surface-container-high': '#E9E8E3',
  			'surface-container-highest': '#E3E2DE',
  			'surface-variant': '#E3E2DE',
  			'inverse-surface': '#30312E',
  			'inverse-on-surface': '#F2F1EC',
  			'on-surface': '#1B1C19',
  			'on-surface-variant': '#444840',
  			outline: '#74796F',
  			'outline-variant': '#C4C8BD',

  			'on-primary': '#FFFFFF',
  			'primary-container': '#B7D1A9',
  			'on-primary-container': '#445A3B',
  			'primary-fixed': '#D0EAC1',

  			'on-secondary': '#FFFFFF',
  			'secondary-container': '#C2EFA7',
  			'on-secondary-container': '#486E34',

  			tertiary: '#7B5264',
  			'on-tertiary': '#FFFFFF',
  			'tertiary-container': '#EFBBD0',
  			'on-tertiary-container': '#70485A',

  			error: '#BA1A1A',
  			'on-error': '#FFFFFF',
  			'error-container': '#FFDAD6',
  			'on-error-container': '#93000A',

  			/* Colores semánticos del negocio */
  			ink: '#0F172A',
  			'emerald-health': '#10B981',
  			'caution-amber': '#F59E0B',
  			'urgent-red': '#EF4444',
  			'slate-neutral': '#64748B'
  		},
  		fontFamily: {
  			sans: ['Inter', 'system-ui', 'sans-serif']
  		},
  		boxShadow: {
  			'level-1': '0 2px 4px rgba(15, 23, 42, 0.04)',
  			'level-2': '0 8px 16px rgba(15, 23, 42, 0.08)'
  		},
  		maxWidth: {
  			container: '1280px'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
