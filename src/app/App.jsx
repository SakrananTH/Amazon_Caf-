import { Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { screenCatalog } from './screenCatalog.jsx';
import { AppStateProvider } from './state/AppStateContext.jsx';

const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;

function RouteLoadingFallback() {
  return (
    <div className="screen-stage desktop">
      <div className="manager-login-shell">
        <section className="panel-card manager-login-card">
          <div className="panel-head manager-login-head">
            <div>
              <h3>กำลังเปิดหน้าถัดไป</h3>
              <p>รอสักครู่ ระบบกำลังโหลดข้อมูลของหน้านี้</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function RoutedApp() {
  const location = useLocation();
  const selectedScreen = screenCatalog.find((screen) => screen.path === location.pathname) ?? screenCatalog[0];

  useEffect(() => {
    document.title = `${selectedScreen.title} | Amazon Schedule UI`;
  }, [selectedScreen]);

  return (
    <div className={`page-root page-${selectedScreen.id}`} data-screen={selectedScreen.id}>
      <Routes>
        {screenCatalog.map((screen) => {
          const ScreenComponent = screen.component;
          return (
            <Route
              key={screen.path}
              path={screen.path}
              element={(
                <Suspense fallback={<RouteLoadingFallback />}>
                  <ScreenComponent />
                </Suspense>
              )}
            />
          );
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppStateProvider>
        <RoutedApp />
      </AppStateProvider>
    </Router>
  );
}
