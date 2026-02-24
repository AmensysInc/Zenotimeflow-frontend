#!/usr/bin/env node
/**
 * Create super admin user via backend API, or show Django command if API doesn't allow it.
 * Usage: node scripts/create-superadmin.mjs [email] [password]
 * Default: rama.k@amensys.com / Temp@12345
 */
const API_BASE = process.env.VITE_API_URL || process.env.API_URL || "http://localhost:8000/api";
const email = process.argv[2] || "rama.k@amensys.com";
const password = process.argv[3] || "Temp@12345";
const fullName = process.argv[4] || "Super Admin";

async function checkUserExists() {
  // Listing users usually requires auth; try anyway for a friendly message
  try {
    const r = await fetch(`${API_BASE}/auth/users/`, { method: "GET" });
    if (r.ok) {
      const users = await r.json();
      const list = Array.isArray(users) ? users : users?.results || users?.data || [];
      const found = list.find((u) => (u.email || u.username || "").toLowerCase() === email.toLowerCase());
      return { exists: !!found, users: list };
    }
  } catch (e) {
    // ignore
  }
  return { exists: null, users: [] };
}

async function createSuperAdmin() {
  console.log(`Backend: ${API_BASE}`);
  console.log(`Creating super admin: ${email}`);

  const { exists } = await checkUserExists();
  if (exists === true) {
    console.log("User already exists. You can try logging in with that email and password.");
    return;
  }

  const payload = {
    email,
    full_name: fullName,
    password,
    password_confirm: password,
    role: "super_admin",
    app_type: "scheduler",
  };

  try {
    const r = await fetch(`${API_BASE}/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      console.log("Super admin created successfully. You can now sign in at http://localhost:8080/auth");
      return;
    }

    if (r.status === 400) {
      const msg = data.email?.[0] || data.detail || data.message || JSON.stringify(data);
      if (typeof msg === "string" && (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists"))) {
        console.log("User with this email already exists. You can try logging in.");
        return;
      }
      console.error("Validation error:", msg);
      return;
    }

    if (r.status === 401 || r.status === 403) {
      console.log("Register endpoint requires admin auth. Create the user in Django instead:");
      console.log("");
      console.log("  cd path/to/zeno_time_flow_backend");
      console.log("  python manage.py createsuperuser");
      console.log("");
      console.log("Then use:");
      console.log("  Email: " + email);
      console.log("  Password: " + password);
      console.log("");
      console.log("If your backend uses a custom user model with email as username, run:");
      console.log("  python manage.py shell");
      console.log("  >>> from django.contrib.auth import get_user_model");
      console.log("  >>> User = get_user_model()");
      console.log("  >>> u = User.objects.create_superuser('" + email + "', '" + password + "')");
      console.log("  >>> u.save()");
      return;
    }

    console.error("Unexpected response:", r.status, data);
  } catch (err) {
    console.error("Request failed (is the backend running on port 8000?):", err.message);
    console.log("");
    console.log("Create the user in Django:");
    console.log("  cd path/to/zeno_time_flow_backend");
    console.log("  python manage.py createsuperuser");
    console.log("  Email: " + email);
    console.log("  Password: " + password);
  }
}

createSuperAdmin();
