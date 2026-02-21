import { Link } from "react-router-dom";
import { Building2, Users, Building, UserCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Super Admin dashboard: entry point after login.
 * Can navigate to organization list, company list, employee list, and user management.
 */
export default function SuperAdminDashboard() {
  const tiles = [
    {
      title: "Organizations & Companies",
      description: "Manage organizations and companies",
      href: "/scheduler/companies",
      icon: Building2,
    },
    {
      title: "Employees",
      description: "View and manage all employees",
      href: "/scheduler/employees",
      icon: Users,
    },
    {
      title: "Schedules",
      description: "Manage shifts and schedules",
      href: "/scheduler/schedule",
      icon: Building,
    },
    {
      title: "User Management",
      description: "Manage user accounts and roles",
      href: "/user-management",
      icon: UserCog,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage organizations, companies, and users.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ title, description, href, icon: Icon }) => (
          <Link key={href} to={href}>
            <Card className="hover:bg-accent/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
