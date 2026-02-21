import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees, useDepartments, Employee } from "@/hooks/useSchedulerDatabase";
import apiClient from "@/lib/api-client";
import { ensureArray, formatPhoneUS, parsePhoneUS } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

interface AddEmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  /** Called after employee is created so parent can refresh list (single source of truth from API) */
  onSuccess?: () => void;
}

export default function AddEmployeeModal({ 
  open, 
  onOpenChange, 
  companyId, 
  companyName,
  onSuccess 
}: AddEmployeeModalProps) {
  const { createEmployee } = useEmployees();
  const { departments } = useDepartments(companyId);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [showAddAnother, setShowAddAnother] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
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

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent duplicate form submissions (only one API create call)
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);

    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    try {
      // Check if email already exists in employees (use Employee endpoint, normalize response)
      const raw = await apiClient.get<any>('/scheduler/employees/', { email: formData.email.trim() });
      const existingList = ensureArray(raw);
      const existingEmployee = existingList.length > 0 ? existingList[0] : null;

      if (existingEmployee) {
        toast.error("An employee with this email already exists");
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      // First create the user account
      let userData;
      try {
        userData = await apiClient.post('/auth/register/', {
          email: formData.email.trim(),
          full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim() || formData.email.trim(),
          password: formData.password,
          password_confirm: formData.password,
          role: 'employee',
          app_type: 'scheduler'
        });
      } catch (userError: any) {
        console.error('Error creating user:', userError);
        toast.error("Failed to create user account: " + (userError?.message || 'Unknown error'));
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      // Create employee record linked to the user
      const employeeData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: parsePhoneUS(formData.phone) || undefined,
        company_id: companyId,
        position: formData.position.trim() || "Employee",
        status: formData.status as "active" | "inactive" | "terminated",
        hire_date: formData.hire_date || new Date().toISOString().split('T')[0],
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
        department_id: formData.department_id !== "none" ? formData.department_id : undefined,
        emergency_contact_name: formData.emergency_contact_name.trim() || undefined,
        emergency_contact_phone: parsePhoneUS(formData.emergency_contact_phone) || undefined,
        notes: formData.notes.trim() || undefined,
        user_id: userData?.id || userData?.user?.id || null
      };

      // Single API call to create employee record (user already created above)
      await createEmployee(employeeData);

      toast.success(`Employee added to ${companyName} successfully!`);
      onSuccess?.();
      setShowAddAnother(true);
      resetForm();
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error("Failed to create employee");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleAddAnother = () => {
    setShowAddAnother(false);
    resetForm();
  };

  const handleDone = () => {
    setShowAddAnother(false);
    onOpenChange(false);
  };

  const hasValidCompany = Boolean(companyId && companyId.trim());
  const safeDepartments = Array.isArray(departments) ? departments : [];

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        resetForm();
        setShowAddAnother(false);
      }
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {showAddAnother ? "Employee added" : "Add New Employee"}
          </DialogTitle>
        </DialogHeader>

        {!hasValidCompany ? (
          <div className="py-4 text-center text-muted-foreground">
            <p>Select a company first to add an employee.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : showAddAnother ? (
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">You can add another employee to this company or close to see the list.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleAddAnother}>
                Add another employee
              </Button>
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            </div>
          </div>
        ) : (
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

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter password (min 6 characters)"
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
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="none">Select department</SelectItem>
                  {safeDepartments.map((department) => (
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
                <SelectContent className="bg-background border shadow-lg z-50">
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

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.first_name || !formData.last_name || !formData.email || !formData.password}
            >
              {loading ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
