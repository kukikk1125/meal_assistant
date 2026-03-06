"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-semibold mb-4">出错了</h2>
      <p className="text-gray-500 mb-4">{error.message || "发生了未知错误"}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary-500 text-white rounded-lg"
      >
        重试
      </button>
    </div>
  );
}
