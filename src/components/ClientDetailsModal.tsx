import React, { useState } from 'react';
import { X, Edit, Trash2 } from 'lucide-react';
import Button from './ui/Button';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface ClientDetailsModalProps {
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  onClose: () => void;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
}

export default function ClientDetailsModal({ client, onClose, onEdit, onDelete }: ClientDetailsModalProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  React.useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
      <div className={`max-w-2xl w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex justify-between items-center">
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            تفاصيل العميل
          </h3>
          <Button
            variant="secondary"
            icon={X}
            onClick={onClose}
            className="!p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            إغلاق
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                الاسم
              </label>
              <div className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {client.name}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                البريد الإلكتروني
              </label>
              <div className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {client.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                الهاتف
              </label>
              <div className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {client.phone}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              icon={Edit}
              onClick={() => onEdit(client)}
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              تعديل
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setIsDeleteDialogOpen(true)}
              className="hover:bg-red-600"
            >
              حذف
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 dark:bg-black/70" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
            <AlertDialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              هل أنت متأكد؟
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-gray-600 dark:text-gray-300">
              سيتم حذف العميل بشكل دائم ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">إلغاء</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={() => {
                  onDelete(client.id);
                  setIsDeleteDialogOpen(false);
                }}>
                  حذف
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
