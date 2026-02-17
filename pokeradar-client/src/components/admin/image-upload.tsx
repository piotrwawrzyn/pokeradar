import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChangeEvent } from 'react';

interface ImageUploadProps {
  id: string;
  label: string;
  imagePreview: string | null;
  currentImageUrl?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
}

export function ImageUpload({
  id,
  label,
  imagePreview,
  currentImageUrl,
  onChange,
  required,
  disabled,
}: ImageUploadProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type="file"
        accept="image/png,image/webp"
        onChange={onChange}
        required={required}
        disabled={disabled}
      />
      {imagePreview ? (
        <img
          src={imagePreview}
          alt="Preview"
          className="mt-3 h-24 w-24 rounded object-cover border-2 border-border"
        />
      ) : currentImageUrl && (
        <img
          src={currentImageUrl}
          alt="Current"
          className="mt-3 h-24 w-24 rounded object-cover border-2 border-muted"
        />
      )}
    </div>
  );
}
