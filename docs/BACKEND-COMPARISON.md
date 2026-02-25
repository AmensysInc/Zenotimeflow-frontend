# Backend: use zeno-time-backend only

The frontend calls `http://localhost:8085/api` (see `src/lib/api-client.ts`). Use **zeno-time-backend** as the single backend.

## zeno-time-backend includes

- **Auth:** login, employee-login (Clock In username/PIN), register, logout, user, users, profiles, user-roles. **Login and employee-login must accept the same identifier as `username` in the request body and resolve the user by username OR email** (e.g. `User.objects.get(Q(username=value) | Q(email=value))`) so that both username and email work for main login and Clock In.
- **send-welcome-email** stub: `POST /api/auth/send-welcome-email/`
- **Templates (Check Lists):** `GET/POST/PATCH/DELETE /api/templates/`, `GET/POST /api/templates/assignments/`, `DELETE /api/templates/assignments/?template_id=&user_id=`
- **Scheduler:** organizations, companies, employees, shifts, time-clock, schedule-templates, etc.
- **Other:** calendar, tasks, habits, focus

## Run the backend (only zeno-time-backend)

1. **Stop any other Django server** using port 8085 (e.g. close the terminal that runs `zeno_time_flow_backend` or press CTRL+BREAK there). The "no such table: organizations" error usually means the request is hitting the **other** backend (zeno_time_flow_backend), which may use a different database or have no migrations applied.

2. **Use only zeno-time-backend:**
   ```powershell
   cd C:\Users\vijay\Desktop\zeno-time-backend
   py manage.py migrate
   py manage.py runserver 0.0.0.0:8085
   ```

3. Open the frontend at http://localhost:6173 and sign in. If you still see errors, check the **browser Network tab**: the response may show a traceback. If the **Python path** in the traceback mentions `zeno_time_flow_backend`, the wrong backend is still running on 8085 — stop it and run only from `zeno-time-backend`.

**Clock In (employee login):** To see the React Native Clock In flow at http://localhost:6173/clock, run Expo as well: `cd mobile && npx expo start --web --port 8081`. See `docs/DEPLOY-WEB-WITH-CLOCK.md` for details.
