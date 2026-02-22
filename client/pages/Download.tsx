import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Sparkles,
  CheckCircle,
  Download as DownloadIcon,
  Mail,
  FileText,
  AlertCircle,
  Loader,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LegalFooter from "@/components/LegalFooter";
import {
  getProductByPlanId,
  getAddOnById,
  PlanConfiguration,
} from "@/lib/products";
import {
  generatePersonalizedPDFClient,
  generatePDFFromBundle,
  downloadPDF,
  type PersonalizationData,
} from "@/lib/client-pdf-generator";
import { analyzeQuizData } from "@/lib/quiz-analysis";
import type { PDFDataBundle, WellnessUserProfile } from "../../shared/wellness-types";

interface PDFData {
  pdfRecordId: string;
  orderId: string;
  planTier: string;
  userName: string;
  generatedAt: string;
  expiresAt: string;
  downloadUrl: string;
  pageCount: number;
}

export default function Download() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(true);

  const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");
  const analysisId = localStorage.getItem("analysisId");

  // Get configuration from state or localStorage
  const [configuration, setConfiguration] = useState<PlanConfiguration | null>(
    null
  );

  useEffect(() => {
    const stateConfig =
      location.state?.configuration || location.state?.planId
        ? {
            planId:
              location.state?.planId || location.state?.configuration?.planId,
            selectedAddOns:
              location.state?.addOns ||
              location.state?.configuration?.selectedAddOns ||
              [],
            totalPrice: location.state?.configuration?.totalPrice || 0,
          }
        : JSON.parse(localStorage.getItem("planConfiguration") || "null");

    setConfiguration(stateConfig);

    if (stateConfig && analysisId) {
      generatePDF(stateConfig);
    }
  }, [location.state, analysisId]);

  const generatePDF = async (config: PlanConfiguration) => {
    setIsLoading(true);
    setError("");
    setShowInfo(true);

    try {
      const freshAnalysisId = localStorage.getItem("analysisId");
      const savedQuizData = localStorage.getItem("quizData");

      if (!freshAnalysisId) {
        throw new Error(
          "Analysis ID not found. Please complete the quiz first."
        );
      }

      if (!savedQuizData) {
        throw new Error("Quiz data not found. Please complete the quiz first.");
      }

      const planTier = config.planId.replace("_blueprint", "");

      console.log("Generating PDF with AI narratives...", {
        freshAnalysisId,
        planTier,
        addOns: config.selectedAddOns,
      });

      let parsedQuizData;
      try {
        parsedQuizData = JSON.parse(savedQuizData);
      } catch (parseErr) {
        console.error("Failed to parse quiz data:", parseErr);
        throw new Error("Invalid quiz data format");
      }

      console.log("Quiz data parsed successfully:", parsedQuizData);

      const analyzed = analyzeQuizData(
        parsedQuizData,
        parsedQuizData.userName,
        parsedQuizData.userEmail
      );

      const userProfile: WellnessUserProfile = {
        name: analyzed.profile.name,
        email: analyzed.profile.email,
        age: analyzed.profile.age,
        gender: analyzed.profile.gender,
        heightCm: analyzed.profile.estimatedHeightCm,
        weightKg: analyzed.profile.estimatedWeightKg,
        bmi: analyzed.profile.estimatedWeightKg / Math.pow(analyzed.profile.estimatedHeightCm / 100, 2),
        bmr: analyzed.profile.estimatedBMR,
        tdee: analyzed.profile.estimatedTDEE,
        proteinGrams: analyzed.profile.proteinGrams,
        carbsGrams: analyzed.profile.carbsGrams,
        fatsGrams: analyzed.profile.fatsGrams,
        stressScore: analyzed.profile.stressScore,
        sleepScore: analyzed.profile.sleepScore,
        activityScore: analyzed.profile.activityScore,
        energyScore: analyzed.profile.energyScore,
        medicalConditions: analyzed.profile.medicalConditions,
        digestiveIssues: analyzed.profile.digestiveIssues,
        foodIntolerances: analyzed.profile.foodIntolerances,
        skinConcerns: analyzed.profile.skinConcerns,
        dietaryPreference: analyzed.profile.dietaryPreference,
        exercisePreference: analyzed.profile.exercisePreference,
        exerciseIntensity: analyzed.profile.exerciseIntensity,
        workSchedule: analyzed.profile.workSchedule,
        region: analyzed.profile.region,
        goals: parsedQuizData.weightGoal ? [parsedQuizData.weightGoal] : ["general-wellness"],
        recommendedTests: analyzed.profile.recommendedTests,
        supplementPriority: analyzed.profile.supplementPriority,
        mealFrequency: analyzed.profile.mealFrequency,
        dnaConsent: analyzed.profile.dnaConsent,
      };

      let blob: Blob;
      let filename: string;

      try {
        console.log("Calling server for AI-powered PDF data...");
        const response = await fetch("/api/generate-pdf-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: userProfile,
            tier: planTier,
            addOns: config.selectedAddOns,
            orderId: freshAnalysisId,
            numDays: (planTier === "premium" || planTier === "coaching") ? 7 : 3,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const bundle: PDFDataBundle = await response.json();
        bundle.timestamp = new Date().toISOString();

        console.log("AI narratives received, generating PDF...");
        const pdfResult = await generatePDFFromBundle(bundle);
        blob = pdfResult.blob;
        filename = pdfResult.filename;
        console.log("AI-powered PDF generated:", { filename, size: blob.size });
      } catch (apiErr) {
        console.warn("AI narrative API failed, using template fallback:", apiErr);
        const personalizationData: PersonalizationData = {
          ...analyzed,
          insights: {
            ...analyzed.insights,
            supplementStack: analyzed.insights.supplementStack.map(s => ({
              ...s,
              dosage: s.dosage || "As directed"
            }))
          }
        };
        const pdfResult = await generatePersonalizedPDFClient(
          personalizationData,
          {
            tier: planTier as any,
            addOns: config.selectedAddOns,
            orderId: freshAnalysisId,
            timestamp: new Date().toISOString(),
            language: (localStorage.getItem("language") || "en") as "en" | "hi",
          }
        );
        blob = pdfResult.blob;
        filename = pdfResult.filename;
        console.log("Fallback PDF generated:", { filename, size: blob.size });
      }

      // Estimate page count based on tier and add-ons
      let pageCount = 1; // Cover page
      pageCount += 1; // Top 3 actions
      pageCount += 1; // Executive summary
      if (planTier === "premium" || planTier === "coaching") pageCount += 1; // Latest science
      if (planTier !== "free") pageCount += 1; // Metabolic profile
      if (
        planTier === "essential" ||
        planTier === "premium" ||
        planTier === "coaching"
      ) {
        pageCount += 1; // Nutrition plan
        if (planTier === "premium" || planTier === "coaching") pageCount += 1; // Meal plan details
      }
      pageCount += 1; // Sleep optimization
      if (
        planTier === "essential" ||
        planTier === "premium" ||
        planTier === "coaching"
      )
        pageCount += 1; // Movement & fitness
      pageCount += 1; // Stress management
      if (planTier === "premium" || planTier === "coaching") pageCount += 1; // Supplements
      pageCount += 1; // Progress tracking
      pageCount += 1; // Action plan

      console.log("PDF generated successfully:", filename);

      setPdfData({
        pdfRecordId: `pdf_${freshAnalysisId}`,
        orderId: freshAnalysisId,
        planTier: config.planId,
        userName: parsedQuizData.userName || "User",
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        downloadUrl: URL.createObjectURL(blob),
        pageCount: pageCount,
      });

      // Capture download event in database
      try {
        const planLabels: Record<string, string> = {
          'free_blueprint': 'Free Blueprint',
          'essential_blueprint': 'Essential Blueprint',
          'premium_blueprint': 'Premium Blueprint',
          'coaching_blueprint': 'Coaching Blueprint',
        };
        await fetch("/api/wellness/download-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: parsedQuizData.userEmail,
            userName: parsedQuizData.userName,
            productName: `GeneWell ${planLabels[config.planId] || config.planId}`,
            planTier: config.planId,
            pdfRecordId: `pdf_${freshAnalysisId}`,
            analysisId: freshAnalysisId
          }),
        });
      } catch (captureErr) {
        console.error("Failed to capture download event:", captureErr);
      }

      // Store for potential later use
      localStorage.setItem(
        "lastPDFData",
        JSON.stringify({
          pdfRecordId: `pdf_${freshAnalysisId}`,
          orderId: freshAnalysisId,
          pageCount: pageCount,
          filename: filename,
        })
      );

      // Store the blob reference for download (note: Blobs can't be stored in sessionStorage)
      // Instead, we keep the blob in memory via pdfData state
      console.log("PDF ready for download");
    } catch (err) {
      console.error("PDF generation error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`PDF generation failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfData) return;

    setIsDownloading(true);
    try {
      console.log("Starting download...");

      // Create object URL from the blob URL stored in pdfData
      const link = document.createElement("a");
      link.href = pdfData.downloadUrl;
      link.download = `${(quizData.userName || "blueprint").replace(/\s+/g, "-")}_${pdfData.planTier}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("Download completed successfully");
    } catch (err) {
      console.error("Download error:", err);
      setError(
        err instanceof Error
          ? `Download failed: ${err.message}`
          : "Failed to download PDF"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewInline = async () => {
    if (!pdfData) return;

    try {
      const response = await fetch(pdfData.downloadUrl);
      if (!response.ok) throw new Error("Failed to load PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("View error:", err);
      setError("Failed to view PDF");
    }
  };

  // Check for analysis ID before rendering
  if (!analysisId && !configuration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Quiz Required
            </h1>
            <p className="text-slate-600 mb-6">
              Your wellness blueprint is personalized based on your quiz
              responses. Please complete the wellness quiz first to get started.
            </p>
            <Button
              onClick={() => navigate("/quiz")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Take Wellness Quiz
            </Button>
            <p className="text-xs text-slate-500 mt-4">
              Takes about 5-10 minutes to complete
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <Loader className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Creating Your Personalized Blueprint
          </h2>
          <p className="text-slate-600 text-sm">
            Generating your science-backed wellness plan with your name and personalized recommendations...
          </p>
          <p className="text-xs text-slate-500 mt-4">This usually takes 5-15 seconds</p>
        </Card>
      </div>
    );
  }

  const plan = getProductByPlanId(configuration?.planId || "free_blueprint");
  const selectedAddOns =
    configuration?.selectedAddOns
      .map((id) => getAddOnById(id))
      .filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-blue-900">Genewell</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Sparkles className="mr-2 h-4 w-4" /> HOME
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plans
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/quiz")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Take Another Quiz
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 py-6 sm:py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Header */}
          <div className="text-center mb-6 sm:mb-8">
            <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">
              Your Blueprint is Ready, {quizData.userName || "User"}!
            </h1>
            <p className="text-sm sm:text-xl text-slate-600">
              Your personalized wellness blueprint has been generated based on your responses
            </p>
          </div>

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700 ml-2">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Configuration Summary */}
          {plan && (
            <Card className="mb-6 border-2 border-green-200 bg-green-50/30 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {pdfData?.pageCount || plan.pageCount} pages • Personalized for {quizData.userName || "you"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
                      Your Blueprint Includes:
                    </h3>
                    <ul className="space-y-2">
                      {plan.details.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start space-x-2 text-xs sm:text-sm text-slate-700"
                        >
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {pdfData && (
                    <div className="border-t border-green-200 pt-4 mt-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-white/60 p-2 sm:p-3 rounded-lg border border-green-100">
                          <p className="text-[10px] sm:text-xs text-slate-600">Total Pages</p>
                          <p className="text-lg sm:text-2xl font-bold text-green-600">
                            {pdfData.pageCount}
                          </p>
                        </div>
                        <div className="bg-white/60 p-2 sm:p-3 rounded-lg border border-green-100">
                          <p className="text-[10px] sm:text-xs text-slate-600">Status</p>
                          <p className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1 uppercase tracking-tight">
                            Personalized
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Buttons */}
          {pdfData && (
            <>
              <Card className="mb-8 border-2 border-blue-500 shadow-lg shadow-blue-100 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 pb-4">
                  <CardTitle className="text-lg sm:text-xl">Access Your Blueprint</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    <Button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      size="lg"
                      className="w-full h-14 sm:h-16 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white font-bold py-4 text-base sm:text-lg shadow-md"
                    >
                      {isDownloading ? (
                        <>
                          <Loader className="mr-2 h-5 w-5 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <DownloadIcon className="mr-2 h-5 w-5" />
                          Download PDF Blueprint
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleViewInline}
                      variant="outline"
                      size="lg"
                      className="w-full h-12 sm:h-14 text-sm sm:text-base border-2"
                    >
                      <Eye className="mr-2 h-5 w-5" />
                      Open in Browser
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-center space-x-2 text-[10px] sm:text-xs text-slate-500 bg-slate-50 py-2 rounded-full">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Secure Download</span>
                    <span className="text-slate-300">|</span>
                    <span>PDF Format</span>
                    <span className="text-slate-300">|</span>
                    <span>Ready for Mobile</span>
                  </div>
                </CardContent>
              </Card>

              {pdfData.expiresAt && (
                <div className="mt-4 mb-8 text-xs text-slate-500 text-center">
                  Your download expires on{" "}
                  {new Date(pdfData.expiresAt).toLocaleDateString()}
                </div>
              )}
            </>
          )}

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0">1</Badge>
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Download your blueprint
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Save the PDF to your device. It includes everything personalized to your profile with your name on the cover.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0">2</Badge>
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Review and understand your plan
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Read through your personalized recommendations. Every recommendation is backed by peer-reviewed research and written for daily action.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0">3</Badge>
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Start implementing
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Begin with Week 1 actions. Consistency beats perfection. Small daily steps create lasting transformation.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0">4</Badge>
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Track and adjust
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Use the tracking tools in your blueprint. After 4 weeks, reassess and adjust based on what's working.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <div className="mt-8 text-center p-4 sm:p-6 bg-white rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Need Help?</h3>
            <p className="text-slate-600 text-xs sm:text-sm mb-4">
              Have questions about your plan or need additional support?
            </p>
            <a href="mailto:support@genewell.com" className="inline-block w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <LegalFooter />
    </div>
  );
}
