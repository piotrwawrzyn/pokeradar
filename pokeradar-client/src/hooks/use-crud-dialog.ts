import { useState } from 'react';

export function useCrudDialog<T>() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);

  const openCreate = (resetForm: () => void) => {
    setSelected(null);
    resetForm();
    setEditDialogOpen(true);
  };

  const openEdit = (item: T, populateForm: (item: T) => void) => {
    setSelected(item);
    populateForm(item);
    setEditDialogOpen(true);
  };

  const openDelete = (item: T) => {
    setSelected(item);
    setDeleteDialogOpen(true);
  };

  const closeEdit = () => setEditDialogOpen(false);
  const closeDelete = () => setDeleteDialogOpen(false);

  return {
    editDialogOpen,
    deleteDialogOpen,
    selected,
    openCreate,
    openEdit,
    openDelete,
    closeEdit,
    closeDelete,
  };
}
