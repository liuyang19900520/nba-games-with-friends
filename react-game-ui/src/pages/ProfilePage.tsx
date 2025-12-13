import { Header } from '@/components/layout/Header';

export function ProfilePage() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <Header title="Profile" showSettings />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-[90px]">
        <div className="flex items-center justify-center h-full">
          <h1 className="text-2xl font-bold text-white">Profile Page</h1>
        </div>
      </div>
    </div>
  );
}

