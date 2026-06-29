import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import AppAvatar from "../components/AppAvatar";
import { APP_DISPLAY_NAME } from "../data/brand";

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const sendCode = () => {
    if (countdown > 0 || !phone.trim()) return;
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleLogin = () => {
    if (!phone.trim() || !code.trim() || !agreed) return;
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userPhone", phone);
    navigate("/profile");
  };

  return (
    <div className="login-page">
      <main className="login-page-main hide-scrollbar">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-8 flex h-9 w-9 items-center justify-center rounded-full text-ink-light transition-colors hover:bg-brand-pink-soft"
          aria-label="返回"
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>

        <div className="mb-10 flex items-center gap-4">
          <AppAvatar size="md" radius="full" />
          <div>
            <p className="text-[15px] text-ink-muted">欢迎来到</p>
            <p className="text-xl font-semibold text-brand-pink-dark">{APP_DISPLAY_NAME}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-ink-light">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-ink-light">验证码</label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                className="input-field w-full pr-24"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={countdown > 0}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand-pink/15 px-3 py-1.5 text-xs font-medium text-brand-pink-dark disabled:opacity-50"
              >
                {countdown > 0 ? `${countdown}s` : "发送"}
              </button>
            </div>
          </div>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-brand-pink"
          />
          <span className="text-xs leading-relaxed text-ink-light">
            我已阅读并同意
            <span className="text-brand-pink-dark">《用户协议》</span>
            及
            <span className="text-brand-pink-dark">《隐私政策》</span>
          </span>
        </label>

        <button
          type="button"
          onClick={handleLogin}
          disabled={!phone.trim() || !code.trim() || !agreed}
          className="btn-primary mt-8 w-full disabled:opacity-45"
        >
          登录
        </button>

        <div className="mt-12 text-center">
          <p className="mb-5 text-xs text-ink-light">其他方式登录</p>
          <div className="flex justify-center gap-8">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f5e9] text-[#66bb6a]"
              aria-label="微信登录"
            >
              <MessageCircle size={22} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-pink-soft text-brand-pink-dark"
              aria-label="QQ登录"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.03 2 10.9c0 2.76 1.56 5.22 4 6.78-.18.67-.65 2.42-.75 2.8-.12.5.18.49.38.36.16-.1 2.56-1.72 3.6-2.41.72.1 1.46.15 2.22.15 5.52 0 10-4.03 10-8.9S17.52 2 12 2z" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
