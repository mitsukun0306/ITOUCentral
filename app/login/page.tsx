import { LoginForm } from "./LoginForm";

// 注: ここでサーバー側リダイレクトはしない。
// Server Action 完了時の再レンダリングでリダイレクトが発火すると、
// ログイン成功後の名言アニメーションが表示される前に遷移してしまうため。
// ログイン済みユーザーの振り分けはトップページ(app/page.tsx)が担う。
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            ITOU<span className="text-brand">Central</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">いとう開発部 社内ポータル</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <LoginForm />
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">
          社内関係者専用システムです
        </p>
      </div>
    </div>
  );
}
