import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, File, FileText, Image, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUpload?: (file: File) => Promise<string>;
  onFileRemove?: (fileUrl: string) => void;
  files?: string[];
  disabled?: boolean;
  maxFiles?: number;
  acceptedFileTypes?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  onFileRemove,
  files = [],
  disabled = false,
  maxFiles = 5,
  acceptedFileTypes = "image/*,.pdf,.doc,.docx,.txt",
  className
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    if (selectedFiles.length === 0) return;
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "You need to be logged in to upload files",
          variant: "destructive",
        });
        return;
      }

      for (const file of selectedFiles) {
        if (onFileUpload) {
          // Create FormData for file upload
          const formData = new FormData();
          formData.append('file', file);
          
          try {
            // Upload file to Django backend
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/tasks/attachments/`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiClient.getToken()}`
              },
              body: formData
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            const result = await response.json();
            await onFileUpload(file);
          } catch (error: any) {
            toast({
              title: "Upload failed",
              description: error.message || "Failed to upload file",
              variant: "destructive",
            });
            continue;
          }
        }
      }
    } catch (error) {
      console.error('File upload failed:', error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <Image className="h-4 w-4" />;
    }
    
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    
    if (['doc', 'docx'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    
    return <File className="h-4 w-4" />;
  };

  const getFileName = (fileUrl: string) => {
    return fileUrl.split('/').pop() || 'Unknown file';
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Upload Button */}
      {!disabled && files.length < maxFiles && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFileTypes}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileUrl, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getFileIcon(fileUrl)}
                  <span className="text-sm truncate">{getFileName(fileUrl)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(fileUrl, '_blank')}
                    className="h-6 w-6 p-0"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  {!disabled && onFileRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFileRemove(fileUrl)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {files.length === 0 && disabled && (
        <p className="text-sm text-gray-500 text-center py-4">No files uploaded</p>
      )}
    </div>
  );
};