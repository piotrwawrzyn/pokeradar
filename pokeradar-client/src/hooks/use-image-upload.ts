import { useState, type ChangeEvent } from 'react';

export function useImageUpload() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear input to detach File object and prevent ERR_UPLOAD_FILE_CHANGED
      e.target.value = '';
    } else {
      setImagePreview(null);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  return { imageFile, imagePreview, handleImageChange, reset };
}
