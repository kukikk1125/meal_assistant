"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Loader2, CheckCircle, AlertTriangle, AlertCircle, HelpCircle, RefreshCw, Upload } from "lucide-react";
import { analyzeCookingImage } from "@/lib/doubao";
import { useCookingStore, PhotoCheckAnalysis, OverallStatus } from "@/store";
import { confidenceLabelMap, statusColorMap } from "@/utils/cookingCheck";

interface PhotoCheckButtonProps {
  stepId: string;
  stepNumber: number;
  stepDescription: string;
  recipeId: string;
  recipeName: string;
  prevStep?: string;
  nextStep?: string;
}

const StatusIcon = ({ status, className }: { status: OverallStatus; className?: string }) => {
  const config = statusColorMap[status];
  switch (config.icon) {
    case 'check': return <CheckCircle className={className} />;
    case 'warning': return <AlertTriangle className={className} />;
    case 'alert': return <AlertCircle className={className} />;
    case 'help': return <HelpCircle className={className} />;
  }
};

export default function PhotoCheckButton({
  stepId,
  stepNumber,
  stepDescription,
  recipeId,
  recipeName,
  prevStep,
  nextStep,
}: PhotoCheckButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PhotoCheckAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { addPhotoCheckEvent } = useCookingStore();

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  function handleButtonClick() {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setShowModal(true);
      analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setShowModal(true);
      analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImage(imageBase64: string) {
    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeCookingImage(
        imageBase64, 
        stepDescription, 
        stepNumber,
        recipeName,
        prevStep,
        nextStep
      );
      
      const analysis: PhotoCheckAnalysis = {
        overallStatus: result.overallStatus,
        statusLabel: result.statusLabel,
        currentState: result.currentState,
        isAppropriate: result.isAppropriate,
        canProceed: result.canProceed,
        problemType: result.problemType,
        confidence: result.confidence,
        reasons: result.reasons,
        risks: result.risks,
        advice: result.advice,
        remedy: result.remedy,
        followUpShotSuggestion: result.followUpShotSuggestion,
      };

      setAnalysisResult(analysis);

      addPhotoCheckEvent({
        stepId,
        stepNumber,
        stepDescription,
        imageUrl: imageBase64,
        analysis,
      });
    } catch {
      setError("本次识别失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function retakePhoto() {
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }

  const statusConfig = analysisResult ? statusColorMap[analysisResult.overallStatus] : null;

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      
      <button
        onClick={handleButtonClick}
        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1 transition-colors"
      >
        <Camera className="w-4 h-4" />
        <span>拍照检查</span>
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60"
          onClick={closeModal}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col"
            style={{ maxHeight: '92dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - 固定 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 text-base">厨房状态检查</h3>
              <button 
                onClick={closeModal} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Content - 可滚动 */}
            <div 
              ref={contentRef}
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{ minHeight: '0' }}
            >
              {analyzing && (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-primary-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-700 text-base">正在分析...</p>
                </div>
              )}

              {error && !analyzing && (
                <div className="text-center py-12">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-700 text-base mb-6">{error}</p>
                </div>
              )}

              {analysisResult && !analyzing && statusConfig && (
                <div className="space-y-4">
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="拍摄的照片"
                      className="w-full h-36 object-cover rounded-xl"
                    />
                  )}

                  {/* 状态区 */}
                  <div className={`p-4 rounded-xl border-2 ${statusConfig.bg} ${statusConfig.border}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <StatusIcon 
                        status={analysisResult.overallStatus} 
                        className={`w-6 h-6 ${statusConfig.text}`}
                      />
                      <span className={`font-bold text-lg ${statusConfig.text}`}>
                        {analysisResult.statusLabel}
                      </span>
                    </div>
                    <p className="text-base text-gray-700 leading-relaxed">{analysisResult.currentState}</p>
                  </div>

                  {/* 判断依据 */}
                  {analysisResult.reasons.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">判断依据</h4>
                      <ul className="text-base text-gray-700 space-y-2">
                        {analysisResult.reasons.map((reason, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-gray-400 mt-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 需要留意 */}
                  {analysisResult.risks && analysisResult.risks.length > 0 && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                      <h4 className="text-sm font-semibold text-amber-800 mb-2">需要留意</h4>
                      <ul className="text-base text-amber-700 space-y-2">
                        {analysisResult.risks.map((risk, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 下一步建议 */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">下一步建议</h4>
                    <p className="text-base text-gray-700 leading-relaxed">{analysisResult.advice}</p>
                  </div>

                  {/* 补救方法 */}
                  {analysisResult.remedy && analysisResult.remedy.trim() && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">补救方法</h4>
                      <p className="text-base text-blue-700 leading-relaxed">{analysisResult.remedy}</p>
                    </div>
                  )}

                  {/* 建议补拍 */}
                  {analysisResult.followUpShotSuggestion && analysisResult.followUpShotSuggestion.trim() && (
                    <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">建议补拍</h4>
                      <p className="text-base text-gray-600 leading-relaxed">{analysisResult.followUpShotSuggestion}</p>
                    </div>
                  )}

                  {/* 辅助信息 */}
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600">第 {stepNumber} 步</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600">{confidenceLabelMap[analysisResult.confidence]}</span>
                    </div>
                    <span className="text-primary-600 font-medium">已记录</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer - 固定 */}
            <div className="flex gap-3 p-4 border-t border-gray-200 flex-shrink-0 bg-white">
              <button
                onClick={retakePhoto}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                重新拍照
              </button>
              <button
                onClick={closeModal}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
