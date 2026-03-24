"use client";

import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface RecipeHintCardProps {
  recipeId: string;
  hasMyVersion: boolean;
  currentVersion: "original" | "my";
  onVersionChange: (version: "original" | "my") => void;
  myVersionSummary?: string;
}

export default function RecipeHintCard({
  recipeId,
  hasMyVersion,
  currentVersion,
  onVersionChange,
  myVersionSummary,
}: RecipeHintCardProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  
  if (!hasMyVersion) {
    return null;
  }
  
  function handleStartCooking() {
    router.push(`/cook/${recipeId}?version=${currentVersion}`);
  }
  
  return (
    <div className="card p-4 mb-4 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-700 mb-3">
            你有一个专属优化版本
          </p>
          
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onVersionChange("original")}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                currentVersion === "original"
                  ? "bg-white text-gray-700 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:bg-white/50"
              }`}
            >
              原始版本
            </button>
            <button
              onClick={() => onVersionChange("my")}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                currentVersion === "my"
                  ? "bg-primary-500 text-white"
                  : "bg-white text-gray-600 hover:bg-white/80 border border-gray-200"
              }`}
            >
              我的版本 ✓
            </button>
          </div>
          
          {myVersionSummary && (
            <div className="mb-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    收起优化说明
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    查看优化说明
                  </>
                )}
              </button>
              
              {showDetails && (
                <div className="mt-2 p-3 bg-white/80 rounded-lg text-sm text-gray-600">
                  {myVersionSummary}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleStartCooking}
            className="w-full py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            使用{currentVersion === "my" ? "我的版本" : "原始版本"}开始做饭
          </button>
        </div>
      </div>
    </div>
  );
}
