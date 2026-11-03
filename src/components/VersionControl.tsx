import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const VersionGuard = () => {
    const [isOutdated, setIsOutdated] = useState(false);
    const [checking, setChecking] = useState(true);
    const [currentVersionCode, setCurrentVersionCode] = useState<number | null>(null);

    const parseVersionCode = (value: unknown) => {
        const versionCode = Number(value);
        return Number.isFinite(versionCode) ? versionCode : null;
    };

    useEffect(() => {
        const checkVersion = async () => {
            // Version check is only applicable for native mobile apps (Android/iOS)
            if (!Capacitor.isNativePlatform()) {
                setChecking(false);
                return;
            }

            try {
                const appInfo = await App.getInfo();
                const nativeVersionCode = parseVersionCode(appInfo.build);

                if (nativeVersionCode === null) {
                    console.warn("Version check skipped: native version code is unavailable.", appInfo);
                    return;
                }

                setCurrentVersionCode(nativeVersionCode);

                const { data, error } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'min_required_version')
                    .single();

                if (data && !error) {
                    const minRequiredVersionCode = parseVersionCode(data.value);

                    if (minRequiredVersionCode === null) {
                        console.warn("Version check skipped: min_required_version is not numeric.", data.value);
                        return;
                    }

                    if (nativeVersionCode < minRequiredVersionCode) {
                        setIsOutdated(true);
                    }
                }
            } catch (err) {
                console.error("Version check failed:", err);
            } finally {
                setChecking(false);
            }
        };

        checkVersion();
    }, []);

    if (checking || !isOutdated) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-center overflow-hidden">
            <div className="max-w-sm w-full space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping" />
                    <div className="relative bg-gradient-to-br from-teal-500 to-blue-600 p-5 rounded-3xl shadow-xl flex items-center justify-center">
                        <RefreshCw className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        Update Required
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                        We've released important improvements. Your current build ({currentVersionCode}) is no longer supported.
                    </p>
                </div>

                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/50">
                    <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                        Please download the latest version from the Play Store to continue.                    </p>
                </div>

                <Button
                    onClick={() => window.open("https://play.google.com/store/apps/details?id=com.hmacs.medmacs", "_blank")}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white h-14 rounded-2xl font-black text-lg shadow-lg shadow-teal-500/30 transition-all hover:scale-[1.02] active:scale-95"
                >
                    Update Now
                </Button>

                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                    Medmacs Version Control System
                </p>
            </div>
        </div>
    );
};

export default VersionGuard;
