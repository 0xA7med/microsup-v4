import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, Building, Phone, Calendar, MapPin, Monitor, Tag, User, Info, PlusCircle } from 'lucide-react';
import Button from './ui/Button';
import { ClientType } from '@/pages/ClientsList';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';
import { format, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

// تعريف واجهة نموذج الخدمة
interface ServiceModel {
  id: string;
  name: string;
  description?: string;
  price?: number;  
  start_date?: string;
  end_date?: string;
}

interface ClientDetailsModalProps {
  client: ClientType;
  onClose: () => void;
  onEdit: (client: ClientType) => void;
  onDelete: (clientId: string) => void;
  onAddService?: (clientId: string) => void;
  onRemoveService?: (clientId: string, serviceId: string) => void;
}

export default function ClientDetailsModal({
  client,
  onClose,
  onEdit,
  onDelete,
  onAddService,
  onRemoveService
}: ClientDetailsModalProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isRemoveServiceDialogOpen, setIsRemoveServiceDialogOpen] = useState(false);
  const { t } = useTranslation();

  // التحقق من وضع الظلام
  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    updateTheme();
    
    // الاستماع لتغييرات السمة
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // تنسيق التاريخ مع معالجة أفضل للأخطاء
  const formatDate = (dateString?: string) => {
    if (!dateString) return t('common.notAvailable', 'غير متوفر');
    
    try {
      const date = parseISO(dateString);
      
      if (!isValid(date)) {
        return t('common.invalidDate', 'تاريخ غير صالح');
      }
      
      return format(date, 'yyyy-MM-dd', { locale: ar });
    } catch (error) {
      console.error('خطأ في تنسيق التاريخ:', error);
      return t('common.invalidDate', 'تاريخ غير صالح');
    }
  };

  // معالجي الأحداث
  const handleEdit = () => {
    onEdit(client);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleAddServiceClick = () => {
    if (onAddService) {
      onAddService(client.id);
    } else {
      console.log('إضافة خدمة جديدة - وظيفة المعالج غير متوفرة');
    }
  };

  const handleRemoveServiceClick = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setIsRemoveServiceDialogOpen(true);
  };

  const confirmRemoveService = () => {
    if (onRemoveService && selectedServiceId) {
      onRemoveService(client.id, selectedServiceId);
      setIsRemoveServiceDialogOpen(false);
      setSelectedServiceId(null);
    }
  };

  // التحقق من وجود بيانات العميل
  if (!client) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
        <div className={`max-w-md w-full rounded-2xl p-6 text-center ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
          <p>{t('errors.clientNotFound', 'لم يتم العثور على بيانات العميل')}</p>
          <Button
            variant="secondary"
            onClick={onClose}
            className="mt-4"
          >
            {t('actions.close', 'إغلاق')}
          </Button>
        </div>
      </div>
    );
  }

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
            onClick={onClose}
            className="!p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            aria-label={t('actions.close', 'إغلاق')}
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
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.client_name || ''}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Building className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.organization', 'اسم المؤسسة')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.organization_name || ''}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Tag className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.activityType', 'نوع النشاط')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.activity_type || ''}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Phone className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.phone', 'رقم الهاتف')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.phone || ''}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <MapPin className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.address', 'العنوان')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.address || ''}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Monitor className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.deviceCount', 'عدد الأجهزة')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {client.device_count || '0'}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.subscriptionStart', 'بداية الاشتراك')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {formatDate(client.subscription_start)}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.software_version', 'نسخة البرنامج')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {formatDate(client.subscription_start)}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  {t('clientDetails.subscriptionEnd', 'نهاية الاشتراك')}
                </label>
                <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {formatDate(client.subscription_end)}
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <Info className="inline-block w-4 h-4 mr-1" />
              {t('clientDetails.notes', 'ملاحظات')}
            </label>
            <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'} min-h-[80px]`}>
              {client.notes || ''}
            </div>
          </div>

          {/* قسم الخدمات */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className={`text-md font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {t('clientDetails.services', 'الخدمات')}
              </h4>
              <Button 
                variant="secondary" 
                onClick={handleAddServiceClick}
                className="flex items-center text-sm py-1"
                disabled={!onAddService}
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                <span>{t('actions.addService', 'إضافة خدمة')}</span>
              </Button>
            </div>
            
            {client.services && client.services.length > 0 ? (
              <div className={`rounded-md overflow-hidden border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <table className="w-full">
                  <thead className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                    <tr>
                      <th className="py-2 px-4 text-right">{t('serviceDetails.name', 'اسم الخدمة')}</th>
                      <th className="py-2 px-4 text-right">{t('serviceDetails.description', 'الوصف')}</th>      
                      <th className="py-2 px-4 text-right">{t('serviceDetails.price', 'السعر')}</th>
                      <th className="py-2 px-4 text-right">{t('serviceDetails.period', 'الفترة')}</th>
                      <th className="py-2 px-4 text-center">{t('actions.actions', 'الإجراءات')}</th>
                    </tr>
                  </thead>
                  <tbody className={`${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {client.services.map((service) => (
                      <tr key={service.id} className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-2 px-4">{service.name}</td>
                        <td className="py-2 px-4">{service.description || t('common.notAvailable', 'غير متوفر')}</td>
                        <td className="py-2 px-4 text-left">
                          {service.price !== undefined
                            ? `${service.price.toLocaleString()} ${t('common.currency', 'ريال')}`
                            : t('common.notAvailable', 'غير متوفر')}
                        </td>
                        <td className="py-2 px-4">
                          {service.start_date && service.end_date 
                            ? `${formatDate(service.start_date)} - ${formatDate(service.end_date)}` 
                            : t('common.notAvailable', 'غير متوفر')}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <Button
                            variant="danger"
                            onClick={() => handleRemoveServiceClick(service.id)}
                            className="inline-flex items-center py-1 px-2 text-sm"
                            disabled={!onRemoveService}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            <span>{t('actions.remove', 'إزالة')}</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`p-4 text-center rounded-md ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                {t('clientDetails.noServices', 'لا توجد خدمات مسجلة لهذا العميل')}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex items-center"
            >
              <X className="w-4 h-4 ml-1" />
              <span>{t('actions.close', 'إغلاق')}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleEdit}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 ml-1" />
              <span>{t('actions.edit', 'تعديل')}</span>
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 ml-1" />
              <span>{t('actions.delete', 'حذف')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* مربع حوار تأكيد الحذف */}
      <AlertDialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 dark:bg-black/70" />
          <AlertDialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <AlertDialog.Title className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t('deleteConfirmation.title', 'تأكيد الحذف')}
            </AlertDialog.Title>
            <AlertDialog.Description className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t('deleteConfirmation.description', 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')}
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">
                  <X className="w-4 h-4 ml-1" />
                  <span>{t('actions.cancel', 'إلغاء')}</span>
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={() => {
                  onDelete(client.id);
                  setIsDeleteDialogOpen(false);
                }}>
                  <Trash2 className="w-4 h-4 ml-1" />
                  <span>{t('actions.confirmDelete', 'تأكيد الحذف')}</span>
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* مربع حوار تأكيد إزالة الخدمة */}
      <AlertDialog.Root open={isRemoveServiceDialogOpen} onOpenChange={setIsRemoveServiceDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 dark:bg-black/70" />
          <AlertDialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <AlertDialog.Title className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t('removeServiceConfirmation.title', 'تأكيد إزالة الخدمة')}
            </AlertDialog.Title>
            <AlertDialog.Description className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t('removeServiceConfirmation.description', 'هل أنت متأكد من رغبتك في إزالة هذه الخدمة من هذا العميل؟')}
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">
                  <X className="w-4 h-4 ml-1" />
                  <span>{t('actions.cancel', 'إلغاء')}</span>
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={confirmRemoveService}>
                  <Trash2 className="w-4 h-4 ml-1" />
                  <span>{t('actions.confirmRemove', 'تأكيد الإزالة')}</span>
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}