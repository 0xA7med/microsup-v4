import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Button from '../Button';

interface MFASetupProps {
}

const MFASetup: React.FC<MFASetupProps> = () => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [factors, setFactors] = useState<any[]>([]);

  // استرجاع عوامل المصادقة الحالية
  const fetchFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setFactors(data.totp || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  // بدء عملية تسجيل عامل مصادقة جديد
  const enrollMFA = async () => {
    setIsEnrolling(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  // التحقق من رمز المصادقة
  const verifyMFA = async () => {
    if (!factorId || !verifyCode) {
      setError('الرجاء إدخال رمز التحقق');
      return;
    }
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode,
      });
      
      if (error) {
        throw error;
      }
      
      setSuccess('تم تفعيل المصادقة الثنائية بنجاح!');
      setQrCode(null);
      setFactorId(null);
      setVerifyCode('');
      fetchFactors();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // إلغاء عامل مصادقة
  const unenrollFactor = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) {
        throw error;
      }
      
      setSuccess('تم إلغاء عامل المصادقة بنجاح');
      fetchFactors();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">إعداد المصادقة الثنائية</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      
      {/* عرض عوامل المصادقة الحالية */}
      {factors.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">عوامل المصادقة الحالية</h3>
          <div className="space-y-2">
            {factors.map((factor) => (
              <div key={factor.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium">{factor.friendly_name || 'تطبيق المصادقة'}</p>
                  <p className="text-sm text-gray-500">تم التفعيل: {new Date(factor.created_at).toLocaleString('ar-SA')}</p>
                </div>
                <Button 
                  onClick={() => unenrollFactor(factor.id)}
                  variant="danger"
                  size="sm"
                >
                  إلغاء
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* إضافة عامل مصادقة جديد */}
      {!qrCode ? (
        <div className="flex justify-center">
          <Button
            onClick={enrollMFA}
            isLoading={isEnrolling}
            disabled={isEnrolling}
            variant="primary"
          >
            إضافة تطبيق مصادقة جديد
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">امسح رمز QR باستخدام تطبيق المصادقة</h3>
          <div className="flex justify-center">
            <img src={qrCode} alt="QR Code" className="border p-2 bg-white" />
          </div>
          <div className="space-y-2">
            <label htmlFor="verifyCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              أدخل الرمز من تطبيق المصادقة
            </label>
            <input
              type="text"
              id="verifyCode"
              value={verifyCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyCode(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder="000000"
            />
          </div>
          <div className="flex justify-between">
            <Button
              onClick={() => {
                setQrCode(null);
                setFactorId(null);
                setVerifyCode('');
              }}
              variant="secondary"
            >
              إلغاء
            </Button>
            <Button
              onClick={verifyMFA}
              isLoading={isVerifying}
              disabled={isVerifying || verifyCode.length < 6}
              variant="primary"
            >
              تحقق وتفعيل
            </Button>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>المصادقة الثنائية توفر طبقة إضافية من الأمان لحسابك. عند تفعيلها، ستحتاج إلى إدخال رمز من تطبيق المصادقة بالإضافة إلى كلمة المرور عند تسجيل الدخول.</p>
      </div>
    </div>
  );
};

export default MFASetup;
