import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazia ERP",
  description: "Enterprise Billing Import Module",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            // Base styling mapping to your custom CSS variables
            className:
              "border border-[var(--color-brand-border)] text-foreground shadow-[var(--shadow-glass)] rounded-[var(--radius-xl)] font-sans p-4",
            classNames: {
              // Custom styles for success and error states
              toast: "bg-[var(--color-brand-card)]",
              title: "text-[14px] font-medium text-[var(--color-brand-primary)]",
              description: "text-[13px] text-[var(--color-brand-muted)]",
              success: "bg-[var(--color-brand-success)] border-green-200",
              error: "bg-[var(--color-brand-danger)] border-red-200",
            },
          }}
        />
      </body>
    </html>
  );
}