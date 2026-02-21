import { Link } from "react-router-dom";
import { Building2, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Organization Manager dashboard: view companies and employees inside their organization only.
 */
export default function OrganizationDashboard() {
  const tiles = [
    {
      title: "Companies",
      description: "View and manage companies in your organization",
      href: "/scheduler/companies",
      icon: Building2,
    },
    {
      title: "Employees",
      description: "View employees across your organization",
      href: "/scheduler/employees",
      icon: Users,
    },
    {
      title: "Schedules",
      description: "View schedules (read-only for org manager)",
      href: "/scheduler/employee-schedule",
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Dashboard</h1>
        <p className="text-muted-foreground">Manage companies and employees in your organization.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
