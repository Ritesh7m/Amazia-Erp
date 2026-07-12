import UploadCard from '@/components/upload/UploadCard';

export default function UnifiedUploadPage() {
  return (
    <div className="w-full flex justify-center py-6">
      <div className="w-full max-w-2xl">
        {/* Your UploadCard handles the tabs for FedEx vs Etsy natively! */}
        <UploadCard />
      </div>
    </div>
  );
}