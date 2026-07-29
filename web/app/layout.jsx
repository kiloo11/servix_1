import "./globals.css";
import { LocaleProvider } from "../context/LocaleContext";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import { ConfirmProvider } from "../context/ConfirmContext";

export const metadata = {
  title: "SERVIX",
  description: "Панель учета серверов, доменов, сертификатов и платежей.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    apple: "/app-icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04000f",
  // Lets content draw under the iOS notch/home-indicator area so
  // env(safe-area-inset-*) below actually resolves to a nonzero value there
  // instead of always reading 0.
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/gteestiprodisplay_bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/gteestiprotext_regular.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <LocaleProvider>
          <ToastProvider>
            <AuthProvider>
              <DataProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </DataProvider>
            </AuthProvider>
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
