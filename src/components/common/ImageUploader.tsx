import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Id } from '../../../convex/_generated/dataModel';

interface ImageUploaderProps {
  /** Convex mutation that returns a short-lived upload URL (e.g. `useMutation(api.trades.generateUploadUrl)`). */
  generateUploadUrl: () => Promise<string>;
  /** Called once the file has finished uploading to Convex storage. */
  onUploaded: (storageId: Id<'_storage'>, file: File) => void | Promise<void>;
  label?: string;
  compact?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  generateUploadUrl,
  onUploaded,
  label = 'Upload',
  compact = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const uploadUrl = await generateUploadUrl();
      setProgress(10);

      const storageId = await new Promise<Id<'_storage'>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 80) + 10; // 10-90%
            setProgress(pct);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            setProgress(95);
            resolve(response.storageId as Id<'_storage'>);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await onUploaded(storageId, file);
      setProgress(100);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 400);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative cursor-pointer rounded-xl border transition-colors ${
        compact ? 'py-2' : 'py-6'
      } text-center ${
        dragOver ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
      }`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={uploading}
      />
      {uploading ? (
        <div className="space-y-1.5 px-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Uploading</span>
            <span className="text-[11px] font-medium text-slate-700">{progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'flex-col gap-1'}`}>
          <Upload className={compact ? 'w-3.5 h-3.5 text-slate-400' : 'w-6 h-6 text-slate-400'} />
          <span className="text-xs font-medium text-slate-500">
            {dragOver ? 'Drop here' : label}
          </span>
        </div>
      )}
    </div>
  );
};
