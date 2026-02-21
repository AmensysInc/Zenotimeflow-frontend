import { useState, useEffect } from "react";
import React from "react";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Phone, Mail, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies, useDepartments, useEmployees, Employee } from "@/hooks/useSchedulerDatabase";
import { formatPhoneUS } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import CreateCompanyModal from "@/components/scheduler/CreateCompanyModal";
import AddEmployeeModal from "@/components/scheduler/AddEmployeeModal";
import EditEmployeeModal from "@/components/scheduler/EditEmployeeModal";

export default function SchedulerEmployees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  // Start with "all" so we fetch employees immediately; company filter can narrow later
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // User role hook
  const { isCompanyManager, isSuperAdmin, isOrganizationManager } = useUserRole();
  const { user } = useAuth();

  // Database hooks: pass manager id so backend returns companies they can manage (enables Add Employee for managers)
  const companyManagerId = isCompanyManager ? (user?.id ?? '') : undefined;
  const organizationManagerId = isOrganizationManager ? (user?.id ?? '') : undefined;
  const { companies, loading: companiesLoading } = useCompanies(companyManagerId, organizationManagerId);

  // For managers: auto-select their company (we requested by company_manager so first company is theirs)
  const managerCompanyId = React.useMemo(() => {
    const list = Array.isArray(companies) ? companies : [];
    if (isCompanyManager && list.length > 0) {
      const managerCompany = list.find(c => String(c.company_manager_id ?? '') === String(user?.id ?? ''));
      return managerCompany?.id ?? list[0]?.id;
    }
    return undefined;
  }, [isCompanyManager, companies, user?.id]);

  // Use manager's company if they're a manager; for admin/org manager use selectedCompany, and pass 'all' to fetch all employees when "All Employees" is selected
  const effectiveCompanyId = isCompanyManager && managerCompanyId ? managerCompanyId : (selectedCompany === "all" ? "all" : selectedCompany);
  
  const { departments, loading: departmentsLoading } = useDepartments(effectiveCompanyId);
  
  // Employee list from Employee table; backend applies RBAC (company filter by role)
  // For managers, always use their company (no "all" option)
  const { employees, loading: employeesLoading, deleteEmployee, updateEmployee, refetch: refetchEmployees } = useEmployees(effectiveCompanyId);
  const employeesList = Array.isArray(employees) ? employees : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];

  // For company managers, auto-select their company and prevent changing it
  useEffect(() => {
    if (isCompanyManager && managerCompanyId && selectedCompany !== managerCompanyId) {
      setSelectedCompany(managerCompanyId);
    }
  }, [isCompanyManager, managerCompanyId, selectedCompany]);

  const filteredEmployees = employeesList.filter(employee => {
    const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    const email = employee.email ?? '';
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === "all" || 
                             employee.department_id === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const getDepartmentName = (departmentId?: string) => {
    if (!departmentId) return 'No Department';
    const department = safeDepartments.find(d => d.id === departmentId);
    return department ? department.name : 'Unknown Department';
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (confirm(`Are you sure you want to delete ${employeeName}? This action cannot be undone.`)) {
      try {
        await deleteEmployee(employeeId);
      } catch (error) {
        console.error('Failed to delete employee:', error);
      }
    }
  };

  // For managers, use their assigned company; for others, use selected company
  const getCompanyIdForNewEmployee = () => {
    if (isCompanyManager && managerCompanyId) {
      return managerCompanyId;
    }
    if (selectedCompany && selectedCompany !== "all") {
      return selectedCompany;
    }
    // If "all" is selected but user has companies, use the first one
    if (safeCompanies.length > 0) {
      return safeCompanies[0].id;
    }
    return "";
  };

  const canAddEmployee = getCompanyIdForNewEmployee() !== "";
  const canAddCompany = isSuperAdmin || isOrganizationManager;

  const isLoading = companiesLoading || departmentsLoading || employeesLoading;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage your team members and their information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateEmployee(true)} disabled={!canAddEmployee}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesList.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {employeesList.filter(e => e.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Hourly Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employeesList.length > 0 && employeesList.some(e => e.hourly_rate != null && e.hourly_rate !== '') ? (
                `$${(employeesList
                  .filter(e => e.hourly_rate != null && e.hourly_rate !== '')
                  .reduce((sum, e) => sum + (Number(e.hourly_rate) || 0), 0) / 
                  employeesList.filter(e => e.hourly_rate != null && e.hourly_rate !== '').length
                ).toFixed(2)}`
              ) : (
                'N/A'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Employee Directory</CardTitle>
            <div className="flex items-center gap-2">
              {/* Hide company selector for managers - they only see their company */}
              {!isCompanyManager && (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {safeCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Show company name badge for managers */}
              {isCompanyManager && managerCompanyId && (
                <Badge variant="secondary" className="px-3 py-1.5">
                  <Building className="h-4 w-4 mr-2" />
                  {safeCompanies.find(c => c.id === managerCompanyId)?.name || "Company"}
                </Badge>
              )}
              
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
              
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {safeDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading employees...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No employees found matching your search' : 
                     'No employees found. Add some employees to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee, index) => {
                  const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
                  return (
                    <TableRow key={employee.id ?? `emp-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {(employee.first_name ?? '')[0]}{(employee.last_name ?? '')[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{fullName}</div>
                            <div className="text-sm text-muted-foreground">
                              {employee.hire_date ? 
                                `Joined ${new Date(employee.hire_date).toLocaleDateString()}` :
                                'No hire date'
                              }
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {employee.email}
                          </div>
                          {employee.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {formatPhoneUS(employee.phone)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getDepartmentName(employee.department_id)}</Badge>
                      </TableCell>
                      <TableCell>{employee.position || 'No position'}</TableCell>
                      <TableCell className="font-medium">
                        {employee.hourly_rate != null && employee.hourly_rate !== '' ? `$${Number(employee.hourly_rate).toFixed(2)}` : 'Not set'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(employee.status)}>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedEmployee(employee);
                              setShowEditEmployee(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Employee
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteEmployee(employee.id, fullName)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Employee
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateCompanyModal 
        open={showCreateCompany} 
        onOpenChange={setShowCreateCompany} 
      />
      
      <AddEmployeeModal 
        open={showCreateEmployee} 
        onOpenChange={setShowCreateEmployee}
        companyId={getCompanyIdForNewEmployee()}
        companyName={safeCompanies.find(c => c.id === getCompanyIdForNewEmployee())?.name || "Company"}
        onSuccess={refetchEmployees}
      />

      <EditEmployeeModal
        open={showEditEmployee}
        onOpenChange={setShowEditEmployee}
        employee={selectedEmployee}
        companyId={selectedCompany}
        onUpdate={updateEmployee}
        onDelete={deleteEmployee}
      />
    </div>
  );
}