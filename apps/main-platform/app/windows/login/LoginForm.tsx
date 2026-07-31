"use client";

import { useRef, useState } from "react";

interface LoginFormProps {
  onSignIn: (isAdmin: boolean, account: string, nodeType?: string) => void;
}

interface PasswordToggleButtonProps {
  visible: boolean;
  onToggle: () => void;
}

interface BracketActionButtonProps {
  ariaBusy?: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

function BracketActionButton({
  ariaBusy,
  className = "",
  disabled = false,
  label,
  onClick,
  type = "button",
}: BracketActionButtonProps) {
  return (
    <button
      type={type}
      className={`svg-bracket-action ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-busy={ariaBusy}
    >
      <span className="svg-bracket-action-mark" aria-hidden="true">
        [
      </span>
      <span className="svg-bracket-action-label">{label}</span>
      <span className="svg-bracket-action-mark" aria-hidden="true">
        ]
      </span>
    </button>
  );
}

function PasswordToggleButton({ visible, onToggle }: PasswordToggleButtonProps) {
  return (
    <button
      type="button"
      className="svg-toggle-pwd"
      onClick={onToggle}
      aria-label={visible ? "隐藏密码" : "显示密码"}
      title={visible ? "隐藏密码" : "显示密码"}
    >
      <span className="svg-eye-icon" aria-hidden="true">
        <svg className="svg-eye-icon-svg" viewBox="0 0 24 24" fill="none" focusable="false">
          <path d="M1.5 12C3.84 7.78 7.56 5.67 12 5.67C16.44 5.67 20.16 7.78 22.5 12C20.16 16.22 16.44 18.33 12 18.33C7.56 18.33 3.84 16.22 1.5 12Z" />
          <circle cx="12" cy="12" r="3.1" />
          <line
            x1="4.2"
            y1="19.3"
            x2="19.8"
            y2="4.7"
            className={visible ? "svg-eye-icon-slash is-hidden" : "svg-eye-icon-slash"}
          />
        </svg>
      </span>
    </button>
  );
}

export function LoginForm({ onSignIn }: LoginFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [activeMode, setActiveMode] = useState<"login" | "register">("login");

  const [loginAccount, setLoginAccount] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerAccount, setRegisterAccount] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showRegisterPwd, setShowRegisterPwd] = useState(false);
  const [showRegisterConfirmPwd, setShowRegisterConfirmPwd] = useState(false);

  const handleSwitchToRegister = () => {
    setActiveMode("register");
    setShowPwd(false);
  };

  const handleBackToLogin = () => {
    setActiveMode("login");
    setShowRegisterPwd(false);
    setShowRegisterConfirmPwd(false);
    setRegisterAccount("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");
  };

  const handleLogin = () => {
    const account = loginAccount.trim();
    onSignIn(false, account || "mock-evaluator");
  };

  const handleApplyRegister = () => {
    const account = registerAccount.trim();
    onSignIn(false, account || "mock-evaluator");
  };

  return (
    <form
      ref={formRef}
      className="svg-login-form"
      autoComplete="off"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="svg-form-switcher">
        <section className={`svg-form-panel ${activeMode === "register" ? "is-active" : "is-inactive"}`}>
          <div className="svg-field">
            <input
              type="text"
              placeholder=" "
              id="sv-register-account"
              autoComplete="off"
              value={registerAccount}
              onChange={(event) => setRegisterAccount(event.target.value)}
            />
            <label htmlFor="sv-register-account">评估账号</label>
          </div>

          <div className="svg-field svg-field-pwd">
            <input
              type={showRegisterPwd ? "text" : "password"}
              placeholder=" "
              id="sv-register-pwd"
              autoComplete="new-password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
            />
            <label htmlFor="sv-register-pwd">访问密码</label>
            <PasswordToggleButton
              visible={showRegisterPwd}
              onToggle={() => setShowRegisterPwd((value) => !value)}
            />
          </div>

          <div className="svg-field svg-field-pwd">
            <input
              type={showRegisterConfirmPwd ? "text" : "password"}
              placeholder=" "
              id="sv-register-confirm-pwd"
              autoComplete="new-password"
              value={registerConfirmPassword}
              onChange={(event) => setRegisterConfirmPassword(event.target.value)}
            />
            <label htmlFor="sv-register-confirm-pwd">确认访问密码</label>
            <PasswordToggleButton
              visible={showRegisterConfirmPwd}
              onToggle={() => setShowRegisterConfirmPwd((value) => !value)}
            />
          </div>

          <div className="svg-form-actions">
            <BracketActionButton
              className="svg-bracket-action--primary"
              onClick={handleApplyRegister}
              label="申请接入"
            />

            <BracketActionButton
              className="svg-bracket-action--secondary"
              onClick={handleBackToLogin}
              label="返回入口"
            />
          </div>
        </section>

        <section className={`svg-form-panel ${activeMode === "login" ? "is-active" : "is-inactive"}`}>
          <div className="svg-field">
            <input
              type="text"
              placeholder=" "
              id="sv-account"
              autoComplete="off"
              value={loginAccount}
              onChange={(event) => setLoginAccount(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleLogin()}
            />
            <label htmlFor="sv-account">评估账号</label>
          </div>

          <div className="svg-field svg-field-pwd">
            <input
              type={showPwd ? "text" : "password"}
              placeholder=" "
              id="sv-pwd"
              autoComplete="new-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleLogin()}
            />
            <label htmlFor="sv-pwd">访问密码</label>
            <PasswordToggleButton visible={showPwd} onToggle={() => setShowPwd((value) => !value)} />
          </div>

          <div className="svg-primary-action-slot">
            <BracketActionButton
              className="svg-bracket-action--primary"
              onClick={handleLogin}
              label="进入平台"
            />
          </div>

          <p className="svg-register">
            <span className="svg-register-copy">还没有评估账号？</span>
            <button type="button" className="svg-inline-link" onClick={handleSwitchToRegister}>
              申请接入
            </button>
          </p>
        </section>
      </div>
    </form>
  );
}
