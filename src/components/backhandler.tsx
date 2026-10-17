import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { toast } from "sonner";

export default function BackButtonHandler() {
    const location = useLocation();
    const navigate = useNavigate();

    // Use refs so the listener callback always reads the latest values
    // without needing to re-register the listener on every path change.
    const locationRef = useRef(location.pathname);
    const navigateRef = useRef(navigate);
    const lastTapTime = useRef<number>(0);
    const EXIT_WINDOW = 2000;

    // Keep refs up to date on every render
    locationRef.current = location.pathname;
    navigateRef.current = navigate;

    useEffect(() => {
        console.log("[BackHandler] Registering single back button listener");
        
        let isActive = true;
        let backButtonListener: any = null;

        App.addListener("backButton", ({ canGoBack }) => {
            const pathname = locationRef.current;
            const nav = navigateRef.current;

            console.log(`[BackHandler] Back pressed. Path=[${pathname}], canGoBack=[${canGoBack}]`);

            if (document.body.dataset.battleGameActive === "true") {
                return;
            }

            // 1. Check for open modals/sheets: Usage Limits, Case of the Day, Term of the Day
            const usageLimitsSheet = document.querySelector('[data-usage-limits-sheet="true"]');
            const caseOfDayModal = document.querySelector('[data-case-of-day-modal="true"]');
            const termOfDayModal = document.querySelector('[data-term-of-day-modal="true"]');
            const savedReelsModal = document.querySelector('[data-saved-reels-modal="true"]');

            if (usageLimitsSheet || caseOfDayModal || termOfDayModal || savedReelsModal) {
                if (savedReelsModal) {
                    window.dispatchEvent(new CustomEvent("close-saved-reels"));
                } else {
                    window.dispatchEvent(new CustomEvent("close-dashboard-modals"));
                }
                return;
            }

            // MCQ Quiz Routes: let the MCQDisplay component handle the back button (shows leave modal)
            if (pathname.startsWith("/mcqs/quiz")) {
                return;
            }

            // AI Test Generator Route: let AITestGenerator component handle the back button (shows exit modal)
            if (pathname.startsWith("/ai/test-generator")) {
                return;
            }

            // FLP Test Routes: let the FLPQuiz component handle the back button (shows leave modal)
            if (pathname.startsWith("/flp/test")) {
                return;
            }

            // FLP main wizard setup: go to dashboard
            if (pathname === "/flp") {
                nav("/dashboard");
                return;
            }

            // FLP result pages: go to dashboard (not back to the finished test)
            if (pathname === "/flp-result" || pathname.startsWith("/results/flp/")) {
                nav("/dashboard");
                return;
            }

            // All other MCQ pages: hardcoded navigation based on page
            if (pathname.startsWith("/mcqs")) {
                // /mcqs/chapter/:subjectId -> /mcqs (chapter selection -> subject selection)
                const chapterMatch = pathname.match(/^\/mcqs\/chapter\/([^/]+)$/);
                if (chapterMatch) {
                    nav("/mcqs");
                    return;
                }

                // /mcqs/settings/:subjectId/:chapterId -> /mcqs/chapter/:subjectId (settings -> chapter selection)
                const settingsMatch = pathname.match(/^\/mcqs\/settings\/([^/]+)\/([^/]+)$/);
                if (settingsMatch) {
                    const subjectId = settingsMatch[1];
                    nav(`/mcqs/chapter/${subjectId}`);
                    return;
                }

                // /mcqs (subject selection) -> dashboard
                if (pathname === "/mcqs") {
                    nav("/dashboard");
                    return;
                }

                // Fallback for any other MCQ routes
                nav("/dashboard");
                return;
            }

            // DASHBOARD ROUTE
            if (pathname === "/dashboard") {
                const currentTab = (window as any).__currentDashboardTab || document.body.dataset.dashboardTab || "home";

                // If on any tab other than 'home' -> navigate back to 'home' tab
                if (currentTab !== "home") {
                    window.dispatchEvent(new CustomEvent("switch-dashboard-tab", { detail: "home" }));
                    return;
                }

                // If on 'home' tab -> double-tap exit logic
                const now = Date.now();
                if (now - lastTapTime.current < EXIT_WINDOW) {
                    console.log("[BackHandler] Second tap -> Exiting app");
                    App.exitApp();
                } else {
                    console.log("[BackHandler] First tap -> Toast");
                    lastTapTime.current = now;
                    toast("Press back again to exit Medmacs", {
                        position: "bottom-center",
                        duration: 2000,
                    });
                }
                return;
            }

            // All other pages: navigate back
            if (canGoBack) {
                nav(-1);
            } else {
                nav("/dashboard");
            }
        }).then((listener) => {
            if (!isActive) {
                listener.remove();
            } else {
                backButtonListener = listener;
                console.log("[BackHandler] Listener registered.");
            }
        }).catch((err) => {
            console.error("[BackHandler] Failed to register listener:", err);
        });

        return () => {
            isActive = false;
            backButtonListener?.remove();
            console.log("[BackHandler] Listener removed.");
        };
    }, []); // Empty deps: register only ONCE on mount

    return null;
}
