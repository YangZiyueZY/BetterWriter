import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { LoginScreen } from './components/LoginScreen';
import { useStore } from './store/useStore';
import { cn } from './lib/utils';
import { sanitizeBackgroundImageUrl, sanitizeFontFamilyCss, toCssUrlValue } from './lib/theme';

function App() {
  const { settings, user } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const safeBackgroundImageUrl = sanitizeBackgroundImageUrl(settings.backgroundImage);
  const safeBackgroundImageCss = toCssUrlValue(safeBackgroundImageUrl);

  if (!user) {
    return <LoginScreen />;
  }

  return (
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
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
          />
          <main className="flex-1 h-full overflow-hidden w-full">
            <Editor onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          </main>
      </div>
    </div>
  );
}

export default App;
