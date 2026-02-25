import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Paperclip, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string | null;
  files: string[];
  message_type: string;
  created_at: string;
  sender_name?: string;
  is_admin?: boolean;
}

interface TaskChatProps {
  taskId: string;
  taskTitle: string;
  assignedUsers: Array<{
    user_id: string;
    full_name: string | null;
    email: string;
  }>;
  isAdmin: boolean;
}

export const TaskChat = ({ taskId, taskTitle, assignedUsers, isAdmin }: TaskChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [availableAdmins, setAvailableAdmins] = useState<Array<{
    user_id: string;
    full_name: string | null;
    email: string;
    role: string;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize selectedUser to first assigned user for admins
  useEffect(() => {
    if (isAdmin && assignedUsers.length > 0 && !selectedUser) {
      setSelectedUser(assignedUsers[0].user_id);
    }
  }, [isAdmin, assignedUsers, selectedUser]);

  // Fetch available admins for users
  useEffect(() => {
    const fetchAvailableAdmins = async () => {
      if (!isAdmin && user && isChatOpen) {
        console.log('Fetching available admins for user:', user.id);
        try {
          // Use the secure database function to get available admins
          // Get available admins from Django backend
          const admins = await apiClient.get<any[]>('/auth/users/', { role: 'admin,super_admin,operations_manager,manager' });
          
          // Convert to expected format
          const formattedAdmins = admins?.map((admin: any) => ({
            user_id: admin.id,
            full_name: admin.profile?.full_name || admin.full_name || null,
            email: admin.email,
            role: admin.roles?.[0]?.role || 'admin'
          })) || [];

          console.log('Final admins list:', formattedAdmins);
          setAvailableAdmins(formattedAdmins);
          
          // Auto-select the first available admin if none selected
          if (formattedAdmins.length > 0 && !selectedAdmin) {
            console.log('Auto-selecting first admin:', formattedAdmins[0]);
            setSelectedAdmin(formattedAdmins[0].user_id);
          }
        } catch (error) {
          console.error('Error fetching available admins:', error);
        }
      }
    };

    fetchAvailableAdmins();
  }, [isAdmin, user, isChatOpen]);

  useEffect(() => {
    if (user && isChatOpen && (selectedUser || (!isAdmin && selectedAdmin))) {
      initializeChatRoom();
    }
    
    // Real-time subscriptions removed - can be added back with WebSocket support later
    return () => {
      // Cleanup if needed
    };
  }, [user, taskId, isChatOpen, selectedUser, selectedAdmin]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChatRoom = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let existingChatId: string | null = null;

      if (isAdmin) {
        // Admin: get chat room with the selected assigned user
        const targetUserId = selectedUser;
        if (targetUserId) {
          // Get or create chat room
          try {
            const chats = await apiClient.get<any[]>('/tasks/chats/', {
              task: taskId,
              user: targetUserId,
              admin: user.id
            });
            
            if (chats && chats.length > 0) {
              existingChatId = chats[0].id;
              console.log('Found existing chat:', existingChatId);
            } else {
              // Create new chat room
              const newChat = await apiClient.post<any>('/tasks/chats/', {
                task: taskId,
                user: targetUserId,
                admin: user.id
              });
              existingChatId = newChat.id;
              console.log('Created new chat:', existingChatId);
            }
          } catch (error) {
            console.error('Error with chat room:', error);
          }
        }
      } else {
        // User: find existing chat room with the selected admin
        console.log('User looking for chat with admin:', selectedAdmin, 'for task:', taskId, 'user:', user.id);
        
        if (selectedAdmin) {
          // Get chat room with selected admin
          try {
            const chats = await apiClient.get<any[]>('/tasks/chats/', {
              task: taskId,
              user: user.id,
              admin: selectedAdmin
            });
            
            if (chats && chats.length > 0) {
              existingChatId = chats[0].id;
              console.log('Found existing chat with admin:', existingChatId);
            } else {
              console.log('No chat found with selected admin:', selectedAdmin);
              existingChatId = null;
            }
          } catch (error) {
            console.error('Error fetching user chat:', error);
            existingChatId = null;
          }
        } else {
          console.log('No admin selected');
          existingChatId = null;
        }
      }

      if (existingChatId) {
        console.log('Setting chat ID:', existingChatId);
        setChatId(existingChatId);
        await fetchMessages(existingChatId);
        // Real-time subscriptions removed - can be added back with WebSocket support later
      } else {
        console.log('No chat room found or created');
        setChatId(null);
      }
    } catch (error) {
      console.error('Error initializing chat room:', error);
      toast.error('Failed to load chat');
      setChatId(null);
    }
    setIsLoading(false);
  };

  const fetchMessages = async (chatRoomId: string) => {
    try {
      const messagesData = await apiClient.get<any[]>('/tasks/chat-messages/', {
        chat: chatRoomId
      });

      // Get sender profiles for messages
      const messagesWithNames = await Promise.all(
        (messagesData || []).map(async (msg) => {
          try {
            const sender = await apiClient.get<any>(`/auth/users/${msg.sender || msg.sender_id}/`);
            const isAdminSender = sender?.roles?.some((r: any) => 
              r.role === 'super_admin' || r.role === 'manager' || r.role === 'operations_manager'
            ) || false;
            
            return {
              ...msg,
              message: msg.message || '',
              files: Array.isArray(msg.files) ? (msg.files as string[]) : [],
              sender_name: sender?.profile?.full_name || sender?.full_name || sender?.email || (isAdminSender ? 'Admin' : 'User'),
              is_admin: isAdminSender
            };
          } catch (error) {
            return {
              ...msg,
              message: msg.message || '',
              files: Array.isArray(msg.files) ? (msg.files as string[]) : [],
              sender_name: 'User',
              is_admin: false
            };
          }
        })
      );

      setMessages(messagesWithNames);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Real-time subscriptions removed - can be added back with WebSocket support later
  const setupRealtimeSubscription = (chatRoomId: string) => {
    // WebSocket subscription can be implemented here later
    console.log('Real-time subscription setup for chat:', chatRoomId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId) return;

    try {
      await apiClient.post('/tasks/chat-messages/', {
        chat: chatId,
        sender: user.id,
        message: newMessage.trim(),
        message_type: 'text',
        files: []
      });

      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const sendFileMessage = async () => {
    if (selectedFiles.length === 0 || !user || !chatId) return;

    try {
      const fileUrls: string[] = [];

      for (const file of selectedFiles) {
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

      // Send file message
      await apiClient.post('/tasks/chat-messages/', {
        chat: chatId,
        sender: user.id,
        message: `Shared ${selectedFiles.length} file(s)`,
        files: fileUrls,
        message_type: 'file'
      });

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('Files sent');
    } catch (error) {
      console.error('Error sending files:', error);
      toast.error('Failed to send files');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircle className="h-4 w-4 mr-1" />
          Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Task Chat: {taskTitle}</span>
          </DialogTitle>
          
          {/* User Selection for Admins */}
          {isAdmin && assignedUsers.length > 0 && (
            <div className="mb-3">
              <label className="text-sm font-medium mb-2 block">Select User to Chat With:</label>
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

          {/* Admin Selection for Users */}
          {!isAdmin && availableAdmins.length > 0 && (
            <div className="mb-3">
              <label className="text-sm font-medium mb-2 block">Select Admin to Chat With:</label>
              <Select value={selectedAdmin || ""} onValueChange={setSelectedAdmin}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an admin..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAdmins.map((admin) => (
                    <SelectItem key={admin.user_id} value={admin.user_id}>
                      {admin.full_name || admin.email} {admin.role === 'super_admin' ? '(Super Admin)' : '(Manager)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            {isAdmin 
              ? selectedUser 
                ? `Chatting with: ${assignedUsers.find(u => u.user_id === selectedUser)?.full_name || assignedUsers.find(u => u.user_id === selectedUser)?.email}`
                : 'Select a user to chat with'
              : selectedAdmin
                ? `Chatting with: ${availableAdmins.find(a => a.user_id === selectedAdmin)?.full_name || availableAdmins.find(a => a.user_id === selectedAdmin)?.email} ${availableAdmins.find(a => a.user_id === selectedAdmin)?.role === 'super_admin' ? '(Super Admin)' : '(Manager)'}`
                : 'Select an admin to chat with'
            }
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : !chatId ? (
          <div className="text-center py-8 text-muted-foreground flex-1 space-y-3">
            <div className="text-lg">💬</div>
            {isAdmin ? (
              <div>
                <div className="font-medium">No chat room created yet</div>
                <div className="text-sm">Select a user from the dropdown above to start a conversation</div>
              </div>
            ) : (
              <div>
                <div className="font-medium">Chat not available yet</div>
                <div className="text-sm">Select an admin from the dropdown above to start a conversation</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages Area */}
            <ScrollArea className="flex-1 pr-2 mb-4">
              <div className="space-y-3 p-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`flex items-start space-x-2 max-w-[80%] ${
                      message.sender_id === user?.id ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className={`text-xs ${
                          message.is_admin 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white'
                            : 'bg-gradient-to-br from-blue-500 to-teal-600 text-white'
                        }`}>
                          {getInitials(message.sender_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium opacity-70">
                            {message.sender_name}
                            {message.is_admin && <Badge variant="outline" className="ml-1 text-xs">Admin</Badge>}
                          </span>
                          <span className="text-xs opacity-50">
                            {format(new Date(message.created_at), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        
                        <p className="text-sm break-words">{message.message || ''}</p>
                        
                        {message.files && message.files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.files.map((fileUrl, index) => (
                              <a
                                key={index}
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs underline opacity-80 hover:opacity-100 bg-white/10 rounded px-2 py-1"
                              >
                                📎 {fileUrl.split('/').pop() || 'View file'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* File Preview */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 p-2 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Files to send:</span>
                  <Button
                    variant="ghost" 
                    size="sm"
                    onClick={sendFileMessage}
                    className="text-xs"
                  >
                    Send Files
                  </Button>
                </div>
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
            
            {/* Message Input */}
            <div className="flex space-x-2 border-t pt-3">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1"
              />
              
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
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};