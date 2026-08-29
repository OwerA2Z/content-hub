import { Spin } from "antd";
import { useEffect, useState } from "react";
import { authApi } from "../lib/api/auth";
import { LoginPage, SetupPage } from "../features/auth/AuthPages";
import { AppShell } from "./AppShell";

/** 应用入口只负责认证门禁，业务页面由各领域模块管理。 */
export function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authApi.setupStatus()
      .then((result) => {
        setSetupRequired(result.data.required);
        if (!result.data.required) return authApi.me().then(() => setLoggedIn(true)).catch(() => undefined);
        return undefined;
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="app-auth-loading"><Spin tip="正在检查登录状态…" /></div>;
  if (setupRequired) return <SetupPage onSuccess={() => { setSetupRequired(false); setLoggedIn(true); }} />;
  if (!loggedIn) return <LoginPage onSuccess={() => setLoggedIn(true)} />;
  return <AppShell onLogout={() => authApi.logout().finally(() => setLoggedIn(false))} />;
}
