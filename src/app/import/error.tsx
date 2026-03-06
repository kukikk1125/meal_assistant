"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ImportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Import page error:", error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">导入食谱</h1>
      </header>

      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold mb-4">出错了</h2>
        <p className="text-gray-500 mb-6 text-center">{error.message || "发生了未知错误"}</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            返回首页
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  );
}
