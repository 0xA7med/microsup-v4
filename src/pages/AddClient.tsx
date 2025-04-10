import React, { useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
// تم إزالة استيراد format لأنه لم يعد مستخدماً بعد تنظيف قاعدة البيانات
import CustomerField from '../components/CustomerField';
import CustomerInput from '../components/CustomerInput';
import CustomerTextArea from '../components/CustomerTextArea';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import ClientDevicesForm from '../components/ClientDevicesForm';
import { DeviceType } from '../types/device.types';

interface ClientType {
  id?: string;
  client_name: string;
  organization_name: string;
  activity_type: string;
  phone: string;
  phone2?: string;
  address: string;
  notes?: string;
  agent_id?: string;
  active_devices_count?: number;
}



export const AddClient: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);

  // بيانات العميل الأساسية
  const [formData, setFormData] = useState<Partial<ClientType>>({
    client_name: '',
    organization_name: '',
    activity_type: '',
    phone: '',
    phone2: '',
    address: '',
    notes: ''
  });
  
  // بيانات أجهزة العميل
  const [devices, setDevices] = useState<DeviceType[]>([]);

  // معالجة تغيير حقول النموذج
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };



  // إرسال النموذج
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t('messages.notLoggedIn', 'يجب تسجيل الدخول أولاً'));
      return;
    }

    // التحقق من البيانات المطلوبة
    if (!formData.client_name || !formData.phone) {
      toast.error(t('messages.requiredFields', 'يرجى ملء جميع الحقول المطلوبة'));
      return;
    }

    // التحقق من وجود جهاز واحد على الأقل
    if (devices.length === 0) {
      toast.error(t('messages.deviceRequired', 'يجب إضافة جهاز واحد على الأقل'));
      return;
    }

    // التحقق من أن كل جهاز له رمز تفعيل
    for (let i = 0; i < devices.length; i++) {
      if (!devices[i].activation_code) {
        toast.error(t('messages.deviceActivationCodeRequired', 'يرجى إدخال رمز تفعيل للجهاز رقم {{number}}', { number: i + 1 }));
        return;
      }
    }

    setLoading(true);

    try {
      // إعداد بيانات العميل للإرسال
      const clientDataToSubmit = { ...formData };
      if (!clientDataToSubmit.phone2) {
        delete clientDataToSubmit.phone2;
      }
      
      // بيانات العميل النهائية مع الحد الأدنى من الحقول المطلوبة
      const clientData = {
        ...clientDataToSubmit,
        agent_id: user.id
        // تمت إزالة الإشارة إلى الأعمدة غير الموجودة في قاعدة البيانات
      };

      // إرسال بيانات العميل إلى قاعدة البيانات
      const { data: clientData_, error: clientError } = await supabase
        .from('clients')
        .insert([clientData])
        .select();

      if (clientError) throw clientError;
      
      if (clientData_ && clientData_.length > 0) {
        const clientId = clientData_[0].id;
        
        // إضافة الأجهزة للعميل
        const devicesWithClientId = devices.map(device => ({
          ...device,
          client_id: clientId
        }));
        
        const { error: devicesError } = await supabase
          .from('devices')
          .insert(devicesWithClientId);
          
        if (devicesError) throw devicesError;
      }

      toast.success(t('messages.clientAdded', 'تمت إضافة العميل بنجاح'));
      navigate('/clients');
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error(t('messages.errorAddingClient', 'حدث خطأ أثناء إضافة العميل'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('client.addNewClient', 'إضافة عميل جديد')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* بيانات العميل الأساسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اسم العميل */}
            <CustomerField label={t('client.name', 'اسم العميل')} children={
              <CustomerInput
                type="text"
                name="client_name"
                value={formData.client_name}
                onChange={handleChange}
                required
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* اسم المؤسسة */}
            <CustomerField label={t('client.organization', 'اسم المؤسسة')} children={
              <CustomerInput
                type="text"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleChange}
                required
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* نوع النشاط */}
            <CustomerField label={t('client.activityType', 'نوع النشاط')} children={
              <CustomerInput
                type="text"
                name="activity_type"
                value={formData.activity_type}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* العنوان */}
            <CustomerField label={t('client.address', 'العنوان')} children={
              <CustomerInput
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* رقم الهاتف */}
            <CustomerField label={t('client.phone', 'رقم الهاتف')} children={
              <CustomerInput
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* رقم هاتف ثاني */}
            <CustomerField label={t('client.phone2', 'رقم هاتف ثاني (اختياري)')} children={
              <CustomerInput
                type="text"
                name="phone2"
                value={formData.phone2 || ''}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />



            {/* ملاحظات */}
            <CustomerField label={t('client.notes', 'ملاحظات')} className="md:col-span-2" children={
              <CustomerTextArea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={4}
                isEditing={true}
                className="text-lg border-gray-300 dark:border-gray-600"
              />
            } />
          </div>
          
          <ClientDevicesForm 
            isNewClient={true}
            onDevicesChange={setDevices}
          />

          {/* أزرار الإرسال */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t('actions.save', 'حفظ')}
                </div>
              ) : (
                t('actions.save', 'حفظ')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};