import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies } from "@/hooks/useSchedulerDatabase";
import { formatPhoneUS, parsePhoneUS } from "@/lib/utils";
import { toast } from "sonner";
import { Building, Palette, Trash2 } from "lucide-react";

interface EditCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: any;
  onSuccess: () => void;
}

// Use the same business types as CreateCompanyModal for consistency
const COMPANY_TYPES = [
  { value: "motel", label: "Motel" },
  { value: "gas_station", label: "Gas Station" },
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail Store" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "other", label: "Other" }
];

const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#f97316"];

export default function EditCompanyModal({ 
  open, 
  onOpenChange, 
  company, 
  onSuccess 
}: EditCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { updateCompany, deleteCompany } = useCompanies();
  
  // Track which company we're editing to detect changes
  const lastCompanyIdRef = useRef<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    color: "#3b82f6",
    address: "",
    phone: "",
    email: ""
  });

  // Reset form data when company changes or modal opens with a different company
  useEffect(() => {
    if (open && company) {
      // Always reset form when company ID changes or modal opens
      if (lastCompanyIdRef.current !== company.id) {
        lastCompanyIdRef.current = company.id;
        setFormData({
          name: company.name || "",
          type: company.type || "",
          color: company.color || "#3b82f6",
          address: company.address || "",
          phone: formatPhoneUS(company.phone) || "",
          email: company.email || ""
        });
      }
    }
    
    // Reset tracking when modal closes
    if (!open) {
      lastCompanyIdRef.current = null;
    }
  }, [open, company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    if (!formData.name.trim() || !formData.type) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      await updateCompany(company.id, { ...formData, phone: parsePhoneUS(formData.phone) || undefined });
      
      // Verify the update was successful
      onSuccess();
      onOpenChange(false);
      toast.success("Company updated successfully!");
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error("Failed to update company");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    
    setDeleting(true);
    try {
      await deleteCompany(company.id);
      onSuccess();
      onOpenChange(false);
      toast.success("Company deleted successfully!");
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error("Failed to delete company. Make sure there are no employees or shifts associated with it.");
    } finally {
      setDeleting(false);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Edit Company
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter company name"
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="type">Business Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
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

            <div className="col-span-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Brand Color
              </Label>
              <div className="flex gap-2 mt-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg border-2 ${formData.color === color ? 'border-primary' : 'border-muted'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter company address"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneUS(e.target.value) })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter company email"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Company</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{company.name}"? This action cannot be undone. 
                    All associated employees, departments, and shifts will also be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete Company"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || deleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading ? "Updating..." : "Update Company"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}