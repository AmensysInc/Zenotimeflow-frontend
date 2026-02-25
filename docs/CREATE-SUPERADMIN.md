# Create super admin user

If login fails with "Invalid email or password", the user may not exist. Create it in the **Django backend** (not in this repo).

## Option 1: Try the script (uses register API)

With the backend running on port 8085:

```bash
npm run create-superadmin
# or with custom email/password:
node scripts/create-superadmin.mjs your@email.com YourPassword
```

Default credentials used by the script: `rama.k@amensys.com` / `Temp@12345`.

If the API returns 401/403 or 500, use Option 2.

## Option 2: Django createsuperuser (recommended)

1. Open a terminal in your **backend** project (e.g. `zeno_time_flow_backend`).
2. Run (use `py` on Windows if `python` is not found):

   ```bash
   py manage.py createsuperuser
   ```
   Or: `python manage.py createsuperuser` if `python` works on your system.

3. When prompted:
   - **Email:** `rama.k@amensys.com` (or use your custom user field if the model uses `username` instead)
   - **Password:** `Temp@12345`

4. If your backend uses **email as the login field**, and `createsuperuser` asks for "username", enter the email there, or create the user in the shell:

   ```bash
   py manage.py shell
   ```
   (Use `py` on Windows if `python` is not found.)

   Then (adjust to your `User` model and role system):

   ```python
   from django.contrib.auth import get_user_model
   User = get_user_model()
   # If your model uses email as USERNAME_FIELD:
   user = User.objects.create_superuser(email='rama.k@amensys.com', password='Temp@12345')
   user.save()
   # If you have a separate role (e.g. UserRole), assign super_admin to this user via your backend's role API or admin.
   ```

5. Restart the backend if needed, then sign in at http://localhost:6173/auth with the same email and password.

## Check if user exists

- From the **backend** Django shell:

  ```bash
  py manage.py shell
  >>> from django.contrib.auth import get_user_model
  >>> User = get_user_model()
  >>> User.objects.filter(email='rama.k@amensys.com').exists()
  ```

- Or list users (if your backend exposes this only for admins): log in as another admin and open User Management in the app, or call `GET /api/auth/users/` with an admin token.
