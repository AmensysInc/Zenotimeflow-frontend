# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/cb3b24aa-740c-4e47-aa9f-dc8302d6fef0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cb3b24aa-740c-4e47-aa9f-dc8302d6fef0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Mobile app (React Native / Expo)

The **mobile/** folder is the Zeno Time Flow native app (clock-in, dashboard, calendar, tasks, focus, habits, profile). Same backend as the web.

```sh
cd mobile
npm install
npx expo start
```

See **mobile/README.md** for API URL setup and features.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Configuration

### Backend Setup

This project now uses a Django backend instead of Supabase. See the `zeno-time-backend/` directory for the backend implementation.

**Backend Setup:**
1. Navigate to `zeno-time-backend/` directory
2. Follow the setup instructions in `zeno-time-backend/SETUP_INSTRUCTIONS.md`
3. Start the Django server: `python manage.py runserver`

### Frontend Environment Variables

1. Create a `.env.local` file in the root directory
2. Add your API URL:

```env
VITE_API_URL=http://localhost:8000/api
```

**Note:** The Supabase integration has been removed. The frontend now uses the Django REST API backend.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Backend & Database)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cb3b24aa-740c-4e47-aa9f-dc8302d6fef0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
