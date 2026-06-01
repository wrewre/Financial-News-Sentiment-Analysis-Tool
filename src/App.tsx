import { useState } from 'react';
import InputForm from './components/InputForm';
import StatusMessage from './components/StatusMessage';
import SummaryChart from './components/SummaryChart';
import ParagraphDisplay from './components/ParagraphDisplay';
import { AnalysisResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'loading';
    message: string;
  } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setStatus({
      type: 'loading',
      message: 'Fetching article and running FinBERT analysis… this may take 15–30s',
    });
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze article');
      }

      const fc = data.summary?.factCheck;
      const fcMsg =
        fc && fc.totalClaims > 0
          ? ` · ${fc.totalClaims} financial claim${fc.totalClaims !== 1 ? 's' : ''} fact-checked`
          : '';

      setStatus({
        type: 'success',
        message: `Analysis complete — ${data.totalParagraphs} paragraphs${fcMsg}`,
      });
      setResult(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load the link';
      setStatus({ type: 'error', message });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setResult(null);
    setStatus(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-8">
          {!result ? (
            <>
              <InputForm onAnalyze={handleAnalyze} loading={loading} />
              {status && (
                <StatusMessage type={status.type} message={status.message} />
              )}
            </>
          ) : (
            <>
              {/* Results header */}
              <div className="w-full max-w-3xl flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Analysis Results
                  </h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {result.url.length > 60
                      ? result.url.slice(0, 60) + '…'
                      : result.url}
                  </p>
                </div>
                <button
                  onClick={handleNewAnalysis}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shrink-0"
                >
                  New Analysis
                </button>
              </div>

              {status && (
                <StatusMessage type={status.type} message={status.message} />
              )}

              <SummaryChart result={result} />

              <div className="w-full max-w-3xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Article Breakdown
                </h2>
                <div className="space-y-4">
                  {result.paragraphs.map((paragraph, index) => (
                    <ParagraphDisplay
                      key={index}
                      paragraph={paragraph}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
