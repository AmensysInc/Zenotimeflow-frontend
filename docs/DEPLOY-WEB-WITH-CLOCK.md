# Deploying Web App with Clock In (React Native screens)

The **Clock In** flow (email + PIN login, time clock) is the React Native app built for web and served at `/clock` on the same domain.

## Build (single deploy)

From the **project root** (zeno-time-flow, not mobile):

```bash
npm run build:all
```

This will:

1. Build the main Vite web app → `dist/`
2. Build the Expo (React Native) web app → `mobile/dist-web/`
3. Copy `mobile/dist-web/` → `dist/clock/`

Your `dist/` folder then contains both the main app and the Clock In app at `/clock`.

## Deploy

- **Vercel**: Deploy the root; set **Output Directory** to `dist`. `vercel.json` rewrites `/clock` and `/clock/*` to the Clock In SPA.
- **Netlify**: Deploy the root; set **Publish directory** to `dist`. `netlify.toml` handles the same rewrites.
- **Other static hosts**: Serve `dist/` as the site root and add rules so `/clock` and `/clock/*` serve `dist/clock/index.html` (and static files under `dist/clock/` are served as files).

## Running locally (Clock In = React Native screens)

So that **Clock In** opens the **React Native** flow (email + PIN → employee screens), not the web form:

1. **Terminal 1 – main app**
   ```bash
   npx vite --port 6173
   ```
2. **Terminal 2 – Expo (React Native web)**
   ```bash
   cd mobile && npx expo start --web --port 8081
   ```

Then open **http://localhost:6173** and click **Clock In**. You use only 6173: the Clock In page and login stay on 6173/clock (no separate 8081 tab). Vite proxies `/clock`, `/_expo`, and `/index.bundle` to Expo on 8081 in the background. After sign-in you see the employee Clock In/Out screens on the same screen.

**If you see raw JSON (Expo manifest) instead of the Clock In screen:** the app on port 8081 must be **this project’s** mobile app. Stop any other Expo app (e.g. another project like Twilio) that might be using 8081, then from **zeno-time-flow** run: `cd mobile && npx expo start --web --port 8081`.

## Behaviour

- **Development**: "Clock In" goes to `/clock?intent=clockin` (same tab). With Expo running on 8081, that URL is proxied to the React Native app.
- **Production build**: "Clock In" goes to `/clock?intent=clockin` (same tab); deploy with `dist/clock` so the RN app is served at `/clock`.
- To use a **separate mobile URL**, set `VITE_MOBILE_APP_URL` in `.env` (e.g. `https://mobile.yourapp.com`); then Clock In opens in a new tab.

## Build scripts (reference)

| Script | Description |
|--------|-------------|
| `npm run build` | Main web app only |
| `npm run build:all` | Main app + Expo web, copied to `dist/clock` |
| `cd mobile && npm run build:web` | Expo web only → `mobile/dist-web` |
| `npm run build:clock` | Copy `mobile/dist-web` → `dist/clock` (run after both builds) |
