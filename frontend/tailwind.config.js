/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#0ea5e9", // Sky 500
                "background-light": "#f8fafc",
                "background-dark": "#0f172a",
                "status-active": "#22c55e",
                "status-break": "#3b82f6",
                "status-training": "#f59e0b",
                "status-inactive": "#94a3b8",
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
                display: ["Inter", "sans-serif"],
            },
        },
    },
    plugins: [],
}
