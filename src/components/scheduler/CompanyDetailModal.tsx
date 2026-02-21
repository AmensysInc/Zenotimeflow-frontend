import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployees, Employee } from "@/hooks/useSchedulerDatabase";
import { useUserRole } from "@/hooks/useUserRole";
import apiClient from "@/lib/api-client";
import { formatPhoneUS } from "@/lib/utils";
import { toast } from "sonner";
import { Building, User, UserPlus, Phone, Mail, MapPin, UserCheck, Edit, Trash2, MoreHorizontal, UserMinus } from "lucide-react";
import AddEmployeeModal from "./AddEmployeeModal";
import AssignExistingUserModal from "./AssignExistingUserModal";
import EditEmployeeModal from "./EditEmployeeModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CompanyDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: any;
}

/** Manager details from API (company.company_manager_details). */
interface CompanyManagerDetails {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_active?: boolean;
}

export default function CompanyDetailModal({ 
  open, 
  onOpenChange, 
  company 
}: CompanyDetailModalProps) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAssignExisting, setShowAssignExisting] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailCompany, setDetailCompany] = useState<typeof company | null>(null);
  const { employees, loading: employeesLoading, refetch, updateEmployee, deleteEmployee } = useEmployees(company?.id);
  const { isSuperAdmin, isOrganizationManager, isCompanyManager } = useUserRole();

  // Fetch company detail when modal opens (employees_count, manager from backend)
  useEffect(() => {
    if (!open || !company?.id) {
      setDetailCompany(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<any>(`/scheduler/companies/${company.id}/`);
        if (!cancelled && data) setDetailCompany(data);
      } catch {
        setDetailCompany(company);
      }
    })();
    return () => { cancelled = true; };
  }, [open, company?.id]);

  const displayCompany = detailCompany ?? company;
  const managerDetails: CompanyManagerDetails | null = displayCompany?.company_manager_details ?? company?.company_manager_details ?? null;
  const employeeCount = displayCompany?.employees_count ?? employees.length;

  // Check if current user can manage employees
  const canManageEmployees = isSuperAdmin || isOrganizationManager || isCompanyManager;

  useEffect(() => {
    if (open && company) {
      refetch();
    }
  }, [open, company]);

  // Refetch employees when add/assign/edit modals close so list stays in sync
  useEffect(() => {
    if (open && !showAddEmployee && !showAssignExisting && !showEditEmployee) {
      refetch();
    }
  }, [showAddEmployee, showAssignExisting, showEditEmployee]);

  const handleEmployeeSuccess = () => {
    setShowAddEmployee(false);
    setShowAssignExisting(false);
    setTimeout(() => refetch(), 0);
  };

  const existingEmployeeUserIds = (employees || [])
    .map((e) => e.user_id)
    .filter((id): id is string => Boolean(id));

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditEmployee(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    const fullName = `${employee.first_name} ${employee.last_name}`;
    if (!confirm(`Are you sure you want to delete ${fullName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteEmployee(employee.id);
      toast.success(`${fullName} has been deleted`);
      refetch();
    } catch (error) {
      console.error('Failed to delete employee:', error);
      toast.error("Failed to delete employee");
    }
  };

  const handleRemoveEmployee = async (employee: Employee) => {
    const fullName = `${employee.first_name} ${employee.last_name}`;
    if (!confirm(`Are you sure you want to remove ${fullName} from this company? They will become unassigned but their account will remain.`)) {
      return;
    }

    try {
      await updateEmployee(employee.id, { company_id: null });
      toast.success(`${fullName} has been removed from this company`);
      refetch();
    } catch (error) {
      console.error('Failed to remove employee:', error);
      toast.error("Failed to remove employee from company");
    }
  };

  if (!company) return null;

  const headerCompany = displayCompany ?? company;
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: headerCompany.color || '#3b82f6' }}
                >
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{headerCompany.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{headerCompany.type}</Badge>
                    <Badge variant={headerCompany.field_type === 'IT' ? 'default' : 'secondary'}>
                      {headerCompany.field_type}
                    </Badge>
                  </div>
                </div>
              </div>
              {canManageEmployees && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAssignExisting(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign existing user
                  </Button>
                  <Button onClick={() => setShowAddEmployee(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add new employee
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Company Information */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {headerCompany.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <span>{headerCompany.address}</span>
                  </div>
                )}
                {headerCompany.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{formatPhoneUS(headerCompany.phone)}</span>
                  </div>
                )}
                {headerCompany.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{headerCompany.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Manager - details from API (company_manager_details) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                {managerDetails ? (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {(managerDetails.full_name || managerDetails.email || 'M').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{managerDetails.full_name || [managerDetails.first_name, managerDetails.last_name].filter(Boolean).join(' ') || managerDetails.email}</h3>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {managerDetails.email}
                        </span>
                        {managerDetails.is_active !== undefined && (
                          <Badge variant={managerDetails.is_active ? 'default' : 'secondary'} className="w-fit text-xs">
                            {managerDetails.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No manager assigned</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employees - list + table */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Assigned Employees ({employeeCount})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employeesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : Array.isArray(employees) && employees.length > 0 ? (
                  <>
                    <div className="rounded-md border mb-4 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Status</TableHead>
                            {canManageEmployees && <TableHead className="w-[80px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {employee.first_name} {employee.last_name}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                              <TableCell>{employee.position || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={employee.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                  {employee.status}
                                </Badge>
                              </TableCell>
                              {canManageEmployees && (
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-orange-600" onClick={() => handleRemoveEmployee(employee)}>
                                        <UserMinus className="h-4 w-4 mr-2" />
                                        Remove
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(employee)}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No employees added yet</p>
                    {canManageEmployees && (
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setShowAddEmployee(true)}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add First Employee
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AddEmployeeModal
        open={showAddEmployee}
        onOpenChange={setShowAddEmployee}
        companyId={company?.id}
        companyName={company?.name}
        onSuccess={handleEmployeeSuccess}
      />

      <AssignExistingUserModal
        open={showAssignExisting}
        onOpenChange={setShowAssignExisting}
        companyId={company?.id}
        companyName={company?.name}
        existingEmployeeUserIds={existingEmployeeUserIds}
        onSuccess={handleEmployeeSuccess}
      />

      <EditEmployeeModal
        open={showEditEmployee}
        onOpenChange={setShowEditEmployee}
        employee={selectedEmployee}
        companyId={company?.id}
        onUpdate={updateEmployee}
        onDelete={deleteEmployee}
      />
    </>
  );
}