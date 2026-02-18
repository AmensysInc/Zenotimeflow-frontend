import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Supabase removed - using Django API
import { useEmployees, Employee } from "@/hooks/useSchedulerDatabase";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Building, User, UserPlus, Phone, Mail, MapPin, UserCheck, Edit, Trash2, MoreHorizontal, UserMinus } from "lucide-react";
import AddEmployeeModal from "./AddEmployeeModal";
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

interface CompanyManager {
  user_id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
}

export default function CompanyDetailModal({ 
  open, 
  onOpenChange, 
  company 
}: CompanyDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [companyManager, setCompanyManager] = useState<CompanyManager | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { employees, loading: employeesLoading, refetch, updateEmployee, deleteEmployee } = useEmployees(company?.id);
  const { isSuperAdmin, isOrganizationManager, isCompanyManager } = useUserRole();

  // Check if current user can manage employees
  const canManageEmployees = isSuperAdmin || isOrganizationManager || isCompanyManager;

  useEffect(() => {
    if (open && company) {
      fetchCompanyManager();
      refetch();
    }
  }, [open, company]);

  // Listen for new employees being added or edited
  useEffect(() => {
    if (open && !showAddEmployee && !showEditEmployee) {
      refetch();
    }
  }, [showAddEmployee, showEditEmployee]);

  const fetchCompanyManager = async () => {
    if (!company?.company_manager_id) {
      setCompanyManager(null);
      return;
    }

    setLoading(true);
    try {
      const userData = await apiClient.get<any>(`/auth/users/${company.company_manager_id}/`);
      setCompanyManager({
        user_id: userData.id,
        full_name: userData.profile?.full_name || '',
        email: userData.email || '',
        mobile_number: userData.profile?.mobile_number || ''
      });
    } catch (error) {
      console.error('Error fetching company manager:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSuccess = () => {
    setShowAddEmployee(false);
    toast.success("Employee added successfully!");
    // Employees will be refetched automatically when modal closes
  };

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: company.color || '#3b82f6' }}
                >
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{company.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{company.type}</Badge>
                    <Badge variant={company.field_type === 'IT' ? 'default' : 'secondary'}>
                      {company.field_type}
                    </Badge>
                  </div>
                </div>
              </div>
              {canManageEmployees && (
                <Button onClick={() => setShowAddEmployee(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Employee
                </Button>
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
                {company.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <span>{company.address}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{company.phone}</span>
                  </div>
                )}
                {company.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{company.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Manager */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : companyManager ? (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {companyManager.full_name?.split(' ').map(n => n[0]).join('') || 'M'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{companyManager.full_name}</h3>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {companyManager.email}
                        </span>
                        {companyManager.mobile_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {companyManager.mobile_number}
                          </span>
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

            {/* Employees */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Employees ({employees.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employeesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : employees.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((employee) => (
                      <Card key={employee.id} className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {`${employee.first_name[0]}${employee.last_name[0]}`}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">
                              {employee.first_name} {employee.last_name}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {employee.position || 'Employee'}
                            </p>
                            <Badge 
                              variant={employee.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs mt-1"
                            >
                              {employee.status}
                            </Badge>
                          </div>
                          {canManageEmployees && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Employee
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-orange-600"
                                  onClick={() => handleRemoveEmployee(employee)}
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove Employee
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteEmployee(employee)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Employee
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
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