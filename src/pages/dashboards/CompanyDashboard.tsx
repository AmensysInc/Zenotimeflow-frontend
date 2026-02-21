import { Link } from "react-router-dom";
import { Users, CalendarDays, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Company Manager dashboard: manage employees and assign shifts.
 */
export default function CompanyDashboard() {
  const tiles = [
    {
      title: "Schedule",
      description: "Assign shifts and manage weekly schedule",
      href: "/scheduler/schedule",
      icon: CalendarDays,
    },
    {
      title: "Employees",
      description: "Manage employees in your company",
      href: "/scheduler/employees",
      icon: Users,
    },
    {
      title: "Missed Shifts",
      description: "Review and approve replacement requests",
      href: "/scheduler/missed-shifts",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Dashboard</h1>
        <p className="text-muted-foreground">Manage employees and assign shifts.</p>
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
