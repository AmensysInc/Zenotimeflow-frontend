import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Send, Paperclip, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TaskNote {
  id: string;
  task_id: string;
  user_id: string;
  author_id: string;
  note_text: string;
  files: string[];
  created_at: string;
  author_name?: string;
  is_admin_author?: boolean;
}

interface TaskNotesProps {
  taskId: string;
  taskTitle: string;
  assignedUsers: Array<{
    user_id: string;
    full_name: string | null;
    email: string;
  }>;
  isAdmin: boolean;
  currentUserId?: string;
  taskUserId?: string;
}

export const TaskNotes = ({ taskId, taskTitle, assignedUsers, isAdmin, currentUserId, taskUserId }: TaskNotesProps) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check location tracking status
  useEffect(() => {
    const checkLocationStatus = () => {
      const enabled = localStorage.getItem('locationEnabled') === 'true';
      setLocationEnabled(enabled);
    };
    
    checkLocationStatus();
    
    // Listen for changes
    const interval = setInterval(checkLocationStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Initialize selectedUser to first assigned user for admins
  useEffect(() => {
    if (isAdmin && assignedUsers.length > 0 && !selectedUser) {
      setSelectedUser(assignedUsers[0].user_id);
    }
  }, [isAdmin, assignedUsers, selectedUser]);

  useEffect(() => {
    if (user && isNotesOpen && (selectedUser || !isAdmin)) {
      fetchNotes();
    }
  }, [user, taskId, isNotesOpen, selectedUser]);

  const fetchNotes = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const params: any = { task: taskId };
      if (isAdmin && selectedUser) {
        params.user = selectedUser;
      } else if (!isAdmin) {
        params.user = user.id;
      }

      const notesData = await apiClient.get<any[]>('/tasks/comments/', params);

      // Get author profiles for notes
      const notesWithAuthors = await Promise.all(
        (notesData || []).map(async (note) => {
          try {
            const author = await apiClient.get<any>(`/auth/users/${note.author || note.author_id}/`);
            const isAdminAuthor = author?.roles?.some((r: any) => 
              r.role === 'super_admin' || r.role === 'manager' || r.role === 'operations_manager'
            ) || false;
            
            return {
              ...note,
              files: Array.isArray(note.files) ? (note.files as string[]) : [],
              author_name: author?.profile?.full_name || author?.full_name || author?.email || (isAdminAuthor ? 'Manager' : 'User'),
              is_admin_author: isAdminAuthor
            };
          } catch (error) {
            return {
              ...note,
              files: Array.isArray(note.files) ? (note.files as string[]) : [],
              author_name: 'User',
              is_admin_author: false
            };
          }
        })
      );

      setNotes(notesWithAuthors);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    }
    setIsLoading(false);
  };

  const getLocation = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const accuracy = position.coords.accuracy;
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'ZenoTimeFlow/1.0'
                }
              }
            );
            
            if (!response.ok) {
              throw new Error('Geocoding failed');
            }
            
            const data = await response.json();
            const address = data.address;
            
            const parts = [];
            if (address.road) parts.push(address.road);
            if (address.neighbourhood || address.suburb) parts.push(address.neighbourhood || address.suburb);
            if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
            if (address.state) parts.push(address.state);
            
            const readableAddress = parts.length > 0 ? parts.join(', ') : `${latitude}, ${longitude}`;
            resolve(readableAddress);
          } catch (error) {
            console.error('Geocoding error:', error);
            resolve(`${latitude}, ${longitude}`);
          }
        },
        (error) => {
          reject(new Error('Unable to retrieve location'));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 300000, // Cache for 5 minutes
          timeout: 10000
        }
      );
    });
  };

  const addNote = async () => {
    if (!user) return;
    if (!newNote.trim()) return;

    setIsSaving(true);
    try {
      const targetUserId = isAdmin ? selectedUser : user.id;
      if (!targetUserId) {
        toast.error('Please select a user');
        return;
      }

      // Get location if enabled
      let location = null;
      if (locationEnabled) {
        try {
          location = await getLocation();
        } catch (error: any) {
          console.error('Failed to get location:', error);
        }
      }

      // Upload files first
      const fileUrls: string[] = [];
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `notes/${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        // Upload file to Django backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('task_id', taskId);
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8085/api'}/tasks/attachments/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiClient.getToken()}`
            },
            body: formData
          });

          if (!response.ok) {
            console.error('File upload error');
            continue;
          }

          const result = await response.json();
          const fileUrl = result.url || result.file_url;
          fileUrls.push(fileUrl);
        } catch (error) {
          console.error('File upload error:', error);
          continue;
        }
      }

      // Append location to note if available
      let noteText = newNote.trim();
      if (location) {
        noteText += `\n\n📍 ${location}`;
      }

      // Create the note
      await apiClient.post('/tasks/comments/', {
        task: taskId,
        user: targetUserId,
        author: user.id,
        note_text: noteText,
        files: fileUrls
      });

      setNewNote("");
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchNotes();
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    }
    setIsSaving(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Task Notes: {taskTitle}</span>
          </DialogTitle>
          
          {/* User Selection for Admins */}
          {isAdmin && assignedUsers.length > 0 && (
            <div className="mb-3">
              <label className="text-sm font-medium mb-2 block">Select User for Notes:</label>
              <Select value={selectedUser || ""} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {assignedUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            {isAdmin 
              ? selectedUser 
                ? `Notes for: ${assignedUsers.find(u => u.user_id === selectedUser)?.full_name || assignedUsers.find(u => u.user_id === selectedUser)?.email}`
                : 'Select a user to view notes'
              : 'Your task notes and admin comments'
            }
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Notes Display */}
            <ScrollArea className="flex-1 pr-2 mb-4">
              <div className="space-y-4 p-2">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div>No notes yet</div>
                    <div className="text-sm">
                      {isAdmin ? 'Add notes for the selected user' : 'Add your first note or wait for admin comments'}
                    </div>
                  </div>
                ) : (
                  notes.map((note) => {
                    const noteTextParts = note.note_text.split('\n\n📍');
                    const mainText = noteTextParts[0];
                    const locationText = noteTextParts[1] || null;
                    
                    return (
                      <div key={note.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              note.is_admin_author 
                                ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white'
                                : 'bg-gradient-to-br from-blue-500 to-teal-600 text-white'
                            }`}>
                              {getInitials(note.author_name || 'U')}
                            </div>
                            <span className="text-sm font-medium">{note.author_name}</span>
                            {note.is_admin_author && <Badge variant="outline" className="text-xs">Admin</Badge>}
                          </div>
                          <div className="flex flex-col items-end text-xs text-muted-foreground">
                            <span>{format(new Date(note.created_at), 'MMM dd, yyyy HH:mm')}</span>
                            {locationText && (
                              <span className="flex items-center gap-1 mt-0.5">
                                <span>📍</span>
                                <span className="max-w-[200px] truncate" title={locationText}>{locationText}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm whitespace-pre-wrap">
                          {mainText}
                        </div>
                        
                        {note.files && note.files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {note.files.map((fileUrl, index) => (
                              <a
                                key={index}
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs text-blue-600 hover:text-blue-800 underline bg-blue-50 rounded px-2 py-1"
                              >
                                📎 {fileUrl.split('/').pop() || 'View attachment'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            
            {/* File Preview */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 p-2 bg-muted rounded-md">
                <div className="text-sm font-medium mb-2">Files to attach:</div>
                <div className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-4 w-4 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add Note Section */}
            <div className="space-y-3 border-t pt-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={
                  isAdmin 
                    ? "Add a note for the selected user..."
                    : "Add your progress notes..."
                }
                className="min-h-20 resize-none"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button 
                  size="sm" 
                  onClick={() => addNote()}
                  disabled={!newNote.trim() || isSaving || (isAdmin && !selectedUser)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {isSaving ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};