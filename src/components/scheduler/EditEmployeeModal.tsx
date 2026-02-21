import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees, useDepartments, Employee } from "@/hooks/useSchedulerDatabase";
import { formatPhoneUS, parsePhoneUS } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import { Trash2 } from "lucide-react";

interface EditEmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  companyId: string;
  onUpdate?: (id: string, updates: Partial<Employee>) => Promise<Employee>;
  onDelete?: (id: string) => Promise<void>;
}

export default function EditEmployeeModal({ 
  open, 
  onOpenChange, 
  employee, 
  companyId,
  onUpdate,
  onDelete 
}: EditEmployeeModalProps) {
  // Use employee's company_id if available, fallback to passed companyId
  const effectiveCompanyId = employee?.company_id || companyId;
  const { updateEmployee: hookUpdateEmployee, deleteEmployee: hookDeleteEmployee } = useEmployees(effectiveCompanyId);
  const { departments } = useDepartments(effectiveCompanyId);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Use provided callbacks or fallback to hook functions
  const updateEmployee = onUpdate || hookUpdateEmployee;
  const deleteEmployee = onDelete || hookDeleteEmployee;
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hire_date: "",
    hourly_rate: "",
    department_id: "none",
    position: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
    status: "active"
  });

  // Populate form when employee changes
  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
        phone: formatPhoneUS(employee.phone) || "",
        hire_date: employee.hire_date || "",
        hourly_rate: employee.hourly_rate?.toString() || "",
        department_id: employee.department_id || "none",
        position: employee.position || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: formatPhoneUS(employee.emergency_contact_phone) || "",
        notes: employee.notes || "",
        status: employee.status || "active"
      });
    }
  }, [employee]);

  // Sync employee changes with profiles table for User Management
  const syncProfileUpdate = async (employeeEmail: string, updates: { full_name?: string; email?: string; status?: string }) => {
    try {
      // Find profile by email and update it
      const users = await apiClient.get<any[]>('/auth/users/', { email: employeeEmail });
      const user = users && users.length > 0 ? users[0] : null;

      if (user) {
        await apiClient.patch(`/auth/profiles/${user.id}/`, updates);
      }
    } catch (error) {
      console.error('Error syncing profile update:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employee || !formData.first_name || !formData.last_name || !formData.email) {
      return;
    }

    setLoading(true);
    try {
      await updateEmployee(employee.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: parsePhoneUS(formData.phone) || undefined,
        hire_date: formData.hire_date || undefined,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
        department_id: formData.department_id !== "none" ? formData.department_id : undefined,
        position: formData.position || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: parsePhoneUS(formData.emergency_contact_phone) || undefined,
        notes: formData.notes || undefined,
        status: formData.status
      });

      // Sync with profiles table for User Management
      await syncProfileUpdate(employee.email, {
        full_name: `${formData.first_name} ${formData.last_name}`,
        email: formData.email,
        status: formData.status === 'active' ? 'active' : 'deleted'
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    
    const fullName = `${employee.first_name} ${employee.last_name}`;
    if (!confirm(`Are you sure you want to delete ${fullName}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      // Sync with profiles table - mark as deleted
      await syncProfileUpdate(employee.email, { status: 'deleted' });
      
      await deleteEmployee(employee.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete employee:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhoneUS(e.target.value) }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hire_date">Hire Date</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="e.g., Manager, Cashier, Cook"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="hourly_rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                placeholder="15.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Emergency Contact</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                    placeholder="Emergency contact name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: formatPhoneUS(e.target.value) }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about the employee..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || deleting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || deleting || !formData.first_name || !formData.last_name || !formData.email}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
