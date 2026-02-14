import { Suspense, lazy, useEffect, useState } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { BackendUnavailableScreen } from './components/BackendUnavailableScreen';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { useStore } from './store/useStore';
import { cn } from './lib/utils';
import { sanitizeBackgroundImageUrl, sanitizeFontFamilyCss, toCssUrlValue } from './lib/theme';
import api from './services/api';
import { getBackendStatus, subscribeBackendStatus, type BackendStatus } from './lib/backendStatus';
import { resetLoading, startLoading, stopLoading } from './lib/loadingManager';
import { LazyErrorBoundary } from './components/LazyErrorBoundary';

type SidebarProps = { isOpen: boolean; onClose: () => void };
type EditorProps = { onToggleSidebar?: () => void };

const LazySidebar = lazy(() => import('./components/Sidebar').then((m: any) => ({ default: m.Sidebar }))) as unknown as LazyExoticComponent<
  ComponentType<SidebarProps>
>;
const LazyEditor = lazy(() => import('./components/Editor').then((m: any) => ({ default: m.Editor }))) as unknown as LazyExoticComponent<
  ComponentType<EditorProps>
>;

const idle = (fn: () => void) => {
  const anyWin: any = window as any;
  if (typeof anyWin.requestIdleCallback === 'function') return anyWin.requestIdleCallback(fn);
  return window.setTimeout(fn, 300);
};

function App() {
  const { settings, user } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(() => getBackendStatus());

  // Effect for Font Injection and Application
  useEffect(() => {
    // Inject Maoken font if selected
    if (settings.fontFamily === 'MaokenAssortedSans') {
        const linkId = 'font-maoken';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.href = 'https://fontsapi.zeoseven.com/382/main/result.css';
            link.rel = 'stylesheet';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        }
    }

    // Apply font family globally using a style tag to override Tailwind defaults
    const styleId = 'dynamic-font-style';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const safeFontFamily = settings.fontFamily === 'MaokenAssortedSans'
      ? '"MaokenAssortedSans", system-ui, sans-serif'
      : sanitizeFontFamilyCss(settings.fontFamily);

    if (safeFontFamily) {
        // Use !important to ensure it overrides Tailwind classes
        styleTag.textContent = `
            :root {
                --font-sans: ${safeFontFamily};
            }
            body, .font-sans, textarea, input, button, select {
                font-family: ${safeFontFamily} !important;
            }
        `;
    } else {
        styleTag.textContent = '';
    }
  }, [settings.fontFamily]);

  // Effect for Dark Mode
  useEffect(() => {
    if (settings.darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  useEffect(() => {
    return subscribeBackendStatus((s) => setBackendStatus(s));
  }, []);

  useEffect(() => {
    const token = startLoading({ title: '正在初始化…' });
    void api
      .get('/health', { timeout: 2500 })
      .catch(() => undefined)
      .finally(() => stopLoading(token));
  }, []);

  useEffect(() => {
    if (!user) return;
    const h = idle(() => {
      void import('./components/SettingsModal').catch(() => undefined);
      void import('./components/MarkdownPreview').catch(() => undefined);
    });
    return () => {
      const anyWin: any = window as any;
      if (typeof anyWin.cancelIdleCallback === 'function') anyWin.cancelIdleCallback(h);
      else window.clearTimeout(h);
    };
  }, [user]);

  const safeBackgroundImageUrl = sanitizeBackgroundImageUrl(settings.backgroundImage);
  const safeBackgroundImageCss = toCssUrlValue(safeBackgroundImageUrl);

  if (backendStatus.down) {
    resetLoading();
    return <BackendUnavailableScreen status={backendStatus} />;
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <GlobalLoadingOverlay />
      </>
    );
  }

  return (
    <>
      <div 
          className={cn(
              "flex h-screen w-full overflow-hidden font-sans transition-colors duration-300",
              settings.darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
          )}
          style={{
              backgroundImage: safeBackgroundImageCss,
              backgroundColor: (!settings.darkMode && !safeBackgroundImageCss && settings.backgroundColor) 
                  ? settings.backgroundColor 
                  : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
          }}
      >
      {/* Overlay for background image readability */}
      {safeBackgroundImageCss && (
          <div className={cn(
              "absolute inset-0 z-0 pointer-events-none",
              settings.darkMode ? "bg-black/60" : "bg-white/80"
          )} />
      )}
      
      <div className="relative z-10 flex w-full h-full">
          <LazyErrorBoundary title="界面加载失败">
            <Suspense
              fallback={
                <div className="flex w-full h-full">
                  <div className="hidden md:block w-80 h-full border-r border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40" />
                  <div className="flex-1 h-full p-6">
                    <div className="h-6 w-48 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
                    <div className="mt-4 h-4 w-2/3 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
                    <div className="mt-2 h-4 w-3/5 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
                    <div className="mt-6 h-80 w-full rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
                  </div>
                </div>
              }
            >
              <LazySidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
              <main className="flex-1 h-full overflow-hidden w-full">
                <LazyEditor onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
              </main>
            </Suspense>
          </LazyErrorBoundary>
      </div>
      </div>
      <GlobalLoadingOverlay />
    </>
  );
}

export default App;
