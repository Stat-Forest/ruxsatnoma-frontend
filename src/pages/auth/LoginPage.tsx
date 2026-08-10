import React, { useState } from 'react';
import {
  Trees,
  UserCheck,
  FileKey,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, FormField } from '../../components/ui/FormControls';

export interface LoginPageProps {
  onSuccessLogin?: (role?: string) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccessLogin, onNavigate }) => {
  const [authMethod, setAuthMethod] = useState<'oneid' | 'eimzo' | 'password'>('oneid');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCert, setSelectedCert] = useState('cert1');
  const [isLoading, setIsLoading] = useState(false);

  const mockCerts = [
    { id: 'cert1', owner: 'ABDULLAYEV ALISHER NABIYEVICH', tin: '304918234', validUntil: '15.11.2027', issuer: 'OʻzR STO ST-1' },
    { id: 'cert2', owner: 'OOO "BURCHMULLA LESKHOZ"', tin: '200194812', validUntil: '20.04.2028', issuer: 'OʻzR STO ST-2' },
  ];

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccessLogin?.('applicant');
    }, 1200);
  };

  return (
    <div className="max-w-md mx-auto py-8 space-y-6 font-sans">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#2E7D4F] text-white flex items-center justify-center font-bold mx-auto shadow-md">
          <Trees className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1F24]">Tizimga Kirish</h1>
        <p className="text-xs text-[#5A646D]">
          Ruxsatnoma axborot tizimiga kirish uchun autentifikatsiya usulini tanlang.
        </p>
      </div>

      {/* Auth Method Selector Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-[#F8F9FA] p-1 border border-[#767F87] rounded-xl text-xs font-semibold">
        <button
          onClick={() => setAuthMethod('oneid')}
          className={`py-2 px-1 rounded-lg transition-colors flex flex-col items-center gap-1 ${
            authMethod === 'oneid' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
          }`}
        >
          <UserCheck className="w-4 h-4" /> OneID
        </button>

        <button
          onClick={() => setAuthMethod('eimzo')}
          className={`py-2 px-1 rounded-lg transition-colors flex flex-col items-center gap-1 ${
            authMethod === 'eimzo' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
          }`}
        >
          <FileKey className="w-4 h-4" /> E-IMZO
        </button>

        <button
          onClick={() => setAuthMethod('password')}
          className={`py-2 px-1 rounded-lg transition-colors flex flex-col items-center gap-1 ${
            authMethod === 'password' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
          }`}
        >
          <KeyRound className="w-4 h-4" /> Login/Parol
        </button>
      </div>

      {/* Auth Form Container */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-sm space-y-6">
        {/* METHOD 1: OneID Auth */}
        {authMethod === 'oneid' && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl text-xs text-[#123522] space-y-2">
              <span className="font-bold block text-sm">Yagona Identifikatsiya Tizimi (OneID)</span>
              <p className="leading-relaxed">
                Jismoniy va yuridik shaxslar uchun OneID davlat portali orqali tezkor va xavfsiz autentifikatsiya.
              </p>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isLoading}
              onClick={handleLoginSubmit}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              OneID Orqali Kirish
            </Button>
          </div>
        )}

        {/* METHOD 2: E-IMZO Digital Key Auth */}
        {authMethod === 'eimzo' && (
          <div className="space-y-4">
            <span className="text-xs font-semibold text-[#5A646D] uppercase tracking-wider block">
              E-IMZO Kalitini Tanlang
            </span>

            <div className="space-y-2">
              {mockCerts.map((cert) => (
                <label
                  key={cert.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    selectedCert === cert.id
                      ? 'border-[#2E7D4F] bg-[#F0F7F1]/60'
                      : 'border-[#767F87] bg-white hover:bg-[#F8F9FA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="cert"
                    value={cert.id}
                    checked={selectedCert === cert.id}
                    onChange={() => setSelectedCert(cert.id)}
                    className="mt-1 accent-[#2E7D4F]"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-[#1A1F24] block">{cert.owner}</span>
                    <span className="text-[#5A646D] block">STIR/PINFL: {cert.tin}</span>
                    <span className="text-[#767F87] block">Amal qilish muddati: {cert.validUntil} ({cert.issuer})</span>
                  </div>
                </label>
              ))}
            </div>

            <Button
              variant="success"
              fullWidth
              size="lg"
              isLoading={isLoading}
              onClick={handleLoginSubmit}
            >
              E-IMZO Kaliti Bilan Kirish
            </Button>
          </div>
        )}

        {/* METHOD 3: Standard Login / Password */}
        {authMethod === 'password' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <FormField label="Login (JSHSHIR / STIR yoki Email)" required>
              <Input
                placeholder="Masalan: 304918234"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                touchSize
              />
            </FormField>

            <FormField label="Parol" required>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                touchSize
              />
            </FormField>

            <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isLoading}>
              Kirish
            </Button>
          </form>
        )}
      </div>

      {/* Footer Navigation link */}
      <div className="text-center text-xs text-[#5A646D]">
        Hisobingiz yoʻqmi?{' '}
        <button
          onClick={() => onNavigate?.('auth_register')}
          className="font-bold text-[#2E7D4F] hover:underline"
        >
          Roʻyxatdan oʻtish
        </button>
      </div>
    </div>
  );
};
