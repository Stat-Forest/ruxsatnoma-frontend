import React, { useState } from 'react';
import {
  Trees,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Lock,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, FormField, RadioGroup } from '../../components/ui/FormControls';
import { Stepper } from '../../components/ui/Navigation';

export interface RegisterPageProps {
  onSuccessRegister?: () => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccessRegister, onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicantType, setApplicantType] = useState('individual');
  const [pinflOrTin, setPinflOrTin] = useState('30491823400129');
  const [phone, setPhone] = useState('+998 90 123-45-67');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [fetchedUserData, setFetchedUserData] = useState<{
    fullName: string;
    passportNo: string;
    address: string;
  } | null>(null);

  const handleFetchData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setFetchedUserData({
        fullName: 'ABDULLAYEV ALISHER NABIYEVICH',
        passportNo: 'FA 1234567',
        address: 'Toshkent v., Boʻstonliq t., Burchmulla QFY',
      });
      setCurrentStep(2);
    }, 1000);
  };

  const handleVerifyOtp = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep(3);
    }, 1000);
  };

  const handleFinalRegister = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccessRegister?.();
    }, 1200);
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6 font-sans">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#2E7D4F] text-white flex items-center justify-center font-bold mx-auto shadow-md">
          <Trees className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1F24]">Roʻyxatdan Oʻtish</h1>
        <p className="text-xs text-[#5A646D]">
          Oʻrmon xoʻjaligi ruxsatnomalar tizimida yangi hisob yaratish.
        </p>
      </div>

      {/* Stepper Wizard */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <Stepper
          steps={[
            { id: 1, title: 'Shaxsiy Maʼlumot', description: 'JSHSHIR / STIR' },
            { id: 2, title: 'SMS Tasdiq', description: 'OTP Parol' },
            { id: 3, title: 'Parol Oʻrnatish', description: 'Xavfsiz hisob' },
          ]}
          currentStep={currentStep}
        />
      </div>

      {/* Form Steps */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* STEP 1: PINFL / STIR Lookup */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <RadioGroup
              name="regApplicantType"
              selectedValue={applicantType}
              onChange={setApplicantType}
              options={[
                { value: 'individual', label: 'Jismoniy shaxs (Fuqaro)', hint: 'JSHSHIR 14 raqamli kod' },
                { value: 'business', label: 'Yuridik shaxs (Tadbirkor / Xoʻjalik)', hint: 'STIR 9 raqamli STIR kodi' },
              ]}
            />

            <FormField
              label={applicantType === 'individual' ? 'JSHSHIR kodi (14 raqam)' : 'STIR kodi (9 raqam)'}
              required
              helperText="Davlat reestridan avtomatik maʼlumot olinadi"
            >
              <Input
                value={pinflOrTin}
                onChange={(e) => setPinflOrTin(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                touchSize
              />
            </FormField>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isLoading}
              onClick={handleFetchData}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Davlat Reestridan Izlash
            </Button>
          </div>
        )}

        {/* STEP 2: Verify Fetched Info & Send SMS OTP */}
        {currentStep === 2 && fetchedUserData && (
          <div className="space-y-6">
            <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl space-y-2 text-xs">
              <span className="font-bold text-[#123522] block text-sm">Topilgan Maʼlumotlar:</span>
              <div>F.I.SH.: <b className="text-[#1A1F24]">{fetchedUserData.fullName}</b></div>
              <div>Pasport: <b className="text-[#1A1F24]">{fetchedUserData.passportNo}</b></div>
              <div>Manzil: <b className="text-[#1A1F24]">{fetchedUserData.address}</b></div>
            </div>

            <FormField label="Telefon Raqam" required helperText="SMS tasdiqlash kodi yuboriladi">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Smartphone className="w-4 h-4" />}
                touchSize
              />
            </FormField>

            <FormField label="SMS OTP Kod" required helperText="Telefoningizga yuborilgan 4 xonali kod">
              <Input
                placeholder="1234"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                touchSize
              />
            </FormField>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setCurrentStep(1)}>
                Orqaga
              </Button>
              <Button
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
                onClick={handleVerifyOtp}
              >
                Tasdiqlash
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Password Setup */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs text-[#15803D] bg-[#F0F7F1] p-3 rounded-lg border border-[#D9EBDC]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Telefon raqami muvaffaqiyatli tasdiqlandi. Hisobingiz uchun kuchli parol belgilang.</span>
            </div>

            <FormField label="Parol" required helperText="Kamida 8 ta belgi, raqam va harf">
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                touchSize
              />
            </FormField>

            <FormField label="Parolni takrorlang" required>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                touchSize
              />
            </FormField>

            <Button
              variant="success"
              fullWidth
              size="lg"
              isLoading={isLoading}
              onClick={handleFinalRegister}
            >
              Roʻyxatdan Oʻtishni Yakunlash
            </Button>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[#5A646D]">
        Akkauntingiz bormi?{' '}
        <button
          onClick={() => onNavigate?.('auth_login')}
          className="font-bold text-[#2E7D4F] hover:underline"
        >
          Tizimga kirish
        </button>
      </div>
    </div>
  );
};
