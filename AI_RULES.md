# AI Editor Rules & Technical Stack Guide

This document outlines the core technologies used in the Custom Websites Plus application and provides rules for library usage to ensure consistency, performance, and maintainability.

## 1. Core Technology Stack

1.  **Language:** TypeScript (Strictly enforced for all new files and components).
2.  **Framework:** React (Functional components and Hooks).
3.  **Routing:** React Router DOM (Used for all client-side navigation).
4.  **Styling:** Tailwind CSS (Utility-first approach for all styling).
5.  **UI Components:** Shadcn/ui (Preferred library for standard UI elements like buttons, inputs, and cards).
6.  **Icons:** Lucide React (The sole source for all icons).
7.  **AI Integration:** Google Gemini / `@google/genai` (Used for Luna AI and JetSuite analysis logic).
8.  **Build Tool:** Vite (Used for development and production bundling).
9.  **Architecture:** Component-based structure (`src/components`, `src/pages`, `src/tools`).
10. **Deployment:** Vercel (Optimized for serverless deployment).

## 2. Library Usage Rules

To maintain a clean and performant codebase, adhere to the following rules:

| Task / Feature | Required Library / Tool | Notes |
| :--- | :--- | :--- |
| **Styling** | Tailwind CSS | Use utility classes exclusively. Ensure designs are responsive by default. |
| **UI Elements** | Shadcn/ui | Use pre-built components (Button, Card, Input, Dialog, etc.) whenever possible. |
| **Icons** | Lucide React | Do not introduce other icon libraries. |
| **Navigation** | `react-router-dom` | Use `<Link>` for internal navigation and `useSearchParams` for URL state. |
| **AI/LLM Logic** | `@google/genai` | Used for all interactions with the Gemini API (Luna AI, content generation). |
| **Data Fetching** | Native `fetch` API | Use standard browser `fetch` within dedicated service files (e.g., `services/analyzer.ts`). |
| **State Management** | React Hooks (`useState`, `useReducer`) | Keep state management local and simple. Avoid external state libraries unless complexity demands it. |
| **Component Structure** | TypeScript (`.tsx`) | All new components must be created in their own file within `src/components` or `src/pages`. |