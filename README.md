# RollCall AI - College Attendance Tracker Foundation

Welcome to the foundation repository of **RollCall AI**, a modern, responsive college attendance tracker built with React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, and Supabase.

This repository serves as the project's foundation. It is configured for secure client-side routing, user authentication via Supabase, and dynamic layouts for both desktop and mobile views.

---

## Technical Stack

*   **Framework:** [React 19](https://react.dev/) + [Vite 8](https://vite.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Database & Auth:** [Supabase](https://supabase.com/)
*   **Routing:** [React Router v6](https://reactrouter.com/)
*   **Data Fetching:** [TanStack Query v5](https://tanstack.com/query)
*   **Styling:** [Tailwind CSS v3](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)

---

## Directory Structure

```text
src/
├── components/
│   └── ProtectedRoute.tsx      # Handles route guards for logged-in users
├── hooks/
│   └── useAuth.ts              # Custom hook subscribing to Supabase auth events
├── layouts/
│   └── DashboardLayout.tsx     # Shell with desktop sidebar, white topbar, and mobile drawer
├── lib/
│   └── supabase.ts             # Initialized Supabase client reading env keys
├── pages/
│   ├── ComingSoon.tsx          # Placeholder for secondary modules
│   ├── Dashboard.tsx           # Dashboard view with statistics and activities
│   └── Login.tsx               # Login page with validation and state handling
├── App.tsx                     # Main routing config & TanStack Query setup
└── main.tsx                    # React Entrypoint
```

---

## Getting Started Locally

### 1. Clone the repository and install dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy `.env.example` to create a `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Supabase project configuration (see below for setup instructions):
   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-project-anon-key
   ```

### 3. Run Development Server

```bash
npm run dev
```

The application will run locally at `http://localhost:5173`.

---

## Setup & Deployment Guide

Follow these step-by-step instructions to configure your database, publish your code, and host the live application.

### (a) Setting Up a Free Supabase Project

1. **Sign Up / Log In**: Go to [Supabase](https://supabase.com) and click **Sign Up** or **Sign In** (you can authenticate with GitHub).
2. **Create New Project**: Click the **New Project** button on your dashboard.
   * Select your **Organization**.
   * Enter a **Name** (e.g., `attendance-tracker`).
   * Enter a secure **Database Password** (keep this safe).
   * Choose the **Region** closest to your users.
   * Choose the **Free tier**.
   * Click **Create new project**. Wait 1–2 minutes for the database to provision.
3. **Retrieve Credentials**: Once the project is ready:
   * Go to **Project Settings** (gear icon in the bottom-left sidebar) -> **API**.
   * Find **Project URL** (under the `Project API keys` section). Copy this URL and paste it as `VITE_SUPABASE_URL` in your local `.env`.
   * Find the key labeled `anon` / `public`. Copy this long JWT string and paste it as `VITE_SUPABASE_ANON_KEY` in your local `.env`.
4. **Create a Test User**:
   * Navigate to **Authentication** (user icon in the left-hand menu).
   * Click **Users** -> **Add user** -> **Create user**.
   * Enter a test email (e.g., `test@college.edu`) and password.
   * Toggle off "Auto-confirm user" if you want to test email confirmation, OR keep it toggled **on** (recommended for local testing) to confirm the user immediately.
   * Click **Create user**. You can now log in using these credentials!

### (b) Setting Up GitHub & Pushing the Code

1. **Initialize Git**: If not already done, run the following in your local project root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: scaffold project and setup foundation"
   ```
2. **Create GitHub Repository**:
   * Go to [GitHub](https://github.com) and log in.
   * Click the **New** repository button.
   * Set the Repository Name (e.g., `attendance-tracker`).
   * Choose **Public** or **Private** (depending on your preference).
   * Leave "Add a README", "Add .gitignore", and "Choose a license" **unchecked** (since we already have them).
   * Click **Create repository**.
3. **Link & Push**: Copy the command group under "…or push an existing repository from the command line" and run them in your terminal:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/attendance-tracker.git
   git branch -M main
   git push -u origin main
   ```

### (c) Deploying to Vercel

1. **Sign Up / Log In**: Visit [Vercel](https://vercel.com) and log in (signing in with your GitHub account is recommended).
2. **Import Repository**:
   * Click **Add New** -> **Project**.
   * Find your `attendance-tracker` repository from the imported list and click **Import**.
3. **Configure Settings**:
   * Vercel will automatically detect that you are using Vite. The Build Command and Output Directory settings will auto-configure.
   * Expand the **Environment Variables** section.
   * Add the following two variables:
     * **Key:** `VITE_SUPABASE_URL` | **Value:** *(Paste your Supabase Project URL)*
     * **Key:** `VITE_SUPABASE_ANON_KEY` | **Value:** *(Paste your Supabase public anon key)*
   * Click **Add** for both.
4. **Deploy**: Click the **Deploy** button. Vercel will build and launch your application in less than a minute, providing you with a live URL (e.g., `https://attendance-tracker-xxx.vercel.app`).
