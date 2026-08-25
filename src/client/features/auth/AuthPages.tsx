import { useState } from "react";
import { authApi } from "../../lib/api/auth";
import { AuthInput, AuthShell, ErrorText } from "./AuthComponents";
import { Button } from "../../components/ui/button";

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (recovery) return <RecoveryPage onSuccess={onSuccess} onBack={() => setRecovery(false)} />;
  return <AuthShell eyebrow="ADMIN CONSOLE" title="登录后台"><form onSubmit={(event) => { event.preventDefault(); authApi.login(username, password).then(onSuccess).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "登录失败")); }}><AuthInput label="用户名" value={username} onChange={setUsername} /><AuthInput label="密码" type="password" value={password} onChange={setPassword} /><ErrorText text={error} /><Button className="my-2.5 w-full">进入工作台</Button><Button variant="link" className="mt-3 w-full text-xs" type="button" onClick={() => setRecovery(true)}>忘记密码？</Button></form></AuthShell>;
}

export function RecoveryPage({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  return <AuthShell eyebrow="PASSWORD RECOVERY" title="重置管理员密码"><form onSubmit={(event) => { event.preventDefault(); if (password !== confirm) return setError("两次密码不一致"); authApi.resetPassword(username, code, password).then(onSuccess).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "重置失败")); }}><p className="-mt-3 mb-[18px] text-sm leading-7 text-muted-foreground">请先在服务器执行恢复码命令，再将一次性恢复码粘贴到这里。</p><AuthInput label="管理员用户名" value={username} onChange={setUsername} /><AuthInput label="一次性恢复码" value={code} onChange={setCode} /><AuthInput label="新密码" type="password" value={password} onChange={setPassword} /><AuthInput label="确认新密码" type="password" value={confirm} onChange={setConfirm} /><ErrorText text={error} /><Button className="my-2.5 w-full">重置并登录</Button><Button variant="link" className="mt-3 w-full text-xs" type="button" onClick={onBack}>返回登录</Button></form></AuthShell>;
}

export function SetupPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  return <AuthShell eyebrow="FIRST RUN SETUP" title="创建管理员"><form onSubmit={(event) => { event.preventDefault(); if (password !== confirm) return setError("两次密码不一致"); authApi.initialize(username, password).then(onSuccess).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "初始化失败")); }}><p className="-mt-3 mb-[18px] text-sm leading-7 text-muted-foreground">这是首次启动，请先创建唯一的后台管理员账号。初始化完成后不会开放公共注册。</p><AuthInput label="管理员用户名" value={username} onChange={setUsername} /><AuthInput label="管理员密码" type="password" value={password} onChange={setPassword} /><AuthInput label="确认密码" type="password" value={confirm} onChange={setConfirm} /><ErrorText text={error} /><Button className="my-2.5 w-full">完成初始化</Button></form></AuthShell>;
}
