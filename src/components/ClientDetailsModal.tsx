import React, { useState } from 'react';
import { X, Edit, Trash2, Building, Phone, Calendar, MapPin, Monitor, Tag, User, Info, PlusCircle } from 'lucide-react';
import Button from './ui/Button';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface ClientDetailsModalProps {
  client: any;
  onClose: () => void;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
}

export default function ClientDetailsModal({ client, onClose, onEdit, onDelete }: ClientDetailsModalProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { t } = useTranslation();

  React.useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch (error) {
      return dateString || 'N/A';
    }
  };

  const handleEdit = () => {
    onEdit(client);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleAddServiceClick = () => {
    // سيتم تنفيذ إضافة خدمة جديدة في المستقبل
    console.log('إضافة خدمة جديدة');
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
      <div className={`max-w-4xl w-full rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex justify-between items-center">
          <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('clientDetails.title', 'تفاصيل العميل')}
          </h3>
          <Button
            variant="secondary"
            onClick={() => onClose()}
            className="!p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">{t('actions.close', 'إغلاق')}</span>
          </Button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <User className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.name', 'اسم العميل')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.client_name || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Building className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.organization', 'اسم المؤسسة')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.organization_name || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Tag className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.activityType', 'نوع النشاط')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.activity_type || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Phone className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.phone', 'رقم الهاتف')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.phone || 'N/A'}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <MapPin className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.address', 'العنوان')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.address || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Monitor className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.deviceCount', 'عدد الأجهزة')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {client?.device_count || '0'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.subscriptionStart', 'بداية الاشتراك')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {formatDate(client?.subscription_start)}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.subscriptionEnd', 'نهاية الاشتراك')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {formatDate(client?.subscription_end)}
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <Info className="inline-block w-4 h-4 mr-1" />
              {t('clientDetails.notes', 'ملاحظات')}
            </label>
            <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} min-h-[80px]`}>
              {client?.notes || t('clientDetails.noNotes', 'لا توجد ملاحظات')}
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="secondary"
              onClick={() => onClose()}
              className="flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              <span>{t('actions.close', 'إغلاق')}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleEdit()}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              <span>{t('actions.edit', 'تعديل')}</span>
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDelete()}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              <span>{t('actions.delete', 'حذف')}</span>
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleAddServiceClick}
              className="flex items-center"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              <span>{t('actions.addService', 'إضافة خدمة')}</span>
            </Button>
            <Button
              variant="danger"
              className="flex items-center"
              onClick={() => console.log('إزالة الخدمة')}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              <span>{t('actions.removeService', 'إزالة الخدمة')}</span>
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 dark:bg-black/70" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
            <AlertDialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              {t('deleteConfirmation.title', 'تأكيد الحذف')}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-gray-600 dark:text-gray-300">
              {t('deleteConfirmation.description', 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')}
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">
                  <X className="w-4 h-4 mr-1" />
                  <span>{t('actions.cancel', 'إلغاء')}</span>
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={() => {
                  onDelete(client.id);
                  setIsDeleteDialogOpen(false);
                }}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  <span>{t('actions.confirmDelete', 'تأكيد الحذف')}</span>
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
