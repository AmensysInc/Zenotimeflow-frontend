import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies } from "@/hooks/useSchedulerDatabase";
import apiClient from "@/lib/api-client";
import { formatPhoneUS, parsePhoneUS } from "@/lib/utils";
import { toast } from "sonner";

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  onSuccess?: () => void;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

const COMPANY_TYPES = [
  { value: "motel", label: "Motel" },
  { value: "gas_station", label: "Gas Station" },
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail Store" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "other", label: "Other" }
];

export default function CreateCompanyModal({ open, onOpenChange, organizationId, onSuccess }: CreateCompanyModalProps) {
  const { createCompany } = useCompanies();
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "motel",
    color: "#3b82f6",
    address: "",
    phone: "",
    email: "",
    company_manager_id: "",
    organization_id: organizationId || ""
  });

  useEffect(() => {
    if (open) {
      fetchAvailableUsers();
      if (organizationId) {
        setFormData(prev => ({ ...prev, organization_id: organizationId }));
      }
    }
  }, [open, organizationId]);

  const fetchAvailableUsers = async () => {
    try {
      // Fetch users with manager role for company manager assignment
      const users = await apiClient.get<any[]>('/auth/users/');
      const managerUsers = users.filter((u: any) => {
        const roles = u.roles || [];
        return roles.some((r: any) => r.role === 'manager') && 
               (u.profile?.status === 'active' || !u.profile?.status);
      });

      const profiles = managerUsers.map((u: any) => ({
        user_id: u.id,
        full_name: u.profile?.full_name || u.full_name || '',
        email: u.email
      }));

      setAvailableUsers(profiles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load available users');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      return;
    }

    setLoading(true);
    try {
      // Create the company
      const companyData = {
        name: formData.name,
        type: formData.type,
        color: formData.color,
        address: formData.address,
        phone: parsePhoneUS(formData.phone) || undefined,
        email: formData.email,
        company_manager_id: (formData.company_manager_id && formData.company_manager_id !== "none") ? formData.company_manager_id : null,
        organization_id: formData.organization_id || null
      };

      await createCompany(companyData);

      // Assign manager role to the selected company manager
      if (formData.company_manager_id && formData.company_manager_id !== "none") {
        const userData = await apiClient.get<any>(`/auth/users/${formData.company_manager_id}/`);
        const hasSchedulerManagerRole = userData?.roles?.some((r: any) => 
          r.role === 'manager' && r.app_type === 'scheduler'
        );
        
        if (!hasSchedulerManagerRole) {
          await apiClient.post('/auth/user-roles/', {
            user: formData.company_manager_id,
            role: 'manager',
            app_type: 'scheduler'
          });
        }
      }

      onOpenChange(false);
      onSuccess?.();
      setFormData({
        name: "",
        type: "motel",
        color: "#3b82f6",
        address: "",
        phone: "",
        email: "",
        company_manager_id: "",
        organization_id: organizationId || ""
      });
      toast.success('Company created successfully!');
    } catch (error) {
      console.error('Failed to create company:', error);
      toast.error('Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Company</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter company name"
              required
            />
          </div>


          <div className="space-y-2">
            <Label htmlFor="type">Business Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Brand Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-16 h-10 p-1"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter company address"
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contact@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-manager">Company Manager</Label>
            <Select
              value={formData.company_manager_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, company_manager_id: value }))}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select company manager" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="none">No company manager</SelectItem>
                {availableUsers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={loading || !formData.name || !formData.type}>
              {loading ? "Creating..." : "Create Company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}