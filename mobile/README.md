# Zeno Time Flow – Mobile App

React Native (Expo) app in the same repo as the web app. Same backend API as the web (zenotimeflow.com / your Django API).

## Setup

```bash
cd mobile
npm install
```

## Run

```bash
npx expo start
```

Then press `a` for Android or `i` for iOS simulator, or scan the QR code with Expo Go.

## API URL

The app uses `http://localhost:8000/api` by default. On a physical device, use your machine’s IP so the phone can reach the backend:

1. Create `mobile/.env` (or set in app.json extra):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.XXX:8000/api
   ```
2. Or edit `mobile/src/api/config.ts` and set `API_BASE_URL` to your backend URL.

## Features

- **Login** – Employee sign-in (email + PIN), or **Face ID / Fingerprint** after first login.
- **Clock** – Clock in, clock out, start/end break; uses same time-clock API as web.
- **Dashboard** – Today’s and this week’s hours, today’s shift, upcoming shifts, tasks.
- **Calendar** – Events and shifts for the selected month.
- **Tasks** – List and toggle completion for tasks (from `/calendar/events/` with `event_type=task`).
- **Focus** – Start/end focus sessions; recent sessions list.
- **Habits** – List habits and mark today’s completions.
- **Profile** – Show user/employee info and sign out.

## Repo layout

- **Root** – Web app (Vite + React). Run with `npm run dev`.
- **mobile/** – This Expo app. Run with `cd mobile && npx expo start`.

Both use the same Django backend (same API base URL).

## Assets

If Expo complains about missing assets, add these under `mobile/assets/`:

- `icon.png` – app icon (e.g. 1024×1024)
- `splash-icon.png` – splash screen image
- `adaptive-icon.png` – Android adaptive icon (optional)

You can use placeholders until you have final artwork.
