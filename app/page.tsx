import UploadCard from '@/components/upload/UploadCard';

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-brand-background)] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle decorative background elements aligned with premium SaaS feel */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-brand-gold)]/20 blur-3xl" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[var(--color-brand-success)]/30 blur-3xl" />
      </div>
      
      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="mb-10 text-center animate-fade-in">
          
        </div>
        
        <UploadCard />
      </div>
    </main>
  );
}