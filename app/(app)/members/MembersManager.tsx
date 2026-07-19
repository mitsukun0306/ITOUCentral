"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import {
  createMember,
  toggleActive,
  resetPassword,
  type MemberFormState,
} from "./actions";
import type { Role } from "@/lib/generated/prisma";

type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  taskCount: number;
};

export function MembersManager({
  currentUserId,
  members,
}: {
  currentUserId: string;
  members: Member[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">メンバー管理</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark"
        >
          + メンバー追加
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">氏名</th>
                <th className="px-4 py-2 font-medium">メール</th>
                <th className="px-4 py-2 font-medium">権限</th>
                <th className="px-4 py-2 font-medium">タスク</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2 text-gray-500">{m.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        m.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m.role === "ADMIN" ? "管理者" : "メンバー"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{m.taskCount}</td>
                  <td className="px-4 py-2">
                    {m.active ? (
                      <span className="text-xs text-green-600">有効</span>
                    ) : (
                      <span className="text-xs text-gray-400">無効</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setResetting(m)}
                      className="text-brand text-xs hover:underline mr-3"
                    >
                      PW再設定
                    </button>
                    {m.id !== currentUserId && (
                      <button
                        onClick={() =>
                          startTransition(() => toggleActive(m.id))
                        }
                        className="text-gray-500 text-xs hover:underline"
                      >
                        {m.active ? "無効化" : "有効化"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} />
      )}
      {resetting && (
        <ResetModal member={resetting} onClose={() => setResetting(null)} />
      )}
    </div>
  );
}

const initial: MemberFormState = {};

function CreateModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createMember, initial);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="メンバー追加" onClose={onClose}>
      <form action={action} className="space-y-4">
        <Field label="氏名" required>
          <input name="name" required className={inputCls} />
        </Field>
        <Field label="メールアドレス" required>
          <input name="email" type="email" required className={inputCls} />
        </Field>
        <Field label="初期パスワード" required>
          <input name="password" type="text" required className={inputCls} />
        </Field>
        <Field label="権限">
          <select name="role" defaultValue="MEMBER" className={inputCls}>
            <option value="MEMBER">メンバー</option>
            <option value="ADMIN">管理者</option>
          </select>
        </Field>
        <FormError error={state.error} />
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

function ResetModal({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(resetPassword, initial);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title={`${member.name} のパスワード再設定`} onClose={onClose}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={member.id} />
        <Field label="新しいパスワード" required>
          <input name="password" type="text" required className={inputCls} />
        </Field>
        <FormError error={state.error} />
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
      {error}
    </p>
  );
}

function Actions({
  pending,
  onClose,
}: {
  pending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
      >
        キャンセル
      </button>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
