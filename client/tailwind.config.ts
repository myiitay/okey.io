import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
            },
            animation: {
                'bounce-horizontal': 'bounce-horizontal 1s infinite',
                'gradient-xy': 'gradient-xy 15s ease infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'color-pulse': 'color-pulse 0.5s infinite alternate',
            },
            keyframes: {
                'color-pulse': {
                    'from': { color: '#f87171' },
                    'to': { color: '#7f1d1d' },
                },
                'bounce-horizontal': {
                    '0%, 100%': { transform: 'translateX(-25%)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
                    '50%': { transform: 'none', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
                },
                'gradient-xy': {
                    '0%, 100%': { backgroundSize: '400% 400%', backgroundPosition: '0% 50%' },
                    '50%': { backgroundSize: '400% 400%', backgroundPosition: '100% 50%' },
                },
                'float': {
                    '0%': { transform: 'translate(0, 0) rotate(0deg)' },
                    '33%': { transform: 'translate(30px, -50px) rotate(10deg)' },
                    '66%': { transform: 'translate(-20px, 20px) rotate(-5deg)' },
                    '100%': { transform: 'translate(0, 0) rotate(0deg)' },
                },
                'float-soft': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
            },
            gridTemplateColumns: {
                '15': 'repeat(15, minmax(0, 1fr))',
            },
        },
    },
    plugins: [
        function ({ addUtilities }: any) {
            const newUtilities = {
                '.perspective-1000': {
                    perspective: '1000px',
                },
                '.preserve-3d': {
                    transformStyle: 'preserve-3d',
                },
                '.rotateX-5': {
                    transform: 'rotateX(5deg)',
                },
                '.rotateX-0': {
                    transform: 'rotateX(0deg)',
                },
                '.backface-hidden': {
                    backfaceVisibility: 'hidden',
                },
                '.rotate-y-180': {
                    transform: 'rotateY(180deg)',
                },
            }
            addUtilities(newUtilities)
        }
    ],
};

export default config;
