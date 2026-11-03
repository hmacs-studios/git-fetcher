import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";

import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { markOtaBundleReady } from "@/services/otaUpdateService";

const BUILD_ID = "v10-STABLE";

void markOtaBundleReady();

const Root = () => {
  const initNativeFeatures = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      console.log(`[${BUILD_ID}] Native Init Start`);
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch (e) {
      console.error(`[${BUILD_ID}] Native Init Error:`, e);
    }
  };

  useEffect(() => {
    initNativeFeatures();
  }, []);

  return (
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
};

if ("serviceWorker" in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => console.log("SW failed", err));
  });
} else {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(registration => registration.unregister()))
      .catch(err => console.log("SW cleanup failed", err));
  }
  if (typeof window !== "undefined" && "caches" in window) {
    caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}
