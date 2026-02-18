import { useState, useEffect } from "react";
import { Save, Bell, Clock, Users, Shield, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export default function SchedulerSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [settings, setSettings] = useState({
    companyName: "zenotimeflow",
    timezone: "America/New_York",
    weekStartDay: "monday",
    clockInGracePeriod: 5,
    overtimeThreshold: 40,
    breakDuration: 30,
    adminEmail: "",
    dataRetentionPeriod: 365,
    notifications: {
      shiftReminders: true,
      overtimeAlerts: true,
      clockInReminders: false,
      scheduleChanges: true
    },
    autoApproveTimeOff: false,
    requireClockInLocation: false,
    allowMobileClockIn: true
  });

  // Load settings from Supabase
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        try {
          const data = await apiClient.get<any>(`/scheduler/app-settings/${user.id}/`);
          setSettings({
            companyName: data.company_name || "zenotimeflow",
            timezone: data.timezone || "America/New_York",
            weekStartDay: data.week_start_day || "monday",
            clockInGracePeriod: data.clock_in_grace_period || 5,
            overtimeThreshold: data.overtime_threshold || 40,
            breakDuration: data.break_duration || 30,
            adminEmail: data.admin_email || "",
            dataRetentionPeriod: data.data_retention_period || 365,
            notifications: {
              shiftReminders: data.shift_reminders ?? true,
              overtimeAlerts: data.overtime_alerts ?? true,
              clockInReminders: data.clock_in_reminders ?? false,
              scheduleChanges: data.schedule_changes ?? true
            },
            autoApproveTimeOff: data.auto_approve_time_off ?? false,
            requireClockInLocation: data.require_clock_in_location ?? false,
            allowMobileClockIn: data.allow_mobile_clock_in ?? true
          });
        } catch (error: any) {
          if (error.status !== 404) {
            console.error('Error loading settings:', error);
            toast({
              title: "Error",
              description: "Failed to load settings. Using defaults.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error in loadSettings:', error);
      } finally {
        setInitialLoad(false);
      }
    };

    loadSettings();
  }, [user, toast]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const settingsData = {
        user_id: user.id,
        company_name: settings.companyName,
        timezone: settings.timezone,
        week_start_day: settings.weekStartDay,
        clock_in_grace_period: settings.clockInGracePeriod,
        overtime_threshold: settings.overtimeThreshold,
        break_duration: settings.breakDuration,
        admin_email: settings.adminEmail,
        data_retention_period: settings.dataRetentionPeriod,
        shift_reminders: settings.notifications.shiftReminders,
        overtime_alerts: settings.notifications.overtimeAlerts,
        clock_in_reminders: settings.notifications.clockInReminders,
        schedule_changes: settings.notifications.scheduleChanges,
        auto_approve_time_off: settings.autoApproveTimeOff,
        require_clock_in_location: settings.requireClockInLocation,
        allow_mobile_clock_in: settings.allowMobileClockIn
      };

      try {
        await apiClient.post('/scheduler/app-settings/', settingsData);
        toast({
          title: "Success",
          description: "Settings saved successfully!",
        });
      } catch (error: any) {
        console.error('Error saving settings:', error);
        toast({
          title: "Error",
          description: "Failed to save settings. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your roster management system
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading || initialLoad}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => updateSetting('companyName', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={settings.timezone} onValueChange={(value) => updateSetting('timezone', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekStartDay">Week Start Day</Label>
                <Select value={settings.weekStartDay} onValueChange={(value) => updateSetting('weekStartDay', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtimeThreshold">Overtime Threshold (hours/week)</Label>
                <Input
                  id="overtimeThreshold"
                  type="number"
                  value={settings.overtimeThreshold}
                  onChange={(e) => updateSetting('overtimeThreshold', Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Clock Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clockInGracePeriod">Clock-in Grace Period (minutes)</Label>
                <Input
                  id="clockInGracePeriod"
                  type="number"
                  value={settings.clockInGracePeriod}
                  onChange={(e) => updateSetting('clockInGracePeriod', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="breakDuration">Default Break Duration (minutes)</Label>
                <Input
                  id="breakDuration"
                  type="number"
                  value={settings.breakDuration}
                  onChange={(e) => updateSetting('breakDuration', Number(e.target.value))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Clock-in Location</Label>
                  <div className="text-sm text-muted-foreground">
                    Require employees to be at work location to clock in
                  </div>
                </div>
                <Switch
                  checked={settings.requireClockInLocation}
                  onCheckedChange={(checked) => updateSetting('requireClockInLocation', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Clock-in</Label>
                  <div className="text-sm text-muted-foreground">
                    Allow employees to clock in from mobile devices
                  </div>
                </div>
                <Switch
                  checked={settings.allowMobileClockIn}
                  onCheckedChange={(checked) => updateSetting('allowMobileClockIn', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Shift Reminders</Label>
                  <div className="text-sm text-muted-foreground">
                    Send reminders before scheduled shifts
                  </div>
                </div>
                <Switch
                  checked={settings.notifications.shiftReminders}
                  onCheckedChange={(checked) => updateSetting('notifications.shiftReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Overtime Alerts</Label>
                  <div className="text-sm text-muted-foreground">
                    Alert managers when employees approach overtime
                  </div>
                </div>
                <Switch
                  checked={settings.notifications.overtimeAlerts}
                  onCheckedChange={(checked) => updateSetting('notifications.overtimeAlerts', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clock-in Reminders</Label>
                  <div className="text-sm text-muted-foreground">
                    Remind employees to clock in for their shifts
                  </div>
                </div>
                <Switch
                  checked={settings.notifications.clockInReminders}
                  onCheckedChange={(checked) => updateSetting('notifications.clockInReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Schedule Changes</Label>
                  <div className="text-sm text-muted-foreground">
                    Notify employees of schedule modifications
                  </div>
                </div>
                <Switch
                  checked={settings.notifications.scheduleChanges}
                  onCheckedChange={(checked) => updateSetting('notifications.scheduleChanges', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-approve Time Off Requests</Label>
                <div className="text-sm text-muted-foreground">
                  Automatically approve time off requests without manager approval
                </div>
              </div>
              <Switch
                checked={settings.autoApproveTimeOff}
                onCheckedChange={(checked) => updateSetting('autoApproveTimeOff', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Contact Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@company.com"
                value={settings.adminEmail}
                onChange={(e) => updateSetting('adminEmail', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataRetentionPeriod">Data Retention Period (days)</Label>
              <Input
                id="dataRetentionPeriod"
                type="number"
                value={settings.dataRetentionPeriod}
                onChange={(e) => updateSetting('dataRetentionPeriod', Number(e.target.value))}
              />
              <div className="text-sm text-muted-foreground">
                How long to keep employee time and schedule data
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" disabled={loading || initialLoad}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}